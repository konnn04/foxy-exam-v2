package record

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------- LiveKit webhooks

// WebhookEvent is the subset of LiveKit's webhook payload the recorder cares about.
type WebhookEvent struct {
	Event     string  `json:"event"`
	ID        string  `json:"id"`
	CreatedAt flexInt `json:"createdAt"` // protojson renders int64 as a string
	Room      struct {
		Name string `json:"name"`
	} `json:"room"`
	Participant struct {
		Identity string `json:"identity"`
		Metadata string `json:"metadata"`
	} `json:"participant"`
	Track struct {
		Sid    string `json:"sid"`
		Type   string `json:"type"`   // AUDIO | VIDEO
		Source string `json:"source"` // CAMERA | MICROPHONE | SCREEN_SHARE | SCREEN_SHARE_AUDIO
	} `json:"track"`
	EgressInfo *EgressInfo `json:"egressInfo"`
}

// EgressInfo mirrors livekit.EgressInfo in protojson form (int64 are strings).
type EgressInfo struct {
	EgressID    string `json:"egressId"`
	RoomName    string `json:"roomName"`
	Status      string `json:"status"` // EGRESS_STARTING | EGRESS_ACTIVE | EGRESS_ENDING | EGRESS_COMPLETE | EGRESS_FAILED | EGRESS_ABORTED | EGRESS_LIMIT_REACHED
	Error       string `json:"error"`
	FileResults []fileResult `json:"fileResults"`
	// Track egress reports its single file here (older servers fill only this one).
	File *struct {
		Filename string  `json:"filename"`
		Location string  `json:"location"`
		Size     flexInt `json:"size"`
		Duration flexInt `json:"duration"` // nanoseconds
	} `json:"file"`
}

// UnmarshalJSON accepts both spellings: webhooks are camelCase (protojson) but Twirp responses use the proto field
// names (egress_id, file_results), so StartTrackEgress used to come back with an empty id although the egress ran.
func (i *EgressInfo) UnmarshalJSON(b []byte) error {
	type plain EgressInfo // no methods: avoids recursion
	var p plain
	if err := json.Unmarshal(b, &p); err != nil {
		return err
	}
	var snake struct {
		EgressID    string       `json:"egress_id"`
		RoomName    string       `json:"room_name"`
		FileResults []fileResult `json:"file_results"`
	}
	if err := json.Unmarshal(b, &snake); err != nil {
		return err
	}
	if p.EgressID == "" {
		p.EgressID = snake.EgressID
	}
	if p.RoomName == "" {
		p.RoomName = snake.RoomName
	}
	if len(p.FileResults) == 0 {
		p.FileResults = snake.FileResults
	}
	*i = EgressInfo(p)
	return nil
}

type fileResult = struct {
	Filename string  `json:"filename"`
	Location string  `json:"location"`
	Size     flexInt `json:"size"`
	Duration flexInt `json:"duration"` // nanoseconds
}

// Result returns size (bytes) and duration (ms) of the recorded file, whichever field the server filled.
func (i EgressInfo) Result() (size, durationMs int64) {
	if len(i.FileResults) > 0 {
		return int64(i.FileResults[0].Size), int64(i.FileResults[0].Duration) / 1_000_000
	}
	if i.File != nil {
		return int64(i.File.Size), int64(i.File.Duration) / 1_000_000
	}
	return 0, 0
}

// flexInt accepts a JSON number or a quoted number (protojson renders int64 as a string).
type flexInt int64

func (f *flexInt) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*f = 0
		return nil
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return err
	}
	*f = flexInt(n)
	return nil
}

var (
	ErrWebhookAuth = errors.New("livekit webhook: bad authorization")
	ErrWebhookBody = errors.New("livekit webhook: unreadable body")
)

// ParseWebhook verifies the signature LiveKit puts in the Authorization header (HS256 JWT signed with the
// API secret carrying the base64 sha256 of the body) and decodes the event.
func ParseWebhook(apiKey, apiSecret string, authHeader string, body []byte, now time.Time) (WebhookEvent, error) {
	var ev WebhookEvent
	parts := strings.Split(strings.TrimSpace(authHeader), ".")
	if len(parts) != 3 {
		return ev, ErrWebhookAuth
	}
	mac := hmac.New(sha256.New, []byte(apiSecret))
	mac.Write([]byte(parts[0] + "." + parts[1]))
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(sig, mac.Sum(nil)) {
		return ev, ErrWebhookAuth
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ev, ErrWebhookAuth
	}
	var claims struct {
		Iss    string `json:"iss"`
		Exp    int64  `json:"exp"`
		SHA256 string `json:"sha256"`
	}
	if json.Unmarshal(raw, &claims) != nil || claims.Iss != apiKey {
		return ev, ErrWebhookAuth
	}
	if claims.Exp != 0 && now.Unix() > claims.Exp+5 {
		return ev, ErrWebhookAuth
	}
	sum := sha256.Sum256(body)
	if claims.SHA256 != base64.StdEncoding.EncodeToString(sum[:]) {
		return ev, ErrWebhookAuth
	}
	if err := json.Unmarshal(body, &ev); err != nil {
		return ev, fmt.Errorf("%w: %v", ErrWebhookBody, err)
	}
	return ev, nil
}

