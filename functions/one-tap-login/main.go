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
	"io"
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

// forcedRefreshCooldown bounds how often an outbound JWKS refresh can happen,
// covering both the unknown-kid rotation path and the periodic TTL refresh. A
// token's kid is attacker-controlled until the signature is verified, and a
// stale cache would otherwise refetch on every request, so without a cooldown
// either path would turn this function into a request amplifier pointed at
// Google.
const forcedRefreshCooldown = 30 * time.Second

// maxStaleKeysAge caps how old a cached key set may be before it stops being
// served as an availability fallback. The stale-serve path is fail-open: during
// a Google outage where loadKeys keeps failing, lastForcedRefresh keeps
// advancing and the old cache would otherwise verify tokens for the whole
// outage — including a key Google revoked just before it began. Capping at 24h
// (twice keysTTL) bounds that. The tradeoff: a longer cap keeps One Tap logins
// working through a longer outage, but trusts a possibly-revoked key for
// longer; past the cap the function fails closed and logins are unavailable
// until Google's certs endpoint recovers. One day is well beyond any normal
// rotation cadence and short enough that a revoked key cannot survive
// indefinitely.
const maxStaleKeysAge = 24 * time.Hour

// maxJWKSBodyBytes caps how much of the certs response is read, so a hostile
// or misbehaving endpoint cannot exhaust the function's memory.
const maxJWKSBodyBytes = 1 << 20 // 1 MiB

// httpClient bounds the outbound JWKS request; httpGet is the seam tests stub
// so the refresh path is exercisable without a live Google endpoint.
var (
	httpClient = &http.Client{Timeout: 5 * time.Second}
	httpGet    = func(url string) (*http.Response, error) { return httpClient.Get(url) }
)

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
	errAccountMismatch    = "account_mismatch"
	errConfigMissing      = "config_missing"
	errGoogleAuthDisabled = "google_auth_disabled"
	errInternal           = "internal_error"
)

// clock is the time source for claim validation. Overridden in tests.
var clock = time.Now

// oneTapLoginRequest is the browser's body: the ID token from Google One Tap.
// ExpectedUserID is optional: when set, the function only issues a login token
// if the resolved user matches it, so a session-expired re-auth cannot be
// silently completed for a different account.
type oneTapLoginRequest struct {
	IDToken        string `json:"idToken"`
	ExpectedUserID string `json:"expectedUserId"`
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

	// Optional account binding: when the client names the user it expects, a
	// token for any other user is refused. This is the session-expired re-auth
	// guard — no login token may be created on this path.
	if expected := strings.TrimSpace(body.ExpectedUserID); expected != "" && user.Id != expected {
		ctx.Log(map[string]interface{}{"action": "one_tap.rejected", "reason": "account_mismatch"})
		return errorBody(ctx, http.StatusForbidden, errAccountMismatch, "token requested for a different account")
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

	mu                sync.Mutex
	keys              map[string]*rsa.PublicKey
	keysFetchedAt     time.Time
	lastForcedRefresh time.Time
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
			key, fresh := o.cachedKey(kid)
			if key != nil && fresh {
				return key, nil
			}
			// A missing kid on a fresh cache is the rotation path, and a stale
			// cache needs a periodic refresh; both would call loadKeys. The kid
			// is attacker-controlled until the signature is verified, so a
			// single cooldown bounds either. When the cooldown blocks the
			// refresh, a stale cache may still hold the requested key; it is
			// served as an availability fallback only while it is within
			// maxStaleKeysAge, otherwise the request fails closed.
			if !o.beginForcedRefresh() {
				if key != nil && o.withinStaleCap() {
					return key, nil
				}
				return nil, fmt.Errorf("unknown key id %q", kid)
			}
			if err := o.loadKeys(); err != nil {
				// Deliberately fail closed even though the stale cache may
				// still hold a usable key: this request won the refresh slot,
				// so the failed fetch — not merely an expired TTL — is the
				// signal to stop trusting the cache. This is the asymmetry
				// with the cooldown-blocked branch above, which may serve a
				// cap-bounded stale key because it cannot refresh right now.
				return nil, err
			}
			if key, _ := o.cachedKey(kid); key != nil {
				return key, nil
			}
			return nil, fmt.Errorf("unknown key id %q", kid)
		},
		jwt.WithValidMethods([]string{"RS256"}),
	)
}

// cachedKey returns the key for kid and whether the cache was fresh. A nil key
// with a fresh cache means the kid is unknown; a stale cache still returns any
// key it holds, so an availability fallback can serve it when a refresh is
// suppressed.
func (o *appwriteOps) cachedKey(kid string) (*rsa.PublicKey, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	fresh := o.keys != nil && clock().Sub(o.keysFetchedAt) < keysTTL
	return o.keys[kid], fresh
}

// withinStaleCap reports whether the cached key set is recent enough to serve
// as an availability fallback. Beyond maxStaleKeysAge a key may have been
// revoked after it was fetched, so it is no longer served.
func (o *appwriteOps) withinStaleCap() bool {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.keys != nil && clock().Sub(o.keysFetchedAt) <= maxStaleKeysAge
}

// beginForcedRefresh reports whether an outbound refresh is allowed now,
// recording the attempt so repeated untrusted kids and stale caches cannot
// force a fetch on every request. It bounds both the unknown-kid rotation path
// and the periodic TTL refresh.
func (o *appwriteOps) beginForcedRefresh() bool {
	o.mu.Lock()
	defer o.mu.Unlock()
	if clock().Sub(o.lastForcedRefresh) < forcedRefreshCooldown {
		return false
	}
	o.lastForcedRefresh = clock()
	return true
}

// loadKeys fetches Google's JWKS document and parses every RSA signing key.
func (o *appwriteOps) loadKeys() error {
	resp, err := httpGet(googleCertsURL)
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
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxJWKSBodyBytes)).Decode(&set); err != nil {
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

// listUsers is the seam over the SDK's users.List so FindUserByEmail's query
// is unit-testable without an Appwrite backend.
var listUsers = func(u *users.Users, queries []string) (*models.UserList, error) {
	return u.List(u.WithListQueries(queries))
}

// FindUserByEmail resolves the platform user for an e-mail. Appwrite stores
// normalised lower-case e-mails, so the claim is trimmed and lower-cased before
// the exact-match query; an empty page becomes a nil user (not an error).
func (o *appwriteOps) FindUserByEmail(email string) (*models.User, error) {
	normalised := strings.ToLower(strings.TrimSpace(email))
	result, err := listUsers(o.users, []string{query.Equal("email", normalised), query.Limit(2)})
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
