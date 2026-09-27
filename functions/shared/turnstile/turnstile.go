// Package turnstile verifies Cloudflare Turnstile tokens through the
// siteverify API. Every failure is a denial: unconfigured, rejected or
// unreachable all mean "no token".
package turnstile

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// siteverifyURL is swapped for a local server in tests.
var siteverifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// ErrMissingSecret means TURNSTILE_SECRET_KEY is not configured.
var ErrMissingSecret = errors.New("turnstile: secret key is not configured")

// ErrInvalid is Cloudflare's rejection; Codes carries the error-codes for
// diagnostics (never logged alongside the token).
type ErrInvalid struct {
	Codes []string
}

func (e *ErrInvalid) Error() string {
	return fmt.Sprintf("turnstile: token rejected (%s)", strings.Join(e.Codes, ", "))
}

// ErrUnavailable means siteverify could not be reached or understood.
type ErrUnavailable struct {
	Err error
}

func (e *ErrUnavailable) Error() string {
	if e.Err == nil {
		return "turnstile: siteverify unavailable"
	}
	return "turnstile: siteverify unavailable: " + e.Err.Error()
}
func (e *ErrUnavailable) Unwrap() error { return e.Err }

// Verify checks a response token for the optional remote IP. Callers must
// deny on every non-nil return. Tokens are single-use: a lost response cannot
// be safely retried, so callers must not wrap Verify in a retry loop (a retry
// would hit `timeout-or-duplicate` and deny anyway).
func Verify(secret, token, remoteip string) error {
	if strings.TrimSpace(secret) == "" {
		return ErrMissingSecret
	}
	secret = strings.TrimSpace(secret)
	if strings.TrimSpace(token) == "" {
		return &ErrInvalid{Codes: []string{"missing-input-response"}}
	}
	form := url.Values{"secret": {secret}, "response": {token}}
	if ip := strings.TrimSpace(remoteip); ip != "" {
		form.Set("remoteip", ip)
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.PostForm(siteverifyURL, form)
	if err != nil {
		return &ErrUnavailable{Err: err}
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return &ErrUnavailable{Err: err}
	}
	if resp.StatusCode != http.StatusOK {
		return &ErrUnavailable{Err: fmt.Errorf("siteverify status %d", resp.StatusCode)}
	}
	var out struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return &ErrUnavailable{Err: err}
	}
	if !out.Success {
		return &ErrInvalid{Codes: out.ErrorCodes}
	}
	return nil
}
