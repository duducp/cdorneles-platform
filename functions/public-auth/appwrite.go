package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// HTTPDoer is the transport seam (tests point it at httptest servers).
type HTTPDoer interface {
	Do(*http.Request) (*http.Response, error)
}

// appwriteOps talks to the Appwrite account/users API over raw HTTP so each
// call controls its own auth headers (session cookie vs API key vs JWT).
type appwriteOps struct {
	endpoint string // APPWRITE_FUNCTION_API_ENDPOINT, already includes /v1
	project  string // APPWRITE_FUNCTION_PROJECT_ID
	apiKey   string // per-execution key, injected as x-appwrite-key
	doer     HTTPDoer
}

func newAppwriteOps(apiKey string) *appwriteOps {
	return &appwriteOps{
		endpoint: strings.TrimSuffix(os.Getenv("APPWRITE_FUNCTION_API_ENDPOINT"), "/"),
		project:  os.Getenv("APPWRITE_FUNCTION_PROJECT_ID"),
		apiKey:   apiKey,
		doer:     &http.Client{Timeout: 10 * time.Second},
	}
}

// loginSession is the subset of an Appwrite session the login flow needs.
// cookie is the raw "name=value" pair from Set-Cookie, used only to delete
// the temporary session before responding.
type loginSession struct {
	ID     string `json:"$id"`
	UserID string `json:"userId"`
	Expire string `json:"expire"`
	cookie string
}

// loginOutcome distinguishes the two ways a password login lands: a full
// session (no MFA) or Appwrite's 401 user_more_factors_required, which still
// carries a Set-Cookie for a pending session. The pending session authorizes
// MFA list/challenge calls — but it exists server-side here, so the handler
// must hand the browser a login token to recreate it as its own cookie.
type loginOutcome struct {
	session     loginSession
	pendingMFA  bool
	appwriteErr *appwriteError
}

// tokenPair is what account.createSession(userId, secret) consumes.
type tokenPair struct {
	UserID string `json:"userId"`
	Secret string `json:"secret"`
}

// appwriteError carries an Appwrite error body across the ops seam; code is
// the stable `type` the frontend already understands.
type appwriteError struct {
	status  int
	code    string
	message string
}

func (e *appwriteError) Error() string { return e.message }

func newAppwriteError(status int, body []byte) *appwriteError {
	var payload struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	}
	_ = json.Unmarshal(body, &payload)
	code := payload.Type
	if code == "" {
		code = "upstream_error"
	}
	message := payload.Message
	if message == "" {
		message = "appwrite request failed"
	}
	return &appwriteError{status: status, code: code, message: message}
}

func (o *appwriteOps) doJSON(method, path string, headers map[string]string, payload []byte) (*http.Response, []byte, error) {
	var reader io.Reader
	if payload != nil {
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequest(method, o.endpoint+path, reader)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("X-Appwrite-Project", o.project)
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := o.doer.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, nil, err
	}
	return resp, body, nil
}

// EmailLogin verifies e-mail/password server-side. The temporary session is
// never handed to the browser; its cookie only serves DeleteSession (or the
// pending-MFA user lookup + delete).
func (o *appwriteOps) EmailLogin(email, password string) (loginOutcome, error) {
	payload, err := json.Marshal(map[string]string{"email": email, "password": password})
	if err != nil {
		return loginOutcome{}, err
	}
	resp, body, err := o.doJSON(http.MethodPost, "/account/sessions/email", nil, payload)
	if err != nil {
		return loginOutcome{}, err
	}
	cookie := sessionCookie(resp.Header.Values("Set-Cookie"), o.project)
	if resp.StatusCode >= 400 {
		ae := newAppwriteError(resp.StatusCode, body)
		// MFA accounts: 401 user_more_factors_required still sets a pending
		// session cookie. Appwrite's shared controller rejects every route
		// outside the `mfa` group while a session is pending — including
		// GET /account and GET /account/sessions — so the user id must come
		// from the cookie itself: its value is base64(JSON {"id": <userId>,
		// "secret": <sessionSecret>}) (Auth Store::encode; account.php sets
		// id = $user->getId() when creating a session). DeleteSession then
		// targets DELETE /account/sessions/current, an allowed `mfa`-group
		// route that Appwrite resolves against the pending cookie.
		if ae.code == "user_more_factors_required" && cookie != "" {
			userID, ok := decodePendingCookie(cookie)
			if !ok {
				return loginOutcome{}, fmt.Errorf("login returned a pending session cookie that could not be decoded")
			}
			pending := loginSession{ID: "current", UserID: userID, cookie: cookie}
			return loginOutcome{session: pending, pendingMFA: true}, nil
		}
		return loginOutcome{}, ae
	}
	var session loginSession
	if err := json.Unmarshal(body, &session); err != nil {
		return loginOutcome{}, err
	}
	session.cookie = cookie
	if session.ID == "" || session.UserID == "" || session.cookie == "" {
		return loginOutcome{}, fmt.Errorf("login response missing session data")
	}
	return loginOutcome{session: session}, nil
}

