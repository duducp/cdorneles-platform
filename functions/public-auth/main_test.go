package handler

import (
	"encoding/json"
	"errors"
	"strings"
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

func (f *fakeOps) RequestRecovery(email, url string) error {
	f.recoveryCalls++
	f.recoveryEmail = email
	f.recoveryURL = url
	if f.recoveryErr != nil {
		return f.recoveryErr
	}
	return nil
}

func (f *fakeOps) CompleteRecovery(userID, secret, password string) error {
	f.completeCalls++
	f.completeUserID = userID
	f.completeSecret = secret
	f.completePassword = password
	if f.completeErr != nil {
		return f.completeErr
	}
	return nil
}

func errInvalidToken() error { return &turnstile.ErrInvalid{Codes: []string{"invalid-input-response"}} }
func errUnavailable() error  { return &turnstile.ErrUnavailable{Err: errors.New("boom")} }

// fakeOps is an operations double that records calls and can force errors.
type fakeOps struct {
	login       loginSession
	loginErr    error
	loginCalls  int
	token       tokenPair
	tokenErr    error
	tokenCalls  int
	tokenUserID string
	deleteErr   error
	deleteCalls int

	challengeCalls   int
	challengeJWT     string
	challengeFactor  string
	challengeID      string
	challengeErr     error
	verifyCalls      int
	verifyJWT        string
	verifyChallengeID string
	verifyOTP        string
	session          sessionResponse
	verifyErr        error

	recoveryCalls    int
	recoveryEmail    string
	recoveryURL      string
	recoveryErr      error
	completeCalls    int
	completeUserID   string
	completeSecret   string
	completePassword string
	completeErr      error
}

func (f *fakeOps) EmailLogin(email, password string) (loginSession, error) {
	f.loginCalls++
	if f.loginErr != nil {
		return loginSession{}, f.loginErr
	}
	return f.login, nil
}

func (f *fakeOps) CreateLoginToken(userID string) (tokenPair, error) {
	f.tokenCalls++
	f.tokenUserID = userID
	if f.tokenErr != nil {
		return tokenPair{}, f.tokenErr
	}
	return f.token, nil
}

func (f *fakeOps) DeleteSession(session loginSession) error {
	f.deleteCalls++
	if f.deleteErr != nil {
		return f.deleteErr
	}
	return nil
}

func (f *fakeOps) MfaChallenge(jwt, factor string) (string, error) {
	f.challengeCalls++
	f.challengeJWT = jwt
	f.challengeFactor = factor
	if f.challengeErr != nil {
		return "", f.challengeErr
	}
	return f.challengeID, nil
}

func (f *fakeOps) MfaVerify(jwt, challengeID, otp string) (sessionResponse, error) {
	f.verifyCalls++
	f.verifyJWT = jwt
	f.verifyChallengeID = challengeID
	f.verifyOTP = otp
	if f.verifyErr != nil {
		return sessionResponse{}, f.verifyErr
	}
	return f.session, nil
}

func TestRejectsInvalidJSON(t *testing.T) {
	resp := handle(newContext("{"), &fakeOps{}, "site-secret")
	assertError(t, resp, 400, "bad_request", "invalid JSON")
}

func TestRejectsMissingTokenBeforeAnythingElse(t *testing.T) {
	args := stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"login"}`), &fakeOps{}, "site-secret")
	assertError(t, resp, 403, "invalid_turnstile_token", "turnstile token is required")
	if len(*args) != 0 {
		t.Fatalf("siteverify should not run, got %v", *args)
	}
}

func TestDeniesWhitespaceToken(t *testing.T) {
	resp := handle(newContext(`{"action":"login","turnstileToken":"  "}`), &fakeOps{}, "site-secret")
	assertError(t, resp, 403, "invalid_turnstile_token", "turnstile token is required")
}

func TestFailsClosedWithoutSecret(t *testing.T) {
	// Deliberately unstubbed: the default seam (turnstile.Verify) returns
	// ErrMissingSecret before any network I/O, proving fail-closed wiring.
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok"}`), &fakeOps{}, "")
	assertError(t, resp, 500, "turnstile_not_configured", "TURNSTILE_SECRET_KEY is not configured")
}

func TestDeniesRejectedToken(t *testing.T) {
	stubTurnstile(t, errInvalidToken())
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok"}`), &fakeOps{}, "site-secret")
	assertError(t, resp, 403, "invalid_turnstile_token", "turnstile token was rejected")
}

