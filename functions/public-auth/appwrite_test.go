package handler

import (
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
	if session.ID != "s1" || session.UserID != "u1" || session.cookie != "a_session_proj1=cookie-value" {
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
