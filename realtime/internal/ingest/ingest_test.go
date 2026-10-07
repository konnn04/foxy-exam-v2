package ingest

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/foxyexam/realtime/internal/auth"
	"github.com/foxyexam/realtime/internal/events"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/store"
)

var (
	jwtSecret = []byte("jwt")
	intSecret = []byte("internal")
)

type env struct {
	srv *Server
	mr  *miniredis.Miniredis
	st  *store.Store
	h   http.Handler
}

func setup(t *testing.T, mod func(*Config)) *env {
	t.Helper()
	mr := miniredis.RunT(t)
	st := store.New(redis.NewClient(&redis.Options{Addr: mr.Addr()}))
	cfg := Config{JWTSecret: jwtSecret, InternalSecret: intSecret}
	if mod != nil {
		mod(&cfg)
	}
	s := New(cfg, st, obs.Logger("test"), obs.NewMetrics())
	return &env{srv: s, mr: mr, st: st, h: s.Handler()}
}

func candidate(aid, eid int64) string {
	return auth.Sign(jwtSecret, auth.Claims{Role: auth.RoleCandidate, AttemptID: aid, ExamID: eid, UserID: 9, OrgID: 1, Exp: time.Now().Add(time.Hour).Unix()})
}

func post(h http.Handler, token string, body any) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", "/v1/batch", bytes.NewReader(raw))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func ev(seq int64, typ string, data any) map[string]any {
	d, _ := json.Marshal(data)
	return map[string]any{"seq": seq, "t": typ, "ts": time.Now().UnixMilli(), "data": json.RawMessage(d)}
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) batchResponse {
	t.Helper()
	var r batchResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &r); err != nil {
		t.Fatalf("bad json %q: %v", rec.Body.String(), err)
	}
	return r
}

func TestRejectsMissingOrWrongTokens(t *testing.T) {
	e := setup(t, nil)
	if rec := post(e.h, "", map[string]any{"events": []any{}}); rec.Code != 401 {
		t.Fatalf("no token: %d", rec.Code)
	}
	proctor := auth.Sign(jwtSecret, auth.Claims{Role: auth.RoleProctor, ExamIDs: []int64{1}, Exp: time.Now().Add(time.Hour).Unix()})
	if rec := post(e.h, proctor, map[string]any{"events": []any{}}); rec.Code != 401 {
		t.Fatalf("a proctor token must not post candidate telemetry: %d", rec.Code)
	}
}

func TestBatchIsStoredOnceAndRetriesAreIdempotent(t *testing.T) {
	e := setup(t, nil)
	tok := candidate(5, 2)
	body := map[string]any{"events": []any{
		ev(1, "hb", map[string]any{"focus": true, "fullscreen": true, "camera": true, "latency_ms": 42}),
		ev(2, "violation", map[string]any{"violation_type": "TAB_SWITCH", "severity": "MEDIUM", "details": map[string]any{"to": "chrome"}}),
		ev(3, "oplog", map[string]any{"batch_seq": 1, "keystroke_count": 30, "paste_event_count": 0}),
	}}
	r := decode(t, post(e.h, tok, body))
	if !r.OK || r.Accepted != 3 || r.AckSeq != 3 || r.NextFlushMS != 1000 {
		t.Fatalf("first post: %+v", r)
	}
	if n, _ := e.st.R.XLen(t.Context(), store.StreamEvents).Result(); n != 3 {
		t.Fatalf("stream has %d entries, want 3", n)
	}

	// network flap: the client resends the same batch plus one new event
	body["events"] = append(body["events"].([]any), ev(4, "hb", map[string]any{"focus": false}))
	r = decode(t, post(e.h, tok, body))
	if r.Accepted != 1 || r.Duplicates != 3 || r.AckSeq != 4 {
		t.Fatalf("retry must dedupe: %+v", r)
	}
	if n, _ := e.st.R.XLen(t.Context(), store.StreamEvents).Result(); n != 4 {
		t.Fatalf("stream has %d entries, want 4 (no duplicates)", n)
	}

	// live state is what the proctor will see: merged heartbeat + violation counters
	att, _ := e.st.R.HGetAll(t.Context(), store.KeyAttempt(5)).Result()
	if att["f"] != "0" || att["fs"] != "1" || att["cam"] != "1" || att["lat"] != "42" || att["v"] != "1" || att["lv"] != "TAB_SWITCH" || att["eid"] != "2" {
		t.Fatalf("live state wrong: %v", att)
	}
}

func TestInvalidEventsAreRejectedIndividually(t *testing.T) {
	e := setup(t, nil)
	r := decode(t, post(e.h, candidate(5, 2), map[string]any{"events": []any{
		ev(1, "violation", map[string]any{"violation_type": "NOT_A_THING", "severity": "HIGH"}),
		ev(2, "mystery", map[string]any{}),
		ev(3, "hb", map[string]any{"focus": true}),
	}}))
	if r.Accepted != 1 || len(r.Rejected) != 2 || r.AckSeq != 3 {
		t.Fatalf("expected 1 accepted / 2 rejected: %+v", r)
	}
}

func TestGzipBodiesAndSizeLimits(t *testing.T) {
	e := setup(t, func(c *Config) { c.MaxBodyBytes = 2048 })
	raw, _ := json.Marshal(map[string]any{"events": []any{ev(1, "hb", map[string]any{"focus": true})}})
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	zw.Write(raw)
	zw.Close()
	req := httptest.NewRequest("POST", "/v1/batch", &buf)
	req.Header.Set("Authorization", "Bearer "+candidate(5, 2))
	req.Header.Set("Content-Encoding", "gzip")
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	if r := decode(t, rec); rec.Code != 200 || r.Accepted != 1 {
		t.Fatalf("gzip: %d %+v", rec.Code, r)
	}

	big := strings.Repeat("x", 4096)
	rec = post(e.h, candidate(5, 2), map[string]any{"events": []any{ev(2, "log", map[string]any{"m": big})}})
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversize body must be 413, got %d", rec.Code)
	}
}

