package record

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"
	"time"

	"github.com/livekit/protocol/auth"
)

func TestWebhookSignedByRealLiveKitLibrary(t *testing.T) {
	body := []byte(`{"event":"participant_joined","id":"EV_x","createdAt":"1760000000","room":{"name":"exam-2","emptyTimeout":300},"participant":{"identity":"attempt-5","joinedAt":"1760000000"}}`)
	sum := sha256.Sum256(body)
	tok, err := auth.NewAccessToken("foxy", "s3cr3t-value").SetValidFor(5 * time.Minute).SetSha256(base64.StdEncoding.EncodeToString(sum[:])).ToJWT()
	if err != nil {
		t.Fatal(err)
	}
	ev, err := ParseWebhook("foxy", "s3cr3t-value", tok, body, time.Now())
	if err != nil {
		t.Fatalf("real LiveKit token or payload rejected: %v", err)
	}
	if ev.Participant.Identity != "attempt-5" || ev.CreatedAt != 1760000000 {
		t.Fatalf("payload misread: %+v", ev)
	}
}
