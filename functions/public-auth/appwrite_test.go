package handler

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newOps(t *testing.T, handler http.HandlerFunc) (*appwriteOps, *[]*http.Request) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	requests := &[]*http.Request{}
	ops := &appwriteOps{
		endpoint: server.URL,
		project:  "proj1",
		apiKey:   "ephemeral-key",
		doer: roundTripper(func(req *http.Request) (*http.Response, error) {
			*requests = append(*requests, req)
			return http.DefaultClient.Do(req)
		}),
	}
	return ops, requests
}

// roundTripper adapts a func to HTTPDoer via a real server.
type roundTripper func(*http.Request) (*http.Response, error)

func (f roundTripper) Do(req *http.Request) (*http.Response, error) { return f(req) }

func TestEmailLoginPostsCredentialsWithoutAPIKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/account/sessions/email" {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("X-Appwrite-Project") != "proj1" {
			t.Errorf("project header = %q", r.Header.Get("X-Appwrite-Project"))
		}
		if r.Header.Get("X-Api-Key") != "" {
			t.Error("login must not carry the API key")
		}
		body, _ := io.ReadAll(r.Body)
		var payload map[string]string
		_ = json.Unmarshal(body, &payload)
		if payload["email"] != "a@b.com" || payload["password"] != "pass" {
			t.Errorf("payload = %v", payload)
		}
		w.Header().Set("Set-Cookie", "a_session_proj1=cookie-value; Path=/; HttpOnly")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"$id":"s1","userId":"u1","expire":"2026-09-28T00:00:00.000+00:00"}`))
	}))
	defer server.Close()
	ops := &appwriteOps{endpoint: server.URL, project: "proj1", doer: http.DefaultClient}

	session, err := ops.EmailLogin("a@b.com", "pass")
	if err != nil {
		t.Fatalf("EmailLogin: %v", err)
	}
	if session.session.ID != "s1" || session.session.UserID != "u1" || session.session.cookie != "a_session_proj1=cookie-value" {
		t.Fatalf("session = %+v", session)
	}
}

func TestEmailLoginMapsAppwriteErrorType(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"Invalid credentials","code":401,"type":"user_invalid_credentials"}`))
	}))
	defer server.Close()
	ops := &appwriteOps{endpoint: server.URL, project: "proj1", doer: http.DefaultClient}

	_, err := ops.EmailLogin("a@b.com", "nope")
	var ae *appwriteError
	if !errors.As(err, &ae) {
		t.Fatalf("err = %v, want appwriteError", err)
	}
	if ae.status != 401 || ae.code != "user_invalid_credentials" {
		t.Fatalf("appwriteError = %+v", ae)
	}
}

// Appwrite answers a password login for an MFA account with 401
// user_more_factors_required AND a Set-Cookie for a pending session. The
// pending session must be captured (not treated as an error) so the handler
// can hand the browser a login token to recreate it as its own cookie.
//
// IMPORTANT: with a pending session, Appwrite's shared api controller rejects
// every route outside the `mfa` group with 401 user_more_factors_required —
// including GET /account and GET /account/sessions (shared/api.php Step 13).
// EmailLogin must therefore resolve the user id from the pending cookie
// itself: the cookie value is base64 of JSON {"id": <userId>, "secret":
// <sessionSecret>} (Auth Store::encode + account.php setProperty('id',
// $user->getId())), with zero extra network calls.
func TestEmailLoginMfaReturnsPendingOutcomeWithPendingSession(t *testing.T) {
	// Mirrors a real pending cookie: base64("{"id":"u1","secret":"sec"}”).
	pendingCookieValue := "eyJpZCI6InUxIiwic2VjcmV0Ijoic2VjIn0="
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/account/sessions/email" {
			w.Header().Set("Set-Cookie", "a_session_proj1="+pendingCookieValue+"; Path=/; HttpOnly")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"message":"More factors are required","code":401,"type":"user_more_factors_required"}`))
			return
		}
		// Any other route with the pending cookie must be blocked exactly as
		// production does, so the test proves EmailLogin needs no extra calls.
		if got := r.Header.Get("Cookie"); got != "a_session_proj1="+pendingCookieValue {
			t.Errorf("unexpected cookie %q for %s", got, r.URL.Path)
		}
		t.Errorf("unexpected request %s %s: EmailLogin must resolve the pending user from the cookie alone", r.Method, r.URL.Path)
	}))
	defer server.Close()
	ops := &appwriteOps{endpoint: server.URL, project: "proj1", doer: http.DefaultClient}

	outcome, err := ops.EmailLogin("a@b.com", "pass")
	if err != nil {
		t.Fatalf("EmailLogin: %v", err)
	}
	if !outcome.pendingMFA || outcome.session.cookie != "a_session_proj1="+pendingCookieValue {
		t.Fatalf("outcome = %+v", outcome)
	}
	if outcome.session.UserID != "u1" {
		t.Fatalf("pending session userId = %q, want u1 decoded from cookie", outcome.session.UserID)
	}
	if outcome.session.ID != "current" {
		t.Fatalf("pending session id = %q, want literal %q for DeleteSession", outcome.session.ID, "current")
	}
}

// The pending cookie value is base64(JSON {"id": <userId>, "secret":
// <sessionSecret>}); decoding it must yield the user id and must never fail
// on Appwrite's URL-safe base64 variants.
func TestDecodePendingCookie(t *testing.T) {
	value := base64.StdEncoding.EncodeToString([]byte(`{"id":"u1","secret":"abc.def"}`))
	userID, ok := decodePendingCookie("a_session_proj1=" + value)
	if !ok || userID != "u1" {
		t.Fatalf("decodePendingCookie = %q, %v", userID, ok)
	}
	userID, ok = decodePendingCookie("a_session_proj1=" + base64.RawURLEncoding.EncodeToString([]byte(`{"id":"u2","secret":"x"}`)))
	if !ok || userID != "u2" {
		t.Fatalf("raw url-safe decode = %q, %v", userID, ok)
	}
	for _, broken := range []string{"", "a_session_proj1=", "a_session_proj1=!!!not-base64!!!", "a_session_proj1=" + base64.StdEncoding.EncodeToString([]byte(`[]`))} {
		if _, ok := decodePendingCookie(broken); ok {
			t.Errorf("decodePendingCookie(%q) accepted broken input", broken)
		}
	}
}

func TestCreateLoginTokenUsesAPIKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/users/u1/tokens" {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("X-Api-Key") != "ephemeral-key" {
			t.Error("missing API key")
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"$id":"t1","userId":"u1","secret":"tok-secret","expire":"2026-09-28T00:00:00.000+00:00"}`))
	}))
	defer server.Close()
	ops := &appwriteOps{endpoint: server.URL, project: "proj1", apiKey: "ephemeral-key", doer: http.DefaultClient}

	pair, err := ops.CreateLoginToken("u1")
	if err != nil {
		t.Fatalf("CreateLoginToken: %v", err)
	}
	if pair.UserID != "u1" || pair.Secret != "tok-secret" {
		t.Fatalf("pair = %+v", pair)
	}
}

func TestDeleteSessionUsesItsOwnCookie(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete || r.URL.Path != "/account/sessions/s1" {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Cookie"); got != "a_session_proj1=cookie-value" {
			t.Errorf("cookie = %q", got)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	ops := &appwriteOps{endpoint: server.URL, project: "proj1", doer: http.DefaultClient}

	session := loginSession{ID: "s1", UserID: "u1", cookie: "a_session_proj1=cookie-value"}
	if err := ops.DeleteSession(session); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}
}