// pendingCookieUser is the subset of Appwrite's session cookie payload the
// login flow needs.
type pendingCookieUser struct {
	ID string `json:"id"`
}

// decodePendingCookie extracts the user id from a pending session cookie
// ("a_session_<project>=<value>"). The value is base64 of the JSON
// {"id": <userId>, "secret": <sessionSecret>} produced by Auth Store::encode
// (standard or URL-safe alphabet, with or without padding). Returns ok=false
// for anything that does not decode to an object with a non-empty id.
func decodePendingCookie(cookie string) (string, bool) {
	pair := strings.SplitN(cookie, "=", 2)
	if len(pair) != 2 || pair[1] == "" {
		return "", false
	}
	for _, enc := range []*base64.Encoding{
		base64.StdEncoding, base64.RawStdEncoding,
		base64.URLEncoding, base64.RawURLEncoding,
	} {
		decoded, err := enc.DecodeString(pair[1])
		if err != nil {
			continue
		}
		var payload pendingCookieUser
		if json.Unmarshal(decoded, &payload) != nil || payload.ID == "" {
			continue
		}
		return payload.ID, true
	}
	return "", false
}

// CreateLoginToken issues the single-use token the browser exchanges with
// account.createSession(userId, secret).
func (o *appwriteOps) CreateLoginToken(userID string) (tokenPair, error) {
	resp, body, err := o.doJSON(http.MethodPost, "/users/"+userID+"/tokens",
		map[string]string{"X-Appwrite-Key": o.apiKey}, []byte("{}"))
	if err != nil {
		return tokenPair{}, err
	}
	if resp.StatusCode >= 400 {
		return tokenPair{}, newAppwriteError(resp.StatusCode, body)
	}
	var token tokenPair
	if err := json.Unmarshal(body, &token); err != nil {
		return tokenPair{}, err
	}
	return token, nil
}

// DeleteSession removes the temporary server-side session with its own
// cookie, so no orphan login survives the request.
func (o *appwriteOps) DeleteSession(session loginSession) error {
	resp, body, err := o.doJSON(http.MethodDelete, "/account/sessions/"+session.ID,
		map[string]string{"Cookie": session.cookie}, nil)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return newAppwriteError(resp.StatusCode, body)
	}
	return nil
}

// sessionCookie picks the project session cookie out of Set-Cookie headers.
func sessionCookie(setCookies []string, project string) string {
	name := "a_session_" + project
	for _, raw := range setCookies {
		pair := strings.SplitN(strings.TrimSpace(strings.SplitN(raw, ";", 2)[0]), "=", 2)
		if len(pair) == 2 && pair[0] == name {
			return pair[0] + "=" + pair[1]
		}
	}
	return ""
}

// RequestRecovery asks Appwrite to e-mail a recovery link.
func (o *appwriteOps) RequestRecovery(email, url string) error {
	payload, err := json.Marshal(map[string]string{"email": email, "url": url})
	if err != nil {
		return err
	}
	resp, body, err := o.doJSON(http.MethodPost, "/account/recovery", nil, payload)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return newAppwriteError(resp.StatusCode, body)
	}
	return nil
}

// CompleteRecovery sets the new password; the user then logs in normally.
func (o *appwriteOps) CompleteRecovery(userID, secret, password string) error {
	payload, err := json.Marshal(map[string]string{"userId": userID, "secret": secret, "password": password})
	if err != nil {
		return err
	}
	resp, body, err := o.doJSON(http.MethodPut, "/account/recovery", nil, payload)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return newAppwriteError(resp.StatusCode, body)
	}
	return nil
}
