package handler

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
	"openruntimes/handler/internal/turnstile"
)

func newContext(body string) openruntimes.Context {
	ctx := openruntimes.NewContext(openruntimes.Logger{})
	ctx.Req.SetBodyBinary([]byte(body))
	ctx.Req.Headers = map[string]string{"x-appwrite-client-ip": "203.0.113.9"}
	return ctx
}

func assertError(t *testing.T, resp openruntimes.Response, wantStatus int, wantCode, wantReason string) {
	t.Helper()
	if resp.StatusCode != wantStatus {
		t.Fatalf("status = %d, want %d (body %q)", resp.StatusCode, wantStatus, resp.Body)
	}
	var body httpx.Error
	if err := json.Unmarshal(resp.Body, &body); err != nil {
		t.Fatalf("unmarshal %q: %v", resp.Body, err)
	}
	if body.Error != wantCode || body.Reason != wantReason {
		t.Fatalf("body = %+v, want {%s %q}", body, wantCode, wantReason)
	}
}

// stubTurnstile makes the gate deterministic and records its arguments.
func stubTurnstile(t *testing.T, err error) (got *[]string) {
	t.Helper()
	args := &[]string{}
	previous := verifyTurnstile
	verifyTurnstile = func(secret, token, remoteip string) error {
		*args = []string{secret, token, remoteip}
		return err
	}
	t.Cleanup(func() { verifyTurnstile = previous })
	return args
}

func errInvalidToken() error { return &turnstile.ErrInvalid{Codes: []string{"invalid-input-response"}} }
func errUnavailable() error  { return &turnstile.ErrUnavailable{Err: errors.New("boom")} }

func TestRejectsInvalidJSON(t *testing.T) {
	resp := handle(newContext("{"), "site-secret")
	assertError(t, resp, 400, "bad_request", "invalid JSON")
}

func TestRejectsMissingTokenBeforeAnythingElse(t *testing.T) {
	args := stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"login"}`), "site-secret")
	assertError(t, resp, 403, "invalid_turnstile_token", "turnstile token is required")
	if len(*args) != 0 {
		t.Fatalf("siteverify should not run, got %v", *args)
	}
}

func TestDeniesWhitespaceToken(t *testing.T) {
	resp := handle(newContext(`{"action":"login","turnstileToken":"  "}`), "site-secret")
	assertError(t, resp, 403, "invalid_turnstile_token", "turnstile token is required")
}

func TestFailsClosedWithoutSecret(t *testing.T) {
	// Deliberately unstubbed: the default seam (turnstile.Verify) returns
	// ErrMissingSecret before any network I/O, proving fail-closed wiring.
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok"}`), "")
	assertError(t, resp, 500, "turnstile_not_configured", "TURNSTILE_SECRET_KEY is not configured")
}

func TestDeniesRejectedToken(t *testing.T) {
	stubTurnstile(t, errInvalidToken())
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok"}`), "site-secret")
	assertError(t, resp, 403, "invalid_turnstile_token", "turnstile token was rejected")
}

func TestDeniesUnreachableSiteverify(t *testing.T) {
	stubTurnstile(t, errUnavailable())
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok"}`), "site-secret")
	assertError(t, resp, 502, "turnstile_verification_failed", "turnstile siteverify unreachable")
}

func TestPassesSecretTokenAndRemoteIP(t *testing.T) {
	args := stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"unknown","turnstileToken":"tok"}`), "site-secret")
	assertError(t, resp, 400, "bad_request", "unknown action")
	if len(*args) != 3 || (*args)[0] != "site-secret" || (*args)[1] != "tok" || (*args)[2] != "203.0.113.9" {
		t.Fatalf("siteverify args = %v", *args)
	}
}

func TestKnownActionsAreUnknownUntilImplemented(t *testing.T) {
	stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok"}`), "s")
	assertError(t, resp, 400, "bad_request", "unknown action")
}