func TestDeniesUnreachableSiteverify(t *testing.T) {
	stubTurnstile(t, errUnavailable())
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok"}`), &fakeOps{}, "site-secret")
	assertError(t, resp, 502, "turnstile_verification_failed", "turnstile siteverify unreachable")
}

func TestPassesSecretTokenAndRemoteIP(t *testing.T) {
	args := stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"unknown","turnstileToken":"tok"}`), &fakeOps{}, "site-secret")
	assertError(t, resp, 400, "bad_request", "unknown action")
	if len(*args) != 3 || (*args)[0] != "site-secret" || (*args)[1] != "tok" || (*args)[2] != "203.0.113.9" {
		t.Fatalf("siteverify args = %v", *args)
	}
}

func TestUnknownActionAfterGate(t *testing.T) {
	stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"nope","turnstileToken":"tok"}`), &fakeOps{}, "s")
	assertError(t, resp, 400, "bad_request", "unknown action")
}

func TestRequestRecoveryValidatesInput(t *testing.T) {
	stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"requestRecovery","turnstileToken":"tok","email":""}`), &fakeOps{}, "s")
	assertError(t, resp, 400, "bad_request", "email and url are required")
}

func TestRequestRecoverySendsEmailAndURL(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{}
	resp := handle(newContext(`{"action":"requestRecovery","turnstileToken":"tok","email":"a@b.com","url":"https://x/reset"}`), ops, "s")
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d (%s)", resp.StatusCode, resp.Body)
	}
	if !strings.Contains(string(resp.Body), `"ok":true`) {
		t.Fatalf("body = %s", resp.Body)
	}
	if ops.recoveryCalls != 1 || ops.recoveryEmail != "a@b.com" || ops.recoveryURL != "https://x/reset" {
		t.Fatalf("ops = %+v", ops)
	}
}

func TestRequestRecoveryPassesUpstreamType(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{recoveryErr: &appwriteError{status: 404, code: "user_not_found", message: "user not found"}}
	resp := handle(newContext(`{"action":"requestRecovery","turnstileToken":"tok","email":"a@b.com","url":"https://x/reset"}`), ops, "s")
	assertError(t, resp, 404, "user_not_found", "user not found")
}

func TestCompleteRecoveryValidatesInput(t *testing.T) {
	stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"completeRecovery","turnstileToken":"tok","userId":"u1","secret":"s"}`), &fakeOps{}, "s")
	assertError(t, resp, 400, "bad_request", "userId, secret and password are required")
}

func TestCompleteRecoverySetsPasswordWithoutEchoingIt(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{}
	resp := handle(newContext(`{"action":"completeRecovery","turnstileToken":"tok","userId":"u1","secret":"s","password":"pass"}`), ops, "s")
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d (%s)", resp.StatusCode, resp.Body)
	}
	if ops.completeCalls != 1 || ops.completeUserID != "u1" || ops.completeSecret != "s" || ops.completePassword != "pass" {
		t.Fatalf("ops = %+v", ops)
	}
	// The password must never be echoed back or logged.
	if strings.Contains(string(resp.Body), "pass") {
		t.Fatalf("response leaks the password: %s", resp.Body)
	}
}

func TestCompleteRecoveryPassesUpstreamType(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{completeErr: &appwriteError{status: 401, code: "user_invalid_token", message: "invalid secret"}}
	resp := handle(newContext(`{"action":"completeRecovery","turnstileToken":"tok","userId":"u1","secret":"s","password":"pass"}`), ops, "s")
	assertError(t, resp, 401, "user_invalid_token", "invalid secret")
}

func TestLoginExchangesCredentialsAndDeletesTempSession(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{
		login: loginSession{ID: "s1", UserID: "u1", cookie: "a_session_p=c"},
		token: tokenPair{UserID: "u1", Secret: "tok"},
	}
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok","email":"a@b.com","password":"pass"}`), ops, "s")
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d (%s)", resp.StatusCode, resp.Body)
	}
	var out loginResponse
	_ = json.Unmarshal(resp.Body, &out)
	if out.UserID != "u1" || out.Secret != "tok" {
		t.Fatalf("response = %+v", out)
	}
	if ops.loginCalls != 1 || ops.tokenUserID != "u1" || ops.deleteCalls != 1 {
		t.Fatalf("ops = %+v", ops)
	}
}

func TestLoginPassesAppwriteInvalidCredentials(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{loginErr: &appwriteError{status: 401, code: "user_invalid_credentials", message: "Invalid credentials"}}
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok","email":"a@b.com","password":"pass"}`), ops, "s")
	assertError(t, resp, 401, "user_invalid_credentials", "Invalid credentials")
	if ops.tokenCalls != 0 {
		t.Fatal("must not mint a token after a failed login")
	}
}

