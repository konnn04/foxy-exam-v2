package record

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"github.com/foxyexam/realtime/internal/auth"
	"github.com/foxyexam/realtime/internal/obs"
)

const (
	lkKey, lkSecret = "devkey", "devsecret"
)

var (
	jwtSecret = []byte("jwt")
	intSecret = []byte("internal")
)

type fakeStore struct {
	mu      sync.Mutex
	objects map[string]int64
	deleted []string
}

func (f *fakeStore) PresignPut(_ context.Context, key, _ string, _ time.Duration) (string, error) {
	return "https://s3.test/put/" + key, nil
}
func (f *fakeStore) Put(_ context.Context, key, _ string, body io.Reader, _ int64) error {
	b, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.objects[key] = int64(len(b))
	return nil
}
func (f *fakeStore) PresignGet(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://s3.test/get/" + key, nil
}
func (f *fakeStore) Stat(_ context.Context, key string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	n, ok := f.objects[key]
	if !ok {
		return 0, errors.New("not found")
	}
	return n, nil
}
func (f *fakeStore) Delete(_ context.Context, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.objects, key)
	f.deleted = append(f.deleted, key)
	return nil
}

type startCall struct {
	room, identity string
	screen         bool
	path           string
}

type fakeEgress struct {
	mu      sync.Mutex
	started []startCall
	stopped []string
	fail    error
}

func (f *fakeEgress) StartParticipant(_ context.Context, room, identity string, screen bool, path string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fail != nil {
		return "", f.fail
	}
	f.started = append(f.started, startCall{room, identity, screen, path})
	return "EG_" + string(rune('a'+len(f.started))), nil
}
func (f *fakeEgress) Stop(_ context.Context, id string) error {
	f.stopped = append(f.stopped, id)
	return nil
}

type rig struct {
	srv *Server
	st  *fakeStore
	eg  *fakeEgress
	h   http.Handler
	now time.Time
}

