package auth

import (
	"strings"
	"testing"
	"time"
)

var secret = []byte("test-secret")

func TestSignVerifyRoundTrip(t *testing.T) {
	now := time.Now()
	tok := Sign(secret, Claims{Role: RoleCandidate, AttemptID: 7, ExamID: 3, OrgID: 2, Exp: now.Add(time.Hour).Unix()})
	c, err := Verify(secret, tok, now)
	if err != nil || c.AttemptID != 7 || c.ExamID != 3 || c.OrgID != 2 || c.Role != RoleCandidate {
		t.Fatalf("round trip failed: %+v %v", c, err)
	}
}

func TestVerifyRejectsTamperingWrongSecretAndExpiry(t *testing.T) {
	now := time.Now()
	tok := Sign(secret, Claims{Role: RoleCandidate, AttemptID: 7, Exp: now.Add(time.Hour).Unix()})

	if _, err := Verify([]byte("other"), tok, now); err != ErrSignature {
		t.Fatalf("wrong secret must fail, got %v", err)
	}
	parts := strings.Split(tok, ".")
	forged := Sign(secret, Claims{Role: RoleProctor, ExamIDs: []int64{1}, Exp: now.Add(time.Hour).Unix()})
	fp := strings.Split(forged, ".")
	if _, err := Verify(secret, parts[0]+"."+fp[1]+"."+parts[2], now); err != ErrSignature {
		t.Fatalf("payload swap must fail, got %v", err)
	}
	if _, err := Verify(secret, tok, now.Add(2*time.Hour)); err != ErrExpired {
		t.Fatalf("expired token must fail, got %v", err)
	}
	if _, err := Verify(secret, "nope", now); err != ErrMalformed {
		t.Fatalf("malformed must fail, got %v", err)
	}
	// a token without exp never validates
	if _, err := Verify(secret, Sign(secret, Claims{Role: RoleCandidate}), now); err != ErrExpired {
		t.Fatalf("missing exp must fail, got %v", err)
	}
}

func TestCanWatch(t *testing.T) {
	c := Claims{Role: RoleProctor, ExamIDs: []int64{4, 9}}
	if !c.CanWatch(9) || c.CanWatch(5) {
		t.Fatal("proctor scope wrong")
	}
	if (Claims{Role: RoleCandidate, ExamIDs: []int64{9}}).CanWatch(9) {
		t.Fatal("a candidate must never watch a room")
	}
}

func TestInternalSignature(t *testing.T) {
	now := time.Now()
	body := []byte(`{"a":1}`)
	ts, sig := SignBody(secret, body, now)
	if err := VerifyBody(secret, body, ts, sig, now, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := VerifyBody(secret, []byte(`{"a":2}`), ts, sig, now, time.Minute); err != ErrSignature {
		t.Fatalf("body change must fail, got %v", err)
	}
	if err := VerifyBody(secret, body, ts, sig, now.Add(time.Hour), time.Minute); err != ErrExpired {
		t.Fatalf("replay after skew must fail, got %v", err)
	}
	if got := BearerToken("Bearer abc"); got != "abc" {
		t.Fatalf("bearer parse: %q", got)
	}
}
