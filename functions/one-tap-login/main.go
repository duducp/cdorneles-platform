// Package handler implements the one-tap-login Appwrite Function. It takes a
// Google One Tap ID token (JWT) produced by the Google Identity Services SDK,
// verifies it server-side (RS256 signature against Google's published keys,
// issuer, audience, expiry and a verified e-mail claim), and creates an
// Appwrite login token for the matching platform user. The browser exchanges
// that token for a session with `account.createSession(userId, secret)`. Deny
// by default: an unknown e-mail, a disabled account or an Appwrite-unverified
// e-mail never gets a token.
package handler

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/users"
	"github.com/golang-jwt/jwt/v5"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

// googleCertsURL publishes Google's current signing keys (a JWKS document).
const googleCertsURL = "https://www.googleapis.com/oauth2/v3/certs"

// keysTTL bounds how long the fetched signing keys stay trusted before a
// refresh. Rotation is also handled on demand: an unknown kid triggers one
// forced refresh.
const keysTTL = 12 * time.Hour

// Issuer values Google signs ID tokens with. Both spellings are valid per the
// Google Identity documentation.
const (
	issuerShort = "accounts.google.com"
	issuerLong  = "https://accounts.google.com"
)

// Stable error codes the frontend maps to user-facing messages.
const (
	errInvalidToken       = "invalid_token"
	errUnknownEmail       = "unknown_email"
	errUserDisabled       = "user_disabled"
	errEmailNotVerified   = "email_not_verified"
	errConfigMissing      = "config_missing"
	errGoogleAuthDisabled = "google_auth_disabled"
	errInternal           = "internal_error"
)

// clock is the time source for claim validation. Overridden in tests.
var clock = time.Now

// oneTapLoginRequest is the browser's body: the ID token from Google One Tap.
type oneTapLoginRequest struct {
	IDToken string `json:"idToken"`
}

// oneTapLoginResponse carries the credentials the browser needs to complete
// the session with `account.createSession(userId, secret)`.
type oneTapLoginResponse struct {
	UserID string `json:"userId"`
	Secret string `json:"secret"`
}

// googleClaims is the subset of the Google ID token payload this function
// relies on. Audience, Issuer and ExpiresAt come from the registered claims.
type googleClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	jwt.RegisteredClaims
}

// operations is the seam over the Appwrite SDK and the JWT machinery so the
// handler's validation and orchestration are unit-testable without an SDK,
// network or crypto mock.
type operations interface {
	// VerifyIDToken cryptographically verifies the ID token (signature,
	// algorithm and parser-level expiry) and returns the parsed token.
	VerifyIDToken(idToken string) (*jwt.Token, error)
	// FindUserByEmail resolves the platform user for an e-mail, or nil when
	// no user matches.
	FindUserByEmail(email string) (*models.User, error)
	// CreateLoginToken creates the single-use token the browser exchanges for a
	// session with `account.createSession(userId, secret)`.
	CreateLoginToken(userID string) (*models.Token, error)
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	return handle(ctx, newAppwriteOps(ctx.Req.Headers["x-appwrite-key"]))
}

// handle verifies the ID token, resolves the user, then creates the login
// token through the injected operations seam. The ID token and the login token
// secret are never logged.
func handle(ctx openruntimes.Context, ops operations) openruntimes.Response {
	// Kill switch first: reject before parsing the body or doing any work.
	if googleAuthDisabled() {
		return errorBody(ctx, http.StatusForbidden, errGoogleAuthDisabled, "Google auth is disabled")
	}

	var body oneTapLoginRequest
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}
	if strings.TrimSpace(body.IDToken) == "" {
		return errorBody(ctx, http.StatusBadRequest, errInvalidToken, "idToken is required")
	}

	clientID := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID"))
	if clientID == "" {
		return errorBody(ctx, http.StatusInternalServerError, errConfigMissing, "GOOGLE_CLIENT_ID is not configured")
	}

	token, err := ops.VerifyIDToken(body.IDToken)
	if err != nil {
		ctx.Log("id token verification failed", "error", err.Error())
		return errorBody(ctx, http.StatusUnauthorized, errInvalidToken, "invalid Google ID token")
	}
	claims, err := validateClaims(token, clientID)
	if err != nil {
		ctx.Log("id token claims rejected", "error", err.Error())
		return errorBody(ctx, http.StatusUnauthorized, errInvalidToken, "invalid Google ID token")
	}

	user, err := ops.FindUserByEmail(claims.Email)
	if err != nil {
		ctx.Error(err)
		return errorBody(ctx, http.StatusInternalServerError, errInternal, "failed to resolve user")
	}

	// Deny by default: no matching user, a disabled account, or an e-mail
	// Google has verified but Appwrite has not never gets a login token.
	if user == nil {
		ctx.Log(map[string]interface{}{"action": "one_tap.rejected", "reason": "unknown_email"})
		return errorBody(ctx, http.StatusForbidden, errUnknownEmail, "no platform user for this Google account")
	}
	if !user.Status {
		return errorBody(ctx, http.StatusForbidden, errUserDisabled, "account is disabled")
	}
	if !user.EmailVerification {
		return errorBody(ctx, http.StatusForbidden, errEmailNotVerified, "account e-mail is not verified")
	}

	loginToken, err := ops.CreateLoginToken(user.Id)
	if err != nil {
		ctx.Error(err)
		return errorBody(ctx, http.StatusInternalServerError, errInternal, "failed to create login token")
	}
	if loginToken == nil || strings.TrimSpace(loginToken.Secret) == "" {
		ctx.Error(errors.New("appwrite returned an empty login token secret"))
		return errorBody(ctx, http.StatusInternalServerError, errInternal, "failed to create login token")
	}

	ctx.Log(map[string]interface{}{
		"action": "one_tap.login",
		"userId": user.Id,
	})

	return ctx.Res.Json(oneTapLoginResponse{
		UserID: loginToken.UserId,
		Secret: loginToken.Secret,
	})
}