func newRig(t *testing.T, mod func(*Config)) *rig {
	t.Helper()
	db, err := Open("sqlite", filepath.Join(t.TempDir(), "rec.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	r := &rig{st: &fakeStore{objects: map[string]int64{}}, eg: &fakeEgress{}, now: time.Now()}
	cfg := Config{JWTSecret: jwtSecret, InternalSecret: intSecret, LiveKitKey: lkKey, LiveKitSecret: lkSecret, Now: func() time.Time { return r.now }}
	if mod != nil {
		mod(&cfg)
	}
	r.srv = New(cfg, db, r.st, r.eg, obs.Logger("test"), obs.NewMetrics())
	r.h = r.srv.Handler()
	return r
}

func (r *rig) webhook(t *testing.T, ev map[string]any, signedWith string) int {
	t.Helper()
	body, _ := json.Marshal(ev)
	req := httptest.NewRequest("POST", "/v1/webhooks/livekit", bytes.NewReader(body))
	req.Header.Set("Authorization", SignWebhook(lkKey, signedWith, body, r.now))
	rec := httptest.NewRecorder()
	r.h.ServeHTTP(rec, req)
	return rec.Code
}

func trackPublished(room, identity, source string) map[string]any {
	return map[string]any{
		"event": "track_published", "room": map[string]any{"name": room},
		"participant": map[string]any{"identity": identity, "metadata": `{"oid":4}`},
		"track":       map[string]any{"sid": "TR_1", "type": "VIDEO", "source": source},
	}
}

func proctor(eids ...int64) string {
	return auth.Sign(jwtSecret, auth.Claims{Role: auth.RoleProctor, OrgID: 4, ExamIDs: eids, Exp: time.Now().Add(time.Hour).Unix()})
}

func candidate(aid, eid int64) string {
	return auth.Sign(jwtSecret, auth.Claims{Role: auth.RoleCandidate, AttemptID: aid, ExamID: eid, OrgID: 4, Exp: time.Now().Add(time.Hour).Unix()})
}

func call(h http.Handler, method, url, token string, body any) (int, map[string]any) {
	var rd *bytes.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rd = bytes.NewReader(raw)
	} else {
		rd = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, url, rd)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func signedCall(h http.Handler, method, url string, body any) (int, map[string]any) {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(method, url, bytes.NewReader(raw))
	ts, sig := auth.SignBody(intSecret, raw, time.Now())
	req.Header.Set(auth.HeaderTimestamp, ts)
	req.Header.Set(auth.HeaderSignature, sig)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func TestWebhookStartsOneEgressPerKindAndOnlyForCandidates(t *testing.T) {
	r := newRig(t, nil)

	if code := r.webhook(t, trackPublished("exam-2", "attempt-5", "CAMERA"), "wrong-secret"); code != 401 {
		t.Fatalf("forged webhook must be 401, got %d", code)
	}
	if len(r.eg.started) != 0 {
		t.Fatal("forged webhook must not start anything")
	}

	r.webhook(t, trackPublished("exam-2", "attempt-5", "CAMERA"), lkSecret)
	r.webhook(t, trackPublished("exam-2", "attempt-5", "CAMERA"), lkSecret) // reconnect republishes
	r.webhook(t, trackPublished("exam-2", "attempt-5", "SCREEN_SHARE"), lkSecret)
	r.webhook(t, trackPublished("exam-2", "attempt-5", "MICROPHONE"), lkSecret)
	r.webhook(t, trackPublished("exam-2", "proctor-9", "CAMERA"), lkSecret) // a proctor / agent
	r.webhook(t, trackPublished("lobby", "attempt-5", "CAMERA"), lkSecret)  // not an exam room

	if len(r.eg.started) != 2 {
		t.Fatalf("expected camera + screen only, got %+v", r.eg.started)
	}
	cam, scr := r.eg.started[0], r.eg.started[1]
	if cam.room != "exam-2" || cam.identity != "attempt-5" || cam.screen || scr.screen != true {
		t.Fatalf("egress params wrong: %+v / %+v", cam, scr)
	}

	code, out := call(r.h, "GET", "/v1/exams/2/recordings", proctor(2), nil)
	list := out["recordings"].([]any)
	if code != 200 || len(list) != 2 {
		t.Fatalf("list: %d %v", code, out)
	}
	first := list[0].(map[string]any)
	if first["status"] != "recording" || first["org_id"].(float64) != 4 {
		t.Fatalf("row wrong: %v", first)
	}
}

func TestEgressEndedMakesTheRecordingReadyWithFileFacts(t *testing.T) {
	r := newRig(t, nil)
	r.webhook(t, trackPublished("exam-2", "attempt-5", "CAMERA"), lkSecret)
	egressID := "EG_b"

	// protojson renders int64 as strings
	r.webhook(t, map[string]any{"event": "egress_ended", "egressInfo": map[string]any{
		"egressId": egressID, "status": "EGRESS_COMPLETE",
		"fileResults": []any{map[string]any{"filename": "x.mp4", "size": "123456", "duration": "90000000000"}},
	}}, lkSecret)

	_, out := call(r.h, "GET", "/v1/exams/2/attempts/5/recordings", proctor(2), nil)
	row := out["recordings"].([]any)[0].(map[string]any)
	if row["status"] != "ready" || row["size_bytes"].(float64) != 123456 || row["duration_ms"].(float64) != 90000 {
		t.Fatalf("recording not finalized: %v", row)
	}
	if row["url"] == "" || row["url"] == nil {
		t.Fatalf("ready recording must come with a presigned URL: %v", row)
	}
}

func TestFailedEgressStartLeavesAVisibleTrace(t *testing.T) {
	r := newRig(t, nil)
	r.eg.fail = errors.New("egress unavailable")
	r.webhook(t, trackPublished("exam-2", "attempt-5", "CAMERA"), lkSecret)
	_, out := call(r.h, "GET", "/v1/exams/2/recordings", proctor(2), nil)
	row := out["recordings"].([]any)[0].(map[string]any)
	if row["status"] != "failed" || row["error"] == "" {
		t.Fatalf("proctor must see that recording failed: %v", row)
	}
}

func TestProctorScopeIsPerExam(t *testing.T) {
	r := newRig(t, nil)
	r.webhook(t, trackPublished("exam-2", "attempt-5", "CAMERA"), lkSecret)
	_, out := call(r.h, "GET", "/v1/exams/2/recordings", proctor(2), nil)
	id := out["recordings"].([]any)[0].(map[string]any)["id"].(string)

	if code, _ := call(r.h, "GET", "/v1/exams/2/recordings", proctor(3), nil); code != 403 {
		t.Fatalf("other exam's proctor must be 403, got %d", code)
	}
	if code, _ := call(r.h, "GET", "/v1/exams/2/recordings", candidate(5, 2), nil); code != 403 {
		t.Fatalf("a candidate must never list recordings, got %d", code)
	}
	if code, _ := call(r.h, "GET", "/v1/exams/2/recordings", "", nil); code != 401 {
		t.Fatalf("no token must be 401, got %d", code)
	}
	if code, _ := call(r.h, "GET", "/v1/recordings/"+id+"/url", proctor(3), nil); code != 404 {
		t.Fatalf("foreign recording id must look missing (404), got %d", code)
	}
	if code, out := call(r.h, "GET", "/v1/recordings/"+id+"/url", proctor(2), nil); code != 409 || out["error"] != "not_ready" {
		t.Fatalf("a recording in progress has no URL yet: %d %v", code, out)
	}
}

func TestEvidenceUploadFlow(t *testing.T) {
	r := newRig(t, nil)
	tok := candidate(5, 2)

	if code, _ := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "application/x-msdownload"}); code != 400 {
		t.Fatalf("exe must be refused, got %d", code)
	}
	if code, _ := call(r.h, "POST", "/v1/evidence/presign", proctor(2), map[string]any{"content_type": "image/png"}); code != 403 {
		t.Fatalf("only candidates upload evidence, got %d", code)
	}

	code, out := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "image/png"})
	if code != 200 {
		t.Fatalf("presign: %d %v", code, out)
	}
	id := out["evidence_id"].(string)
	if out["method"] != "PUT" || out["upload_url"] == "" {
		t.Fatalf("presign body: %v", out)
	}

	// committing before the file exists must fail
	if code, _ := call(r.h, "POST", "/v1/evidence/"+id+"/commit", tok, nil); code != 409 {
		t.Fatalf("commit without upload must be 409, got %d", code)
	}
	// another candidate cannot commit it
	if code, _ := call(r.h, "POST", "/v1/evidence/"+id+"/commit", candidate(6, 2), nil); code != 404 {
		t.Fatalf("foreign commit must be 404, got %d", code)
	}

	r.st.objects["evidence/2/5/"+id+".png"] = 5000 // the client PUTs straight to storage
	code, out = call(r.h, "POST", "/v1/evidence/"+id+"/commit", tok, nil)
	if code != 200 || out["recording"].(map[string]any)["status"] != "ready" {
		t.Fatalf("commit: %d %v", code, out)
	}
	if code, out := call(r.h, "GET", "/v1/recordings/"+id+"/url", proctor(2), nil); code != 200 || out["url"] == "" {
		t.Fatalf("proctor url: %d %v", code, out)
	}
}

