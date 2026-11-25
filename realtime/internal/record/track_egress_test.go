package record

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// StartTrack must look the track up (room-scoped admin token) and ask for a Track Egress of exactly that track.
func TestHTTPEgressStartTrackUsesTrackEgress(t *testing.T) {
	var calls []string
	var egressReq map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.URL.Path)
		body, _ := io.ReadAll(r.Body)
		switch r.URL.Path {
		case "/twirp/livekit.RoomService/GetParticipant":
			claims := tokenClaims(t, r.Header.Get("Authorization"))
			video := claims["video"].(map[string]any)
			if video["roomAdmin"] != true || video["room"] != "exam-7" {
				t.Errorf("GetParticipant needs a room-scoped admin grant, got %v", video)
			}
			_, _ = w.Write([]byte(`{"tracks":[{"sid":"TR_mic","type":"AUDIO","source":"MICROPHONE"},{"sid":"TR_cam","type":"VIDEO","source":"CAMERA"},{"sid":"TR_scr","type":"VIDEO","source":"SCREEN_SHARE"}]}`))
		case "/twirp/livekit.Egress/StartTrackEgress":
			_ = json.Unmarshal(body, &egressReq)
			_, _ = w.Write([]byte(`{"egressId":"EG_1"}`))
		default:
			http.Error(w, "unexpected", 404)
		}
	}))
	defer srv.Close()

	e := NewHTTPEgress(srv.URL, "key", "secret", S3Output{Bucket: "b"})
	id, err := e.StartTrack(context.Background(), "exam-7", "attempt-3", true, "recordings/7/3/screen-1.webm")
	if err != nil || id != "EG_1" {
		t.Fatalf("StartTrack = %q, %v", id, err)
	}
	if strings.Join(calls, ",") != "/twirp/livekit.RoomService/GetParticipant,/twirp/livekit.Egress/StartTrackEgress" {
		t.Fatalf("calls = %v", calls)
	}
	if egressReq["track_id"] != "TR_scr" || egressReq["room_name"] != "exam-7" {
		t.Fatalf("egress request = %v", egressReq)
	}
	if f := egressReq["file"].(map[string]any); f["filepath"] != "recordings/7/3/screen-1.webm" {
		t.Fatalf("file output = %v", f)
	}
}

func TestEgressInfoResultFallsBackToFile(t *testing.T) {
	var info EgressInfo
	_ = json.Unmarshal([]byte(`{"egressId":"EG","file":{"size":"2048","duration":"90000000000"}}`), &info)
	if size, dur := info.Result(); size != 2048 || dur != 90000 {
		t.Fatalf("Result() = %d, %d", size, dur)
	}
}

func tokenClaims(t *testing.T, auth string) map[string]any {
	t.Helper()
	parts := strings.Split(strings.TrimPrefix(auth, "Bearer "), ".")
	if len(parts) != 3 {
		t.Fatalf("not a JWT: %q", auth)
	}
	raw, _ := base64.RawURLEncoding.DecodeString(parts[1])
	var c map[string]any
	_ = json.Unmarshal(raw, &c)
	return c
}

// A candidate without a camera track must not get its screen share recorded as "camera".
func TestHTTPEgressCameraNeverFallsBackToScreen(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/twirp/livekit.RoomService/GetParticipant" {
			_, _ = w.Write([]byte(`{"tracks":[{"sid":"TR_scr","type":"VIDEO","source":"SCREEN_SHARE"},{"sid":"TR_x","type":"VIDEO","source":"UNKNOWN"}]}`))
			return
		}
		t.Errorf("no egress may start, got %s", r.URL.Path)
	}))
	defer srv.Close()
	e := NewHTTPEgress(srv.URL, "key", "secret", S3Output{})
	if _, err := e.StartTrack(context.Background(), "exam-7", "attempt-3", false, "x.webm"); err == nil {
		t.Fatal("camera recording of a candidate without a camera track must fail")
	}
}
