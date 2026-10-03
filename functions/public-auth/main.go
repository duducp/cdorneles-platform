// Package handler is the public-auth Appwrite Function: a deny-by-default
// gate that verifies a Cloudflare Turnstile token before running one public
// authentication action against Appwrite.
package handler

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
	"openruntimes/handler/internal/turnstile"
)

// Action names accepted by the router.
const (
	actionLogin            = "login"
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
	URL            string `json:"url,omitempty"`
	UserID         string `json:"userId,omitempty"`
	Secret         string `json:"secret,omitempty"`
}

// verifyTurnstile is the siteverify seam (tests replace it).
var verifyTurnstile = turnstile.Verify

// operations is the Appwrite seam, so the handler is testable without a
// server or the SDK.
type operations interface {
	EmailLogin(email, password string) (loginOutcome, error)
	CreateLoginToken(userID string) (tokenPair, error)
	DeleteSession(session loginSession) error
	RequestRecovery(email, url string) error
	CompleteRecovery(userID, secret, password string) error
}

// loginResponse carries the credentials the browser exchanges for a session.
type loginResponse struct {
	UserID string `json:"userId"`
	Secret string `json:"secret"`
}

// okResponse acknowledges a side-effect-only action.
type okResponse struct {
	OK bool `json:"ok"`
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	return handle(ctx, newAppwriteOps(ctx.Req.Headers["x-appwrite-key"]), os.Getenv("TURNSTILE_SECRET_KEY"))
}

// opsError renders an upstream Appwrite error keeping its `type` as the code.
func opsError(ctx openruntimes.Context, err error) openruntimes.Response {
	var ae *appwriteError
	if errors.As(err, &ae) {
		return errorBody(ctx, ae.status, ae.code, ae.message)
	}
	ctx.Error(err)
	return errorBody(ctx, http.StatusInternalServerError, errInternal, "appwrite request failed")
}

// mfaHandoff brokers Appwrite's pending MFA session to the browser. The
// password login left a pending session (401 user_more_factors_required) with
// its cookie inside the function — unusable there: MFA list/challenge calls
// from the browser would carry no session at all. So: delete the orphan
// server-side, mint a users.createToken for the same user, and return
// {userId, secret}. account.createSession recreates the pending session in
// the browser's cookie jar, the SDK raises user_more_factors_required, and
// the existing /mfa flow runs against the browser's own pending session.
func mfaHandoff(ctx openruntimes.Context, ops operations, pending loginSession) openruntimes.Response {
	if err := ops.DeleteSession(pending); err != nil {
		// An orphan pending session is inert (its cookie never left the
		// function and it grants no authenticated access), so the handoff
		// must not fail because of it.
		ctx.Error(err)
	}
	token, err := ops.CreateLoginToken(pending.UserID)
	if err != nil {
		return opsError(ctx, err)
	}
	if strings.TrimSpace(token.Secret) == "" {
		ctx.Error(errors.New("appwrite returned an empty mfa handoff token secret"))
		return errorBody(ctx, http.StatusInternalServerError, errInternal, "failed to create login token")
	}
	userID := token.UserID
	if userID == "" {
		userID = pending.UserID
	}
	return ctx.Res.Json(loginResponse{UserID: userID, Secret: token.Secret})
}

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
func handle(ctx openruntimes.Context, ops operations, secret string) openruntimes.Response {
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
	// MFA list/challenge/verify are intentionally absent: those flows run
	// through stock Appwrite endpoints with the browser's own pending-session
	// cookie (ADR-015), never through this function.
	switch body.Action {
	case actionLogin:
		if strings.TrimSpace(body.Email) == "" || body.Password == "" {
			return httpx.BadRequest(ctx, "email and password are required")
		}
		session, err := ops.EmailLogin(body.Email, body.Password)
		if err != nil {
			return opsError(ctx, err)
		}
		if session.pendingMFA {
			return mfaHandoff(ctx, ops, session.session)
		}
		token, err := ops.CreateLoginToken(session.session.UserID)
		if err != nil {
			return opsError(ctx, err)
		}
		if strings.TrimSpace(token.Secret) == "" {
			ctx.Error(errors.New("appwrite returned an empty login token secret"))
			return errorBody(ctx, http.StatusInternalServerError, errInternal, "failed to create login token")
		}
		// Failure here only leaves an inert orphan: the cookie never left the
		// function, so nothing can use it. Login must not fail because of it.
		if err := ops.DeleteSession(session.session); err != nil {
			ctx.Error(err)
		}
		userID := token.UserID
		if userID == "" {
			userID = session.session.UserID
		}
		return ctx.Res.Json(loginResponse{UserID: userID, Secret: token.Secret})
	case actionRequestRecovery:
		if strings.TrimSpace(body.Email) == "" || strings.TrimSpace(body.URL) == "" {
			return httpx.BadRequest(ctx, "email and url are required")
		}
		if err := ops.RequestRecovery(body.Email, body.URL); err != nil {
			return opsError(ctx, err)
		}
		return ctx.Res.Json(okResponse{OK: true})
	case actionCompleteRecovery:
		if body.UserID == "" || body.Secret == "" || body.Password == "" {
			return httpx.BadRequest(ctx, "userId, secret and password are required")
		}
		if err := ops.CompleteRecovery(body.UserID, body.Secret, body.Password); err != nil {
			return opsError(ctx, err)
		}
		return ctx.Res.Json(okResponse{OK: true})
	default:
		return httpx.BadRequest(ctx, "unknown action")
	}
}