func TestLoginValidatesInput(t *testing.T) {
	stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok","email":"a@b.com"}`), &fakeOps{}, "s")
	assertError(t, resp, 400, "bad_request", "email and password are required")
}

func TestMfaChallengeRequiresJWT(t *testing.T) {
	stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"mfaChallenge","turnstileToken":"tok","factor":"totp"}`), &fakeOps{}, "s")
	assertError(t, resp, 401, "user_unauthorized", "an active session is required")
}

func TestMfaChallengeRejectsInvalidFactor(t *testing.T) {
	stubTurnstile(t, nil)
	ctx := newContext(`{"action":"mfaChallenge","turnstileToken":"tok","factor":"sms"}`)
	ctx.Req.Headers["x-appwrite-user-jwt"] = "jwt-1"
	resp := handle(ctx, &fakeOps{}, "s")
	assertError(t, resp, 400, "bad_request", "factor must be email or totp")
}

func TestMfaChallengeCreatesChallengeWithCallerJWT(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{challengeID: "c1"}
	ctx := newContext(`{"action":"mfaChallenge","turnstileToken":"tok","factor":"totp"}`)
	ctx.Req.Headers["x-appwrite-user-jwt"] = "jwt-1"
	resp := handle(ctx, ops, "s")
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d (%s)", resp.StatusCode, resp.Body)
	}
	var out challengeResponse
	_ = json.Unmarshal(resp.Body, &out)
	if out.ChallengeID != "c1" {
		t.Fatalf("response = %+v", out)
	}
	if ops.challengeJWT != "jwt-1" || ops.challengeFactor != "totp" {
		t.Fatalf("ops = %+v", ops)
	}
}

func TestMfaVerifySubmitsOTPAndUpgradesSession(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{session: sessionResponse{ID: "s1", UserID: "u1", Expire: "2026-09-28T00:00:00.000+00:00"}}
	ctx := newContext(`{"action":"mfaVerify","turnstileToken":"tok","challengeId":"c1","otp":"123456"}`)
	ctx.Req.Headers["x-appwrite-user-jwt"] = "jwt-1"
	resp := handle(ctx, ops, "s")
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d (%s)", resp.StatusCode, resp.Body)
	}
	var out sessionResponse
	_ = json.Unmarshal(resp.Body, &out)
	if out.ID != "s1" || out.UserID != "u1" {
		t.Fatalf("response = %+v", out)
	}
	if ops.verifyJWT != "jwt-1" || ops.verifyChallengeID != "c1" || ops.verifyOTP != "123456" {
		t.Fatalf("ops = %+v", ops)
	}
}

func TestMfaVerifyRequiresOTP(t *testing.T) {
	stubTurnstile(t, nil)
	ctx := newContext(`{"action":"mfaVerify","turnstileToken":"tok","challengeId":"c1","otp":"  "}`)
	ctx.Req.Headers["x-appwrite-user-jwt"] = "jwt-1"
	resp := handle(ctx, &fakeOps{}, "s")
	assertError(t, resp, 400, "bad_request", "challengeId and otp are required")
}

func TestMfaVerifyRequiresJWT(t *testing.T) {
	stubTurnstile(t, nil)
	resp := handle(newContext(`{"action":"mfaVerify","turnstileToken":"tok","challengeId":"c1","otp":"123456"}`), &fakeOps{}, "s")
	assertError(t, resp, 401, "user_unauthorized", "an active session is required")
}

func TestMfaUpstreamErrorPassesTypeThrough(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{verifyErr: &appwriteError{status: 401, code: "user_unauthorized", message: "challenge mismatch"}}
	ctx := newContext(`{"action":"mfaVerify","turnstileToken":"tok","challengeId":"c1","otp":"000000"}`)
	ctx.Req.Headers["x-appwrite-user-jwt"] = "jwt-1"
	resp := handle(ctx, ops, "s")
	assertError(t, resp, 401, "user_unauthorized", "challenge mismatch")
}

func TestLoginKeepsRunningWhenTempSessionDeleteFails(t *testing.T) {
	stubTurnstile(t, nil)
	ops := &fakeOps{
		login:     loginSession{ID: "s1", UserID: "u1", cookie: "a_session_p=c"},
		token:     tokenPair{UserID: "u1", Secret: "tok"},
		deleteErr: errors.New("boom"),
	}
	resp := handle(newContext(`{"action":"login","turnstileToken":"tok","email":"a@b.com","password":"pass"}`), ops, "s")
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d (%s)", resp.StatusCode, resp.Body)
	}
}
