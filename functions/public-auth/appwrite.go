package handler

import (
	"bytes"
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

// challengeResponse is the created MFA challenge.
type challengeResponse struct {
	ChallengeID string `json:"challengeId"`
}

// sessionResponse is the verified session; the browser session is the same
// document, updated in place.
type sessionResponse struct {
	ID     string `json:"$id"`
	UserID string `json:"userId"`
	Expire string `json:"expire"`
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
// never handed to the browser; its cookie only serves DeleteSession.
func (o *appwriteOps) EmailLogin(email, password string) (loginSession, error) {
	payload, err := json.Marshal(map[string]string{"email": email, "password": password})
	if err != nil {
		return loginSession{}, err
	}
	resp, body, err := o.doJSON(http.MethodPost, "/account/sessions/email", nil, payload)
	if err != nil {
		return loginSession{}, err
	}
	if resp.StatusCode >= 400 {
		return loginSession{}, newAppwriteError(resp.StatusCode, body)
	}
	var session loginSession
	if err := json.Unmarshal(body, &session); err != nil {
		return loginSession{}, err
	}
	session.cookie = sessionCookie(resp.Header.Values("Set-Cookie"), o.project)
	if session.ID == "" || session.UserID == "" || session.cookie == "" {
		return loginSession{}, fmt.Errorf("login response missing session data")
	}
	return session, nil
}

// CreateLoginToken issues the single-use token the browser exchanges with
// account.createSession(userId, secret).
func (o *appwriteOps) CreateLoginToken(userID string) (tokenPair, error) {
	resp, body, err := o.doJSON(http.MethodPost, "/users/"+userID+"/tokens",
		map[string]string{"X-Api-Key": o.apiKey}, []byte("{}"))
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

// MfaChallenge creates an MFA challenge as the caller's session.
func (o *appwriteOps) MfaChallenge(jwt, factor string) (string, error) {
	payload, err := json.Marshal(map[string]string{"factor": factor})
	if err != nil {
		return "", err
	}
	resp, body, err := o.doJSON(http.MethodPost, "/account/mfa/challenges",
		map[string]string{"X-Appwrite-JWT": jwt}, payload)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", newAppwriteError(resp.StatusCode, body)
	}
	var challenge struct {
		ID string `json:"$id"`
	}
	if err := json.Unmarshal(body, &challenge); err != nil {
		return "", err
	}
	if challenge.ID == "" {
		return "", fmt.Errorf("mfa challenge response missing id")
	}
	return challenge.ID, nil
}

// MfaVerify submits the OTP; success upgrades the caller's own session.
func (o *appwriteOps) MfaVerify(jwt, challengeID, otp string) (sessionResponse, error) {
	payload, err := json.Marshal(map[string]string{"challengeId": challengeID, "otp": otp})
	if err != nil {
		return sessionResponse{}, err
	}
	resp, body, err := o.doJSON(http.MethodPut, "/account/mfa/challenges",
		map[string]string{"X-Appwrite-JWT": jwt}, payload)
	if err != nil {
		return sessionResponse{}, err
	}
	if resp.StatusCode >= 400 {
		return sessionResponse{}, newAppwriteError(resp.StatusCode, body)
	}
	var session sessionResponse
	if err := json.Unmarshal(body, &session); err != nil {
		return sessionResponse{}, err
	}
	return session, nil
}
