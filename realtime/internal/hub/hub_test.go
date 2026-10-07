package hub

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/coder/websocket"
	"github.com/redis/go-redis/v9"

	"github.com/foxyexam/realtime/internal/auth"
	"github.com/foxyexam/realtime/internal/events"
	"github.com/foxyexam/realtime/internal/obs"
	"github.com/foxyexam/realtime/internal/store"
)

var secret = []byte("jwt")

func proctorToken(eids ...int64) string {
	return auth.Sign(secret, auth.Claims{Role: auth.RoleProctor, UserID: 77, OrgID: 1, ExamIDs: eids, Exp: time.Now().Add(time.Hour).Unix()})
}

func newHub(t *testing.T, mod func(*Config)) (*Hub, *store.Store) {
	t.Helper()
	mr := miniredis.RunT(t)
	st := store.New(redis.NewClient(&redis.Options{Addr: mr.Addr()}))
	cfg := Config{JWTSecret: secret, Tick: 40 * time.Millisecond, OriginPatterns: []string{"*"}}
	if mod != nil {
		mod(&cfg)
	}
	return New(cfg, st, obs.Logger("test"), obs.NewMetrics()), st
}

func accept(t *testing.T, st *store.Store, aid, eid int64, now time.Time, fields map[string]any, vio ...store.ViolationBrief) {
	t.Helper()
	_, err := st.Accept(context.Background(), store.AcceptParams{
		AttemptID: aid, ExamID: eid, OrgID: 1, UserID: aid * 10, Now: now, MaxSeq: 1,
		Fields: fields, ViolationsAdded: int64(len(vio)), Violations: vio,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestStatusIsDerivedFromRealSignals(t *testing.T) {
	h, _ := newHub(t, nil)
	r := newRoom(h, 1)
	now := time.Now()
	on, away, off, ended := r.att(1), r.att(2), r.att(3), r.att(4)
	on.apply(map[string]string{"ls": ms(now), "f": "1", "fs": "1"})
	away.apply(map[string]string{"ls": ms(now), "f": "0"})
	off.apply(map[string]string{"ls": ms(now.Add(-time.Minute))})
	ended.apply(map[string]string{"ls": ms(now), "st": "ended"})

	got := map[int64]string{}
	for _, row := range r.snapshot(now).Rows {
		got[row.AttemptID] = row.Status
	}
	want := map[int64]string{1: StatusOnline, 2: StatusAway, 3: StatusOffline, 4: StatusEnded}
	for id, st := range want {
		if got[id] != st {
			t.Fatalf("attempt %d: %q, want %q (all: %v)", id, got[id], st, got)
		}
	}
	if c := r.snapshot(now).Counts; c.Online != 1 || c.Away != 1 || c.Offline != 1 || c.Ended != 1 || c.Total != 4 {
		t.Fatalf("counts wrong: %+v", c)
	}
}

func ms(t time.Time) string { return strconv.FormatInt(t.UnixMilli(), 10) }

func TestFlushCoalescesManyDeltasIntoOneRowPerTick(t *testing.T) {
	h, _ := newHub(t, nil)
	r := newRoom(h, 1)
	now := time.Now()

	// 1000 heartbeats of 3 candidates between two ticks must become 3 rows, not 1000 messages
	for i := 0; i < 1000; i++ {
		aid := int64(i%3 + 1)
		r.ingestDelta(store.Delta{AttemptID: aid, At: now.UnixMilli(), Fields: map[string]any{"f": float64(1), "lat": float64(i)}})
	}
	m := r.flush(now)
	if m == nil || len(m.Rows) != 3 || m.Type != "delta" {
		t.Fatalf("want one delta with 3 rows, got %+v", m)
	}
	if again := r.flush(now); again != nil {
		t.Fatalf("an unchanged room must stay silent, got %+v", again)
	}

	// only the candidate who changed is sent
	r.ingestDelta(store.Delta{AttemptID: 2, At: now.UnixMilli(), Fields: map[string]any{"f": float64(0)}})
	m = r.flush(now)
	if m == nil || len(m.Rows) != 1 || m.Rows[0].AttemptID != 2 || m.Rows[0].Status != StatusAway {
		t.Fatalf("expected only attempt 2 as away: %+v", m)
	}

	// time passing alone turns a silent candidate offline and the proctor hears about it
	m = r.flush(now.Add(time.Minute))
	if m == nil || len(m.Rows) != 3 || m.Counts.Offline != 3 {
		t.Fatalf("expected all offline after a minute of silence: %+v", m)
	}
}

func TestViolationFeedIsCapped(t *testing.T) {
	h, _ := newHub(t, func(c *Config) { c.FeedPerTick = 5 })
	r := newRoom(h, 1)
	now := time.Now()
	for i := 0; i < 20; i++ {
		r.ingestDelta(store.Delta{AttemptID: 1, At: now.UnixMilli(), Violations: []store.ViolationBrief{{Type: "TAB_SWITCH", Severity: "MEDIUM", TS: int64(i)}}})
	}
	m := r.flush(now)
	if len(m.Feed) != 5 || m.Feed[4].TS != 19 || m.Rows[0].Violations != 20 {
		t.Fatalf("feed must keep the latest 5 while the counter stays exact: %+v", m)
	}
}

func TestRESTCommandsAreScopedToTheRoom(t *testing.T) {
	h, st := newHub(t, nil)
	now := time.Now()
	accept(t, st, 5, 1, now, map[string]any{"f": 1}) // attempt 5 belongs to exam 1
	accept(t, st, 6, 2, now, map[string]any{"f": 1}) // attempt 6 belongs to exam 2
	srv := httptest.NewServer(h.Handler())
	defer srv.Close()

	post := func(token string, eid string, body string) (int, string) {
		req, _ := http.NewRequest("POST", srv.URL+"/v1/rooms/"+eid+"/commands", bytes.NewBufferString(body))
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var buf bytes.Buffer
		buf.ReadFrom(resp.Body)
		return resp.StatusCode, buf.String()
	}

	if code, _ := post(proctorToken(1), "1", `{"attempt_id":5,"command":"WARN","message":"hi"}`); code != 200 {
		t.Fatalf("legit command: %d", code)
	}
	cmds, _ := st.R.HGetAll(context.Background(), "foxy:cmds:5").Result()
	if len(cmds) != 1 {
		t.Fatalf("command not stored: %v", cmds)
	}
	var c events.Command
	for _, raw := range cmds {
		json.Unmarshal([]byte(raw), &c)
	}
	if c.Type != "WARN" || c.By != 77 || c.Message != "hi" {
		t.Fatalf("stored command wrong: %+v", c)
	}

	if code, _ := post(proctorToken(1), "1", `{"attempt_id":6,"command":"FORCE_END"}`); code != 404 {
		t.Fatalf("attempt of another exam must 404, got %d", code)
	}
	if code, _ := post(proctorToken(1), "2", `{"attempt_id":6,"command":"FORCE_END"}`); code != 403 {
		t.Fatalf("token for exam 1 must not act in room 2, got %d", code)
	}
	if code, _ := post(proctorToken(1), "1", `{"attempt_id":5,"command":"FORMAT_DISK"}`); code != 400 {
		t.Fatalf("unknown command must 400, got %d", code)
	}
	cand := auth.Sign(secret, auth.Claims{Role: auth.RoleCandidate, AttemptID: 5, ExamID: 1, Exp: time.Now().Add(time.Hour).Unix()})
	if code, _ := post(cand, "1", `{"attempt_id":5,"command":"FORCE_END"}`); code != 403 {
		t.Fatalf("a candidate token must never command: %d", code)
	}
}

func TestWebSocketStreamsSnapshotThenCoalescedDeltas(t *testing.T) {
	h, st := newHub(t, nil)
	accept(t, st, 5, 1, time.Now(), map[string]any{"f": 1, "fs": 1})
	srv := httptest.NewServer(h.Handler())
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/v1/rooms/1/ws?token=" + proctorToken(1)
	conn, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()

	read := func() Message {
		_, data, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		var m Message
		if err := json.Unmarshal(data, &m); err != nil {
			t.Fatal(err)
		}
		return m
	}

	snap := read()
	if snap.Type != "snapshot" || len(snap.Rows) != 1 || snap.Rows[0].AttemptID != 5 || snap.Rows[0].Status != StatusOnline {
		t.Fatalf("snapshot wrong: %+v", snap)
	}

	// the candidate leaves the exam window and a violation is recorded
	accept(t, st, 5, 1, time.Now(), map[string]any{"f": 0}, store.ViolationBrief{Type: "TAB_SWITCH", Severity: "MEDIUM", TS: 1})
	var delta Message
	for i := 0; i < 20; i++ {
		if m := read(); m.Type == "delta" {
			delta = m
			break
		}
	}
	if len(delta.Rows) != 1 || delta.Rows[0].Status != StatusAway || delta.Rows[0].Violations != 1 || len(delta.Feed) != 1 || delta.Counts.Away != 1 {
		t.Fatalf("delta wrong: %+v", delta)
	}

	// a proctor warns the candidate over the same socket
	cmd, _ := json.Marshal(map[string]any{"type": "cmd", "attempt_id": 5, "command": "WARN", "message": "Quay lại bài thi"})
	if err := conn.Write(ctx, websocket.MessageText, cmd); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 20; i++ {
		_, data, err := conn.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(data), `"cmd_result"`) {
			if !strings.Contains(string(data), `"ok":true`) {
				t.Fatalf("command refused: %s", data)
			}
			return
		}
	}
	t.Fatal("no cmd_result received")
}

func TestWebSocketRejectsBadTokens(t *testing.T) {
	h, _ := newHub(t, nil)
	srv := httptest.NewServer(h.Handler())
	defer srv.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	base := "ws" + strings.TrimPrefix(srv.URL, "http")

	for name, url := range map[string]string{
		"no token":      base + "/v1/rooms/1/ws",
		"other exam":    base + "/v1/rooms/1/ws?token=" + proctorToken(2),
		"garbage token": base + "/v1/rooms/1/ws?token=abc",
	} {
		if _, resp, err := websocket.Dial(ctx, url, nil); err == nil || resp == nil || resp.StatusCode < 400 {
			t.Fatalf("%s must be refused (resp=%v err=%v)", name, resp, err)
		}
	}
}