// googleAuthDisabled reports whether Google auth was turned off for the
// project. Only an explicit "false" (trimmed, case-insensitive) disables it, so
// an unset or malformed value never turns Google off by accident.
func googleAuthDisabled() bool {
	return strings.EqualFold(
		strings.TrimSpace(os.Getenv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED")),
		"false",
	)
}

// validateClaims enforces the claims the signature check cannot: a known
// audience (this project's client id), a Google issuer, a live token and a
// verified e-mail to resolve the user with.
func validateClaims(token *jwt.Token, clientID string) (*googleClaims, error) {
	claims, ok := token.Claims.(*googleClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	if claims.ExpiresAt == nil || !claims.ExpiresAt.After(clock()) {
		return nil, errors.New("token expired")
	}
	if len(claims.Audience) != 1 || claims.Audience[0] != clientID {
		return nil, errors.New("unexpected audience")
	}
	if claims.Issuer != issuerShort && claims.Issuer != issuerLong {
		return nil, errors.New("unexpected issuer")
	}
	if strings.TrimSpace(claims.Email) == "" || !claims.EmailVerified {
		return nil, errors.New("missing or unverified e-mail")
	}
	return claims, nil
}

// errorBody writes a JSON error with the given status. The `error` field is
// the stable code; `reason` is a human-readable detail.
func errorBody(ctx openruntimes.Context, status int, code, reason string) openruntimes.Response {
	return ctx.Res.Json(
		httpx.Error{Error: code, Reason: reason},
		ctx.Res.WithStatusCode(status),
	)
}

// appwriteOps is the Appwrite/Google-backed implementation of operations.
type appwriteOps struct {
	users *users.Users

	mu            sync.Mutex
	keys          map[string]*rsa.PublicKey
	keysFetchedAt time.Time
}

func newAppwriteOps(apiKey string) operations {
	clt := appwrite.NewClient(apiKey)
	return &appwriteOps{users: sdk.NewUsers(clt)}
}

// VerifyIDToken verifies the RS256 signature against Google's published keys.
// The parser also enforces the token's exp/nbf claims.
func (o *appwriteOps) VerifyIDToken(idToken string) (*jwt.Token, error) {
	var claims googleClaims
	return jwt.ParseWithClaims(
		idToken,
		&claims,
		func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			kid, _ := token.Header["kid"].(string)
			if key := o.cachedKey(kid); key != nil {
				return key, nil
			}
			// Unknown kid: the keys may have rotated since the last fetch, so
			// refresh once and retry before rejecting.
			if err := o.loadKeys(); err != nil {
				return nil, err
			}
			if key := o.cachedKey(kid); key != nil {
				return key, nil
			}
			return nil, fmt.Errorf("unknown key id %q", kid)
		},
		jwt.WithValidMethods([]string{"RS256"}),
	)
}

// cachedKey returns the key for kid while the cache is fresh, or nil. A nil
// (or stale-cache miss) forces loadKeys to refresh from Google.
func (o *appwriteOps) cachedKey(kid string) *rsa.PublicKey {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.keys == nil || clock().Sub(o.keysFetchedAt) >= keysTTL {
		return nil
	}
	return o.keys[kid]
}

// loadKeys fetches Google's JWKS document and parses every RSA signing key.
func (o *appwriteOps) loadKeys() error {
	resp, err := http.Get(googleCertsURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("google certs endpoint returned %d", resp.StatusCode)
	}
	var set struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return err
	}
	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, key := range set.Keys {
		parsed, err := parseRSAKey(key.N, key.E)
		if err != nil {
			continue
		}
		keys[key.Kid] = parsed
	}
	if len(keys) == 0 {
		return errors.New("google certs contained no usable keys")
	}

	o.mu.Lock()
	o.keys = keys
	o.keysFetchedAt = clock()
	o.mu.Unlock()
	return nil
}

// FindUserByEmail resolves the platform user for an e-mail. The users list is
// queried with an exact e-mail match; Appwrite returns an empty page when no
// user matches, which becomes a nil user (not an error).
func (o *appwriteOps) FindUserByEmail(email string) (*models.User, error) {
	result, err := o.users.List(
		o.users.WithListQueries([]string{query.Equal("email", email), query.Limit(2)}),
	)
	if err != nil {
		return nil, err
	}
	if len(result.Users) == 0 {
		return nil, nil
	}
	return &result.Users[0], nil
}

// CreateLoginToken creates the Appwrite login token. The browser finishes with
// `account.createSession(userId, secret)`, which consumes a token secret — not
// a session secret, which is why this uses users.createToken.
func (o *appwriteOps) CreateLoginToken(userID string) (*models.Token, error) {
	return o.users.CreateToken(userID)
}

// parseRSAKey decodes a JWK's base64url modulus and exponent into an RSA
// public key.
func parseRSAKey(nB64, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, fmt.Errorf("malformed modulus: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, fmt.Errorf("malformed exponent: %w", err)
	}
	e := new(big.Int).SetBytes(eBytes)
	if !e.IsInt64() || e.Int64() > int64(^uint32(0)) {
		return nil, errors.New("exponent out of range")
	}
	return &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: int(e.Int64())}, nil
}