// SignWebhook builds the Authorization value LiveKit would send (used by tests and local tooling).
func SignWebhook(apiKey, apiSecret string, body []byte, now time.Time) string {
	sum := sha256.Sum256(body)
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]any{"iss": apiKey, "nbf": now.Unix() - 1, "exp": now.Add(5 * time.Minute).Unix(), "sha256": base64.StdEncoding.EncodeToString(sum[:])})
	in := header + "." + base64.RawURLEncoding.EncodeToString(claims)
	mac := hmac.New(sha256.New, []byte(apiSecret))
	mac.Write([]byte(in))
	return in + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// ---------------------------------------------------------------- Egress (Twirp over HTTP/JSON)

// Egress starts and stops LiveKit egress jobs.
type Egress interface {
	// StartTrack records the camera (screenShare=false) or screen (true) video track of a participant into an S3 file,
	// as is: the encoded stream is copied, never decoded or re-encoded.
	StartTrack(ctx context.Context, room, identity string, screenShare bool, filepath string) (egressID string, err error)
	Stop(ctx context.Context, egressID string) error
}

// S3Output tells LiveKit Egress where to upload.
type S3Output struct {
	AccessKey, Secret, Region, Endpoint, Bucket string
	ForcePathStyle                              bool
}

type HTTPEgress struct {
	Host      string // http://livekit:7880
	APIKey    string
	APISecret string
	S3        S3Output
	HTTP      *http.Client
}

func NewHTTPEgress(host, key, secret string, s3 S3Output) *HTTPEgress {
	return &HTTPEgress{Host: strings.TrimRight(host, "/"), APIKey: key, APISecret: secret, S3: s3, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

// serverToken is a short-lived admin token: egress ("roomRecord") and, for one room, reading its participants.
func (e *HTTPEgress) serverToken(now time.Time, room string) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	video := map[string]any{"roomRecord": true, "roomList": true}
	if room != "" {
		video["roomAdmin"] = true
		video["room"] = room
	}
	claims, _ := json.Marshal(map[string]any{"iss": e.APIKey, "nbf": now.Unix() - 1, "exp": now.Add(time.Minute).Unix(), "video": video})
	in := header + "." + base64.RawURLEncoding.EncodeToString(claims)
	mac := hmac.New(sha256.New, []byte(e.APISecret))
	mac.Write([]byte(in))
	return in + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (e *HTTPEgress) call(ctx context.Context, method string, in any, out any) error {
	return e.twirp(ctx, "livekit.Egress", method, "", in, out)
}

func (e *HTTPEgress) twirp(ctx context.Context, service, method, room string, in any, out any) error {
	body, _ := json.Marshal(in)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.Host+"/twirp/"+service+"/"+method, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.serverToken(time.Now(), room))
	resp, err := e.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return fmt.Errorf("livekit egress %s: %d %s", method, resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	if out != nil {
		return json.Unmarshal(raw, out)
	}
	return nil
}

// videoTrackSID finds the published camera (or screen share) video track of a participant.
func (e *HTTPEgress) videoTrackSID(ctx context.Context, room, identity string, screenShare bool) (string, error) {
	var p struct {
		Tracks []struct {
			Sid    string `json:"sid"`
			Type   string `json:"type"`   // AUDIO | VIDEO | DATA
			Source string `json:"source"` // CAMERA | SCREEN_SHARE | ...
		} `json:"tracks"`
	}
	if err := e.twirp(ctx, "livekit.RoomService", "GetParticipant", room, map[string]any{"room": room, "identity": identity}, &p); err != nil {
		return "", err
	}
	want := "CAMERA"
	if screenShare {
		want = "SCREEN_SHARE"
	}
	for _, t := range p.Tracks {
		if t.Source == want && (t.Type == "" || t.Type == "VIDEO") {
			return t.Sid, nil
		}
	}
	// only the phone (its own private room, identity "phone") may have a video track without a CAMERA source (some
	// mobile browsers leave it unknown). A candidate's camera slot must never be filled with a screen share or any
	// other stream: then the recording fails visibly instead.
	if !screenShare && identity == "phone" {
		for _, t := range p.Tracks {
			if t.Type == "VIDEO" && t.Source != "SCREEN_SHARE" {
				return t.Sid, nil
			}
		}
	}
	return "", fmt.Errorf("livekit: %s has no published %s video track in %s", identity, strings.ToLower(want), room)
}

// StartTrack uses Track Egress: the VP8 stream is written to a WebM file untouched. No decoding, no encoding, so a
// recording costs almost no CPU (participant / room egress transcode every stream, which a small server cannot do for
// a whole exam room). Browsers play WebM/VP8 directly; re-encoding to H.264, if wanted, happens after the exam.
func (e *HTTPEgress) StartTrack(ctx context.Context, room, identity string, screenShare bool, filepath string) (string, error) {
	sid, err := e.videoTrackSID(ctx, room, identity, screenShare)
	if err != nil {
		return "", err
	}
	req := map[string]any{
		"room_name": room,
		"track_id":  sid,
		"file": map[string]any{
			"filepath": filepath,
			"s3": map[string]any{
				"access_key": e.S3.AccessKey, "secret": e.S3.Secret, "region": e.S3.Region,
				"endpoint": e.S3.Endpoint, "bucket": e.S3.Bucket, "force_path_style": e.S3.ForcePathStyle,
			},
		},
	}
	var info EgressInfo
	if err := e.call(ctx, "StartTrackEgress", req, &info); err != nil {
		return "", err
	}
	if info.EgressID == "" {
		return "", errors.New("livekit egress: empty egress id")
	}
	return info.EgressID, nil
}

func (e *HTTPEgress) Stop(ctx context.Context, egressID string) error {
	return e.call(ctx, "StopEgress", map[string]any{"egress_id": egressID}, nil)
}