func TestOversizeEvidenceIsDeleted(t *testing.T) {
	r := newRig(t, nil)
	tok := candidate(5, 2)
	_, out := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "image/jpeg"})
	id := out["evidence_id"].(string)
	key := "evidence/2/5/" + id + ".jpg"
	r.st.objects[key] = 50 << 20

	if code, _ := call(r.h, "POST", "/v1/evidence/"+id+"/commit", tok, nil); code != 413 {
		t.Fatalf("oversize must be 413, got %d", code)
	}
	if _, still := r.st.objects[key]; still {
		t.Fatal("oversize object must be removed from storage")
	}
}

func TestEvidenceQuotaPerAttempt(t *testing.T) {
	r := newRig(t, func(c *Config) { c.MaxEvidence = 2 })
	tok := candidate(5, 2)
	for i := 0; i < 2; i++ {
		if code, _ := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "image/png"}); code != 200 {
			t.Fatalf("presign %d: %d", i, code)
		}
	}
	if code, _ := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "image/png"}); code != 429 {
		t.Fatalf("over quota must be 429, got %d", code)
	}
}

func TestInternalControlRequiresSignature(t *testing.T) {
	r := newRig(t, nil)
	body := map[string]any{"exam_id": 2, "attempt_id": 5, "org_id": 4, "kind": "camera"}

	if code, _ := call(r.h, "POST", "/internal/v1/egress/start", "", body); code != 401 {
		t.Fatalf("unsigned must be 401, got %d", code)
	}
	code, out := signedCall(r.h, "POST", "/internal/v1/egress/start", body)
	if code != 200 || out["recording"].(map[string]any)["status"] != "recording" {
		t.Fatalf("start: %d %v", code, out)
	}
	// idempotent
	signedCall(r.h, "POST", "/internal/v1/egress/start", body)
	if len(r.eg.started) != 1 {
		t.Fatalf("second start must reuse the active recording, egress started %d times", len(r.eg.started))
	}
	id := out["recording"].(map[string]any)["id"].(string)
	if code, _ := signedCall(r.h, "POST", "/internal/v1/recordings/"+id+"/stop", map[string]any{}); code != 200 || len(r.eg.stopped) != 1 {
		t.Fatalf("stop failed: %d %v", code, r.eg.stopped)
	}
}

