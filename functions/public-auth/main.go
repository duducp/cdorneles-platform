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

// operations is the Appwrite seam, so the handler is testable without a
// server or the SDK.
type operations interface {
	EmailLogin(email, password string) (loginSession, error)
	CreateLoginToken(userID string) (tokenPair, error)
	DeleteSession(session loginSession) error
	MfaChallenge(jwt, factor string) (string, error)
	MfaVerify(jwt, challengeID, otp string) (sessionResponse, error)
}

// loginResponse carries the credentials the browser exchanges for a session.
type loginResponse struct {
	UserID string `json:"userId"`
	Secret string `json:"secret"`
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
	// mfaJWT is the caller session JWT Appwrite injects into every execution
	// of an authenticated caller.
	jwt := strings.TrimSpace(ctx.Req.Headers["x-appwrite-user-jwt"])
	switch body.Action {
	case actionLogin:
		if strings.TrimSpace(body.Email) == "" || body.Password == "" {
			return httpx.BadRequest(ctx, "email and password are required")
		}
		session, err := ops.EmailLogin(body.Email, body.Password)
		if err != nil {
			return opsError(ctx, err)
		}
		token, err := ops.CreateLoginToken(session.UserID)
		if err != nil {
			return opsError(ctx, err)
		}
		if strings.TrimSpace(token.Secret) == "" {
			ctx.Error(errors.New("appwrite returned an empty login token secret"))
			return errorBody(ctx, http.StatusInternalServerError, errInternal, "failed to create login token")
		}
		// Failure here only leaves an inert orphan: the cookie never left the
		// function, so nothing can use it. Login must not fail because of it.
		if err := ops.DeleteSession(session); err != nil {
			ctx.Error(err)
		}
		userID := token.UserID
		if userID == "" {
			userID = session.UserID
		}
		return ctx.Res.Json(loginResponse{UserID: userID, Secret: token.Secret})
	case actionMfaChallenge:
		if body.Factor != "email" && body.Factor != "totp" {
			return httpx.BadRequest(ctx, "factor must be email or totp")
		}
		if jwt == "" {
			return errorBody(ctx, http.StatusUnauthorized, "user_unauthorized", "an active session is required")
		}
		challengeID, err := ops.MfaChallenge(jwt, body.Factor)
		if err != nil {
			return opsError(ctx, err)
		}
		return ctx.Res.Json(challengeResponse{ChallengeID: challengeID})
	case actionMfaVerify:
		if body.ChallengeID == "" || strings.TrimSpace(body.OTP) == "" {
			return httpx.BadRequest(ctx, "challengeId and otp are required")
		}
		if jwt == "" {
			return errorBody(ctx, http.StatusUnauthorized, "user_unauthorized", "an active session is required")
		}
		session, err := ops.MfaVerify(jwt, body.ChallengeID, body.OTP)
		if err != nil {
			return opsError(ctx, err)
		}
		return ctx.Res.Json(session)
	default:
		return httpx.BadRequest(ctx, "unknown action")
	}
}