func TestRateLimitIsPerAttempt(t *testing.T) {
	now := time.Now()
	e := setup(t, func(c *Config) { c.Burst = 3; c.RatePerSec = 1; c.Now = func() time.Time { return now } })
	hb := func(seq int64) any {
		return map[string]any{"events": []any{ev(seq, "hb", map[string]any{"focus": true})}}
	}
	for i := 1; i <= 3; i++ {
		if rec := post(e.h, candidate(5, 2), hb(int64(i))); rec.Code != 200 {
			t.Fatalf("burst %d: %d", i, rec.Code)
		}
	}
	rec := post(e.h, candidate(5, 2), hb(4))
	if rec.Code != 429 || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("4th must be limited: %d", rec.Code)
	}
	if rec := post(e.h, candidate(6, 2), hb(1)); rec.Code != 200 {
		t.Fatalf("another attempt must not be affected: %d", rec.Code)
	}
}

func TestCommandsRideTheResponseUntilAcknowledged(t *testing.T) {
	e := setup(t, nil)
	tok := candidate(5, 2)
	post(e.h, tok, map[string]any{"events": []any{ev(1, "hb", map[string]any{"focus": true})}})

	if err := e.st.PushCommand(t.Context(), 5, 2, events.Command{ID: "c1", Type: "WARN", Message: "Hãy quay lại màn hình thi", At: 1}); err != nil {
		t.Fatal(err)
	}
	r := decode(t, post(e.h, tok, map[string]any{"events": []any{ev(2, "hb", map[string]any{})}}))
	if len(r.Commands) != 1 || r.Commands[0].ID != "c1" || r.Commands[0].Type != "WARN" {
		t.Fatalf("command not delivered: %+v", r)
	}
	// not acknowledged -> delivered again (at-least-once)
	r = decode(t, post(e.h, tok, map[string]any{"events": []any{ev(3, "hb", map[string]any{})}}))
	if len(r.Commands) != 1 {
		t.Fatalf("unacked command must be redelivered: %+v", r)
	}
	r = decode(t, post(e.h, tok, map[string]any{"events": []any{ev(4, "cmd_ack", map[string]any{"id": "c1"})}}))
	if len(r.Commands) != 0 {
		t.Fatalf("acked command must be gone: %+v", r)
	}
}

func TestLifecycleEndsTheAttemptForTheClient(t *testing.T) {
	e := setup(t, nil)
	tok := candidate(5, 2)
	post(e.h, tok, map[string]any{"events": []any{ev(1, "hb", map[string]any{"focus": true})}})

	body := []byte(`{"attempt_id":5,"exam_id":2,"user_id":9,"status":"force_ended"}`)
	ts, sig := auth.SignBody(intSecret, body, time.Now())
	req := httptest.NewRequest("POST", "/internal/v1/lifecycle", bytes.NewReader(body))
	req.Header.Set(auth.HeaderTimestamp, ts)
	req.Header.Set(auth.HeaderSignature, sig)
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("lifecycle: %d %s", rec.Code, rec.Body)
	}
	r := decode(t, post(e.h, tok, map[string]any{"events": []any{ev(2, "hb", map[string]any{})}}))
	if !r.End || r.Status != "force_ended" {
		t.Fatalf("client must be told to stop: %+v", r)
	}

	// unsigned / forged lifecycle calls are refused
	req = httptest.NewRequest("POST", "/internal/v1/lifecycle", bytes.NewReader(body))
	req.Header.Set(auth.HeaderTimestamp, strconv.FormatInt(time.Now().Unix(), 10))
	req.Header.Set(auth.HeaderSignature, "deadbeef")
	rec = httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	if rec.Code != 401 {
		t.Fatalf("forged lifecycle must be 401, got %d", rec.Code)
	}
}

func TestLoadSheddingStretchesTheFlushInterval(t *testing.T) {
	e := setup(t, func(c *Config) { c.ShedInflight = 10 })
	if got := e.srv.nextFlush(5); got != 1000 {
		t.Fatalf("idle: %d", got)
	}
	if got := e.srv.nextFlush(25); got != 3000 {
		t.Fatalf("saturated: %d", got)
	}
	if got := e.srv.nextFlush(10_000); got != 5000 {
		t.Fatalf("must be capped: %d", got)
	}
}

func TestStateReportsWhereTheSequenceLeftOff(t *testing.T) {
	e := setup(t, nil)
	tok := candidate(5, 2)
	get := func(token string) (int, map[string]any) {
		req := httptest.NewRequest("GET", "/v1/state", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		e.h.ServeHTTP(rec, req)
		var out map[string]any
		json.Unmarshal(rec.Body.Bytes(), &out)
		return rec.Code, out
	}
	if code, out := get(tok); code != 200 || out["last_seq"].(float64) != 0 {
		t.Fatalf("fresh attempt: %d %v", code, out)
	}
	post(e.h, tok, map[string]any{"events": []any{ev(1, "hb", map[string]any{}), ev(7, "hb", map[string]any{})}})
	if _, out := get(tok); out["last_seq"].(float64) != 7 {
		t.Fatalf("after a batch: %v", out)
	}
	if code, _ := get(""); code != 401 {
		t.Fatalf("no token: %d", code)
	}
}
