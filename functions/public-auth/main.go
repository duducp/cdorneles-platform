// Package handler is the public-auth Appwrite Function: a deny-by-default
// gate that verifies a Cloudflare Turnstile token before running one public
// authentication action against Appwrite.
package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
	"openruntimes/handler/internal/turnstile"
)

// Action names accepted by the router.
const (
	actionLogin            = "login"
	actionMfaChallenge     = "mfaChallenge"
	actionMfaVerify        = "mfaVerify"
	actionRequestRecovery  = "requestRecovery"
	actionCompleteRecovery = "completeRecovery"
)

// Stable error codes the frontend maps to display text.
const (
	errTurnstileNotConfigured = "turnstile_not_configured"
	errInvalidTurnstileToken  = "invalid_turnstile_token"
	errTurnstileUnavailable   = "turnstile_verification_failed"
	errInternal               = "internal"
)

// command is the flat envelope every action shares.
type command struct {
	Action         string `json:"action"`
	TurnstileToken string `json:"turnstileToken"`
	Email          string `json:"email,omitempty"`
	Password       string `json:"password,omitempty"`
	Factor         string `json:"factor,omitempty"`
	ChallengeID    string `json:"challengeId,omitempty"`
	OTP            string `json:"otp,omitempty"`
	URL            string `json:"url,omitempty"`
	UserID         string `json:"userId,omitempty"`
	Secret         string `json:"secret,omitempty"`
}

// verifyTurnstile is the siteverify seam (tests replace it).
var verifyTurnstile = turnstile.Verify

// errorBody writes the standard {error, reason} body; `error` is the stable
// code. The reason must never contain secrets or tokens.
func errorBody(ctx openruntimes.Context, status int, code, reason string) openruntimes.Response {
	return ctx.Res.Json(
		httpx.Error{Error: code, Reason: reason},
		ctx.Res.WithStatusCode(status),
	)
}

// handle gates the request, then dispatches the action. Order is fixed:
// parse → token present → siteverify → action. Unknown actions are only
// revealed to a caller that already passed the gate.
func handle(ctx openruntimes.Context, secret string) openruntimes.Response {
	var body command
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}
	// Tokens are base64url, so trimming surrounding whitespace is lossless
	// and mirrors how the secret is trimmed before siteverify.
	token := strings.TrimSpace(body.TurnstileToken)
	if token == "" {
		return errorBody(ctx, http.StatusForbidden, errInvalidTurnstileToken, "turnstile token is required")
	}
	remoteip := ctx.Req.Headers["x-appwrite-client-ip"]
	if err := verifyTurnstile(secret, token, remoteip); err != nil {
		switch {
		case errors.Is(err, turnstile.ErrMissingSecret):
			ctx.Error(err)
			return errorBody(ctx, http.StatusInternalServerError, errTurnstileNotConfigured, "TURNSTILE_SECRET_KEY is not configured")
		case errors.As(err, new(*turnstile.ErrInvalid)):
			return errorBody(ctx, http.StatusForbidden, errInvalidTurnstileToken, "turnstile token was rejected")
		default:
			ctx.Error(err)
			return errorBody(ctx, http.StatusBadGateway, errTurnstileUnavailable, "turnstile siteverify unreachable")
		}
	}
	switch body.Action {
	default:
		return httpx.BadRequest(ctx, "unknown action")
	}
}
