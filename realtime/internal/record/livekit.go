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
	Event     string `json:"event"`
	ID        string `json:"id"`
	CreatedAt int64  `json:"createdAt"`
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
	FileResults []struct {
		Filename string  `json:"filename"`
		Location string  `json:"location"`
		Size     flexInt `json:"size"`
		Duration flexInt `json:"duration"` // nanoseconds
	} `json:"fileResults"`
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

var ErrWebhookAuth = errors.New("livekit webhook: bad authorization")

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
		return ev, fmt.Errorf("livekit webhook: %w", err)
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
	// StartParticipant records the camera (screenShare=false) or screen (true) of a participant into an S3 file.
	StartParticipant(ctx context.Context, room, identity string, screenShare bool, filepath string) (egressID string, err error)
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

// serverToken is a short-lived admin token with the egress ("roomRecord") grant.
func (e *HTTPEgress) serverToken(now time.Time) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]any{"iss": e.APIKey, "nbf": now.Unix() - 1, "exp": now.Add(time.Minute).Unix(), "video": map[string]any{"roomRecord": true, "roomList": true}})
	in := header + "." + base64.RawURLEncoding.EncodeToString(claims)
	mac := hmac.New(sha256.New, []byte(e.APISecret))
	mac.Write([]byte(in))
	return in + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (e *HTTPEgress) call(ctx context.Context, method string, in any, out any) error {
	body, _ := json.Marshal(in)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.Host+"/twirp/livekit.Egress/"+method, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.serverToken(time.Now()))
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

func (e *HTTPEgress) StartParticipant(ctx context.Context, room, identity string, screenShare bool, filepath string) (string, error) {
	req := map[string]any{
		"room_name":    room,
		"identity":     identity,
		"screen_share": screenShare,
		"file_outputs": []map[string]any{{
			"file_type": "MP4",
			"filepath":  filepath,
			"s3": map[string]any{
				"access_key": e.S3.AccessKey, "secret": e.S3.Secret, "region": e.S3.Region,
				"endpoint": e.S3.Endpoint, "bucket": e.S3.Bucket, "force_path_style": e.S3.ForcePathStyle,
			},
		}},
	}
	var info EgressInfo
	if err := e.call(ctx, "StartParticipantEgress", req, &info); err != nil {
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
