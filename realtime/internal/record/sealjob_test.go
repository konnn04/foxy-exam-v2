package record

import (
	"bytes"
	"context"
	"crypto/rand"
	"io"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestSealAfterExamEncryptsFilesAndStillPlaysThemWithRange(t *testing.T) {
	master := make([]byte, 32)
	_, _ = rand.Read(master)
	r := newRig(t, func(c *Config) { c.SealKey = master; c.PublicURL = "https://gw.test/rt/record" })
	ctx := context.Background()

	video := make([]byte, 3*sealChunk+123)
	_, _ = rand.Read(video)
	_ = r.st.Put(ctx, "recordings/2/5/camera-1.webm", "video/webm", bytes.NewReader(video), int64(len(video)))
	_ = r.st.Put(ctx, "clips/R1/0-10.mp4", "video/mp4", strings.NewReader("plain clip"), 10)
	rec := Recording{ID: "R1", ExamID: 2, AttemptID: 5, Kind: KindCamera, ObjectKey: "recordings/2/5/camera-1.webm", Status: StatusReady, Mime: "video/webm", CreatedAt: r.now.UnixMilli()}
	if err := r.srv.db.Insert(ctx, rec); err != nil {
		t.Fatal(err)
	}

	if code, _ := signedCall(r.h, "POST", "/internal/v1/attempts/5/seal", map[string]any{"exam_id": 2}); code != 200 {
		t.Fatalf("seal request: %d", code)
	}
	if n, err := r.srv.SealSweep(ctx); err != nil || n != 1 {
		t.Fatalf("sweep sealed %d, %v", n, err)
	}

	got, _ := r.srv.db.Get(ctx, "R1")
	if !got.Sealed || got.ObjectKey != "recordings/2/5/camera-1.webm.fxe" || got.PlainSize != int64(len(video)) {
		t.Fatalf("row not sealed: %+v", got)
	}
	if _, err := r.st.Stat(ctx, "recordings/2/5/camera-1.webm"); err == nil {
		t.Fatal("the plain recording must be gone")
	}
	if _, err := r.st.Stat(ctx, "clips/R1/0-10.mp4"); err == nil {
		t.Fatal("plain clips cut before sealing must be gone")
	}
	if bytes.Contains(r.st.data[got.ObjectKey], video[:64]) {
		t.Fatal("storage must hold ciphertext only")
	}

	code, out := call(r.h, "GET", "/v1/exams/2/attempts/5/recordings", proctor(2), nil)
	if code != 200 {
		t.Fatalf("list: %d", code)
	}
	u := out["recordings"].([]any)[0].(map[string]any)["url"].(string)
	if !strings.HasPrefix(u, "https://gw.test/rt/record/v1/sealed?") {
		t.Fatalf("a sealed file must play through this service, got %s", u)
	}
	parsed, _ := url.Parse(u)
	req := httptest.NewRequest("GET", "/v1/sealed?"+parsed.RawQuery, nil)
	req.Header.Set("Range", "bytes=70000-70099")
	w := httptest.NewRecorder()
	r.h.ServeHTTP(w, req)
	if w.Code != 206 || !bytes.Equal(w.Body.Bytes(), video[70000:70100]) {
		t.Fatalf("range read: %d, %d bytes", w.Code, w.Body.Len())
	}
	if ct := w.Header().Get("Content-Type"); ct != "video/webm" {
		t.Fatalf("content type %q", ct)
	}

	// a tampered or expired link is refused
	q := parsed.Query()
	q.Set("k", "recordings/2/9/camera-1.webm.fxe")
	w = httptest.NewRecorder()
	r.h.ServeHTTP(w, httptest.NewRequest("GET", "/v1/sealed?"+q.Encode(), nil))
	if w.Code != 403 {
		t.Fatalf("another key with the same signature must be refused, got %d", w.Code)
	}
	r.now = r.now.Add(time.Hour)
	w = httptest.NewRecorder()
	r.h.ServeHTTP(w, httptest.NewRequest("GET", "/v1/sealed?"+parsed.RawQuery, nil))
	if w.Code != 403 {
		t.Fatalf("an expired link must be refused, got %d", w.Code)
	}

	// the request is closed once nothing is left to seal and the grace period passed
	if _, err := r.srv.SealSweep(ctx); err != nil {
		t.Fatal(err)
	}
	if reqs, _ := r.srv.db.SealRequests(ctx, 10); len(reqs) != 0 {
		t.Fatalf("seal request should be done: %+v", reqs)
	}
	body, err := r.srv.plainObject(ctx, got)
	if err != nil {
		t.Fatal(err)
	}
	plain, _ := io.ReadAll(body)
	if !bytes.Equal(plain, video) {
		t.Fatal("clips are cut from the decrypted recording")
	}
}

func TestSealRequestIsRefusedWithoutAKey(t *testing.T) {
	r := newRig(t, nil)
	if code, out := signedCall(r.h, "POST", "/internal/v1/attempts/5/seal", map[string]any{"exam_id": 2}); code != 503 || out["error"] != "seal_disabled" {
		t.Fatalf("no key: %d %v", code, out)
	}
}
