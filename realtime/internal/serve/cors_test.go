package serve

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })

	// any origin: preflight is answered without reaching the handler
	h := CORS(inner, nil)
	req := httptest.NewRequest("OPTIONS", "/v1/batch", nil)
	req.Header.Set("Origin", "http://tauri.localhost")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 204 || rec.Header().Get("Access-Control-Allow-Origin") != "http://tauri.localhost" ||
		rec.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Fatalf("preflight wrong: %d %v", rec.Code, rec.Header())
	}

	// restricted list
	h = CORS(inner, []string{"https://foxyexam.com"})
	for origin, want := range map[string]string{"https://foxyexam.com": "https://foxyexam.com", "https://evil.test": ""} {
		req = httptest.NewRequest("POST", "/v1/batch", nil)
		req.Header.Set("Origin", origin)
		rec = httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != want || rec.Body.String() != "ok" {
			t.Fatalf("origin %s: got %q body %q", origin, got, rec.Body.String())
		}
	}
}