func TestPurgeAndRetentionRemoveBytesAndRows(t *testing.T) {
	r := newRig(t, func(c *Config) { c.Retention = 24 * time.Hour })
	tok := candidate(5, 2)
	_, out := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "image/png"})
	id := out["evidence_id"].(string)
	key := "evidence/2/5/" + id + ".png"
	r.st.objects[key] = 100
	call(r.h, "POST", "/v1/evidence/"+id+"/commit", tok, nil)

	// retention: nothing expires yet, then 2 days later it does
	if n, _ := r.srv.Sweep(context.Background()); n != 0 {
		t.Fatalf("fresh recording must survive, swept %d", n)
	}
	r.now = r.now.Add(48 * time.Hour)
	if n, _ := r.srv.Sweep(context.Background()); n != 1 {
		t.Fatalf("expired recording must be swept, swept %d", n)
	}
	if _, still := r.st.objects[key]; still {
		t.Fatal("swept recording must lose its bytes")
	}
	longLived := auth.Sign(jwtSecret, auth.Claims{Role: auth.RoleProctor, ExamIDs: []int64{2}, Exp: time.Now().Add(200 * time.Hour).Unix()})
	_, lst := call(r.h, "GET", "/v1/exams/2/recordings", longLived, nil)
	if len(lst["recordings"].([]any)) != 0 {
		t.Fatalf("swept recording must disappear from listings: %v", lst)
	}

	// purge of a whole exam
	r.now = time.Now()
	_, o2 := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "image/png"})
	r.st.objects["evidence/2/5/"+o2["evidence_id"].(string)+".png"] = 1
	code, out := signedCall(r.h, "POST", "/internal/v1/exams/2/purge", map[string]any{})
	if code != 200 || out["deleted"].(float64) != 1 {
		t.Fatalf("purge: %d %v", code, out)
	}
}

func TestEvidenceContentIsStoredThroughTheService(t *testing.T) {
	r := newRig(t, nil)
	tok := candidate(5, 2)
	_, out := call(r.h, "POST", "/v1/evidence/presign", tok, map[string]any{"content_type": "image/jpeg"})
	id := out["evidence_id"].(string)
	if out["content_url"] != "/v1/evidence/"+id+"/content" {
		t.Fatalf("presign must point at the service upload, got %v", out["content_url"])
	}

	put := func(token, ct string, body []byte) int {
		req := httptest.NewRequest("PUT", "/v1/evidence/"+id+"/content", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", ct)
		rec := httptest.NewRecorder()
		r.h.ServeHTTP(rec, req)
		return rec.Code
	}
	if c := put(tok, "image/png", []byte("x")); c != 415 {
		t.Fatalf("a different content type must be refused, got %d", c)
	}
	if c := put(candidate(6, 2), "image/jpeg", []byte("x")); c != 404 {
		t.Fatalf("another attempt cannot write this evidence, got %d", c)
	}
	if c := put(tok, "image/jpeg", []byte("jpegbytes")); c != 200 {
		t.Fatalf("upload: %d", c)
	}
	if got := r.st.objects["evidence/2/5/"+id+".jpg"]; got != 9 {
		t.Fatalf("object not stored, size %d", got)
	}
	if code, _ := call(r.h, "POST", "/v1/evidence/"+id+"/commit", tok, nil); code != 200 {
		t.Fatalf("commit after the content upload: %d", code)
	}
}

func TestPhoneCameraIsRecordedFromItsPrivateRoomOnTheCoreRequest(t *testing.T) {
	r := newRig(t, nil)
	start := func(body map[string]any) (int, map[string]any) { return signedCall(r.h, "POST", "/internal/v1/egress/start", body) }

	if code, _ := start(map[string]any{"exam_id": 2, "attempt_id": 5, "org_id": 4, "kind": "camera2"}); code != 400 {
		t.Fatalf("camera2 without its private room must be refused, got %d", code)
	}
	if code, _ := start(map[string]any{"exam_id": 2, "attempt_id": 5, "org_id": 4, "kind": "camera2", "room": "exam-2", "identity": "phone"}); code != 400 {
		t.Fatalf("the phone is never recorded from the shared exam room, got %d", code)
	}
	code, out := start(map[string]any{"exam_id": 2, "attempt_id": 5, "org_id": 4, "kind": "camera2", "room": "cam2-9-2", "identity": "phone"})
	if code != 200 {
		t.Fatalf("start: %d %v", code, out)
	}
	if len(r.eg.started) != 1 || r.eg.started[0].room != "cam2-9-2" || r.eg.started[0].identity != "phone" || r.eg.started[0].screen {
		t.Fatalf("egress must follow the phone in its own room, got %+v", r.eg.started)
	}
	if code, _ = start(map[string]any{"exam_id": 2, "attempt_id": 5, "org_id": 4, "kind": "camera2", "room": "cam2-9-2", "identity": "phone"}); code != 200 || len(r.eg.started) != 1 {
		t.Fatalf("a reconnect must not start a second recording while one is running, got %d egress calls", len(r.eg.started))
	}
	list, _ := r.srv.db.ListByAttempt(context.Background(), 2, 5)
	if len(list) != 1 || list[0].Kind != KindCamera2 {
		t.Fatalf("expected one camera2 recording, got %+v", list)
	}
}
