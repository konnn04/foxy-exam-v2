// Package auth holds the two tiny trust mechanisms of the realtime plane:
//
//   - session tokens: HS256 JWTs minted by Laravel for a candidate (one attempt) or a proctor (a set of exams);
//     the realtime services verify them locally, so a request never costs a database round-trip;
//   - internal signatures: HMAC-SHA256 over "<unix-ts>.<body>" for service-to-service calls (Laravel <-> realtime).
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
)

const (
	RoleCandidate = "candidate"
	RoleProctor   = "proctor"
)

// Claims is the payload of a session token.
type Claims struct {
	Role      string  `json:"role"`
	AttemptID int64   `json:"aid,omitempty"`  // candidate: the attempt this token is bound to
	ExamID    int64   `json:"eid,omitempty"`  // candidate: its exam
	UserID    int64   `json:"uid,omitempty"`  // candidate: the student
	OrgID     int64   `json:"oid"`            // tenant
	ExamIDs   []int64 `json:"eids,omitempty"` // proctor: exams the holder may watch
	Iat       int64   `json:"iat"`
	Exp       int64   `json:"exp"`
}

// CanWatch reports whether a proctor token covers the given exam.
func (c Claims) CanWatch(examID int64) bool {
	if c.Role != RoleProctor {
		return false
	}
	for _, id := range c.ExamIDs {
		if id == examID {
			return true
		}
	}
	return false
}

var (
	ErrMalformed = errors.New("auth: malformed token")
	ErrSignature = errors.New("auth: bad signature")
	ErrExpired   = errors.New("auth: token expired")
)

var b64 = base64.RawURLEncoding

const header = `{"alg":"HS256","typ":"JWT"}`

func mac(secret []byte, signingInput string) []byte {
	h := hmac.New(sha256.New, secret)
	h.Write([]byte(signingInput))
	return h.Sum(nil)
}

// Sign mints a token. Iat defaults to now.
func Sign(secret []byte, c Claims) string {
	if c.Iat == 0 {
		c.Iat = time.Now().Unix()
	}
	payload, _ := json.Marshal(c)
	in := b64.EncodeToString([]byte(header)) + "." + b64.EncodeToString(payload)
	return in + "." + b64.EncodeToString(mac(secret, in))
}

// Verify checks signature and expiry (with 5s of clock leeway) and returns the claims.
func Verify(secret []byte, token string, now time.Time) (Claims, error) {
	var c Claims
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return c, ErrMalformed
	}
	sig, err := b64.DecodeString(parts[2])
	if err != nil {
		return c, ErrMalformed
	}
	if !hmac.Equal(sig, mac(secret, parts[0]+"."+parts[1])) {
		return c, ErrSignature
	}
	raw, err := b64.DecodeString(parts[1])
	if err != nil {
		return c, ErrMalformed
	}
	if err := json.Unmarshal(raw, &c); err != nil {
		return c, ErrMalformed
	}
	if c.Exp == 0 || now.Unix() > c.Exp+5 {
		return c, ErrExpired
	}
	return c, nil
}

// BearerToken extracts the token of an "Authorization: Bearer x" header.
func BearerToken(h string) string {
	if len(h) > 7 && strings.EqualFold(h[:7], "bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

// ---------------------------------------------------------------- internal (service-to-service) signatures

const (
	HeaderTimestamp = "X-Foxy-Timestamp"
	HeaderSignature = "X-Foxy-Signature"
)

// SignBody returns the timestamp and signature headers for a request body.
func SignBody(secret []byte, body []byte, now time.Time) (ts, sig string) {
	ts = strconv.FormatInt(now.Unix(), 10)
	h := hmac.New(sha256.New, secret)
	h.Write([]byte(ts + "."))
	h.Write(body)
	return ts, hex.EncodeToString(h.Sum(nil))
}

// VerifyBody validates the headers produced by SignBody; maxSkew bounds replay.
func VerifyBody(secret []byte, body []byte, ts, sig string, now time.Time, maxSkew time.Duration) error {
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return ErrMalformed
	}
	d := now.Sub(time.Unix(sec, 0))
	if d < 0 {
		d = -d
	}
	if d > maxSkew {
		return ErrExpired
	}
	_, want := SignBody(secret, body, time.Unix(sec, 0))
	if !hmac.Equal([]byte(want), []byte(sig)) {
		return ErrSignature
	}
	return nil
}
