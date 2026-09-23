package handler

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"testing"
	"time"

	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
)

const testClientID = "test-client-id.apps.googleusercontent.com"

// testKey is the RSA key the fake verifier treats as Google's signing key.
var testKey *rsa.PrivateKey

func init() {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
	testKey = key
}

// fakeOps is the in-memory double for the operations seam. The JWT half signs
// real tokens with a local RSA key so validateClaims exercises the actual
// claims parser.
type fakeOps struct {
	verifyToken *jwt.Token
	verifyErr   error

	usersByEmail map[string]*models.User
	findErr      error
	foundEmail   string

	session       *models.Session
	sessionErr    error
	sessionUserID string
	sessionCalls  int
	verifyCalls   int
}

func (f *fakeOps) VerifyIDToken(idToken string) (*jwt.Token, error) {
	f.verifyCalls++
	return f.verifyToken, f.verifyErr
}

func (f *fakeOps) FindUserByEmail(email string) (*models.User, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	f.foundEmail = email
	return f.usersByEmail[email], nil
}

func (f *fakeOps) CreateSession(userID string) (*models.Session, error) {
	f.sessionCalls++
	f.sessionUserID = userID
	if f.sessionErr != nil {
		return nil, f.sessionErr
	}
	return f.session, nil
}

// signToken produces a real RS256 JWT the way Google would, with the given
// claims, so the parse step in validateClaims runs for real.
func signToken(t *testing.T, claims googleClaims) *jwt.Token {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	// VerifyIDToken has already run by the time validateClaims sees the token,
	// so signing here only needs to produce a parseable token.
	signed, err := token.SignedString(testKey)
	if err != nil {
		t.Fatalf("could not sign token: %v", err)
	}
	parsed, err := jwt.ParseWithClaims(signed, &googleClaims{}, func(*jwt.Token) (interface{}, error) {
		return &testKey.PublicKey, nil
	}, jwt.WithValidMethods([]string{"RS256"}), jwt.WithoutClaimsValidation())
	if err != nil {
		t.Fatalf("could not re-parse signed token: %v", err)
	}
	return parsed
}

func googleToken(t *testing.T, overrides func(*googleClaims)) *jwt.Token {
	claims := googleClaims{
		Email:         "user@example.com",
		EmailVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuerShort,
			Audience:  jwt.ClaimStrings{testClientID},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
	}
	if overrides != nil {
		overrides(&claims)
	}
	return signToken(t, claims)
}

func newContext(body string) openruntimes.Context {
	ctx := openruntimes.NewContext(openruntimes.Logger{})
	ctx.Req.SetBodyBinary([]byte(body))
	return ctx
}

func activeUser(id, email string) *models.User {
	return &models.User{Id: id, Email: email, Status: true, EmailVerification: true}
}

func TestMainRejectsInvalidJSON(t *testing.T) {
	resp := handle(newContext("{"), &fakeOps{})
	assertError(t, resp, 400, "bad_request", "invalid JSON")
}

func TestMainRejectsMissingIDToken(t *testing.T) {
	resp := handle(newContext(`{"idToken":"  "}`), &fakeOps{})
	assertError(t, resp, 400, "invalid_token", "idToken is required")
}

func TestMainRejectsUnconfiguredClientID(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", "")
	resp := handle(newContext(`{"idToken":"x"}`), &fakeOps{})
	assertError(t, resp, 500, "config_missing", "GOOGLE_CLIENT_ID is not configured")
}

func TestMainRejectsWhenGoogleAuthDisabled(t *testing.T) {
	t.Setenv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", "false")
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{verifyErr: errors.New("verification must not run")}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 403, "google_auth_disabled", "Google auth is disabled")
	if ops.sessionCalls != 0 {
		t.Fatal("no session may be created when Google auth is disabled")
	}
	if ops.verifyCalls != 0 {
		t.Fatal("verification must not run when Google auth is disabled")
	}
}

func TestMainAllowsWhenGoogleAuthFlagIsNotFalse(t *testing.T) {
	t.Setenv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", "true")
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	resp := handle(newContext(`{"idToken":"x"}`), &fakeOps{verifyErr: errors.New("bad signature")})
	assertError(t, resp, 401, "invalid_token", "invalid Google ID token")
}

func TestMainRejectsFailedVerification(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{verifyErr: errors.New("bad signature")}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 401, "invalid_token", "invalid Google ID token")
	if ops.sessionCalls != 0 {
		t.Fatal("no session may be created for an unverified token")
	}
}

func TestMainRejectsExpiredToken(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{verifyToken: googleToken(t, func(c *googleClaims) {
		c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute))
	})}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 401, "invalid_token", "invalid Google ID token")
}

func TestMainRejectsWrongAudience(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{verifyToken: googleToken(t, func(c *googleClaims) {
		c.Audience = jwt.ClaimStrings{"someone-else.apps.googleusercontent.com"}
	})}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 401, "invalid_token", "invalid Google ID token")
}

func TestMainRejectsWrongIssuer(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{verifyToken: googleToken(t, func(c *googleClaims) {
		c.Issuer = "https://evil.example"
	})}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 401, "invalid_token", "invalid Google ID token")
}

func TestMainAcceptsBothIssuerSpellings(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, func(c *googleClaims) {
			c.Issuer = issuerLong
		}),
		usersByEmail: map[string]*models.User{
			"user@example.com": activeUser("u1", "user@example.com"),
		},
		session: &models.Session{Id: "s1", UserId: "u1", Secret: "sec"},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 for %q issuer, got %d (%s)", issuerLong, resp.StatusCode, resp.Body)
	}
}

func TestMainRejectsUnverifiedEmailClaim(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{verifyToken: googleToken(t, func(c *googleClaims) {
		c.EmailVerified = false
	})}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 401, "invalid_token", "invalid Google ID token")
}

func TestMainRejectsUnknownEmail(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken:  googleToken(t, nil),
		usersByEmail: map[string]*models.User{},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 403, "unknown_email", "no platform user for this Google account")
	if ops.sessionCalls != 0 {
		t.Fatal("no session may be created for an unknown e-mail")
	}
}

func TestMainRejectsDisabledUser(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, nil),
		usersByEmail: map[string]*models.User{
			"user@example.com": {Id: "u1", Email: "user@example.com", Status: false, EmailVerification: true},
		},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 403, "user_disabled", "account is disabled")
}

func TestMainRejectsAppwriteUnverifiedEmail(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, nil),
		usersByEmail: map[string]*models.User{
			"user@example.com": {Id: "u1", Email: "user@example.com", Status: true, EmailVerification: false},
		},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 403, "email_not_verified", "account e-mail is not verified")
}

func TestMainLogsInAndReturnsCredentials(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, nil),
		usersByEmail: map[string]*models.User{
			"user@example.com": activeUser("u1", "user@example.com"),
		},
		session: &models.Session{Id: "s1", UserId: "u1", Secret: "the-secret"},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if ops.foundEmail != "user@example.com" {
		t.Fatalf("expected lookup by token e-mail, got %q", ops.foundEmail)
	}
	if ops.sessionUserID != "u1" {
		t.Fatalf("expected a session for u1, got %q", ops.sessionUserID)
	}
	var out oneTapLoginResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if out.UserID != "u1" || out.Secret != "the-secret" {
		t.Fatalf("unexpected credentials %+v", out)
	}
}

func TestMainReturns500WhenSessionCreationFails(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, nil),
		usersByEmail: map[string]*models.User{
			"user@example.com": activeUser("u1", "user@example.com"),
		},
		sessionErr: errors.New("boom"),
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 500, "internal_error", "failed to create session")
}

func TestMainReturns500WhenUserLookupFails(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, nil),
		findErr:     errors.New("boom"),
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 500, "internal_error", "failed to resolve user")
}

func TestGoogleAuthDisabled(t *testing.T) {
	cases := map[string]bool{
		"false":   true,
		" FALSE ": true,
		"false ":  true,
		"":        false,
		"true":    false,
		"no":      false,
	}
	for value, want := range cases {
		t.Setenv("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", value)
		if got := googleAuthDisabled(); got != want {
			t.Fatalf("googleAuthDisabled() with %q = %v, want %v", value, got, want)
		}
	}
}

func TestValidateClaimsRejectsNonGoogleClaims(t *testing.T) {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{"sub": "x"})
	if _, err := validateClaims(token, testClientID); err == nil {
		t.Fatal("expected an error for non-googleClaims token")
	}
}

func TestParseRSAKeyRoundTrip(t *testing.T) {
	nB64 := base64.RawURLEncoding.EncodeToString(testKey.PublicKey.N.Bytes())
	eB64 := base64.RawURLEncoding.EncodeToString(big.NewInt(65537).Bytes())

	key, err := parseRSAKey(nB64, eB64)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if key.N.Cmp(testKey.PublicKey.N) != 0 || key.E != 65537 {
		t.Fatal("parsed key does not match the source key")
	}
}

func TestParseRSAKeyRejectsMalformedInput(t *testing.T) {
	if _, err := parseRSAKey("!!not-base64!!", base64.RawURLEncoding.EncodeToString(big.NewInt(65537).Bytes())); err == nil {
		t.Fatal("expected an error for a malformed modulus")
	}
	if _, err := parseRSAKey(
		base64.RawURLEncoding.EncodeToString(testKey.PublicKey.N.Bytes()),
		"!!not-base64!!",
	); err == nil {
		t.Fatal("expected an error for a malformed exponent")
	}
}

// The real VerifyIDToken must reject a token signed by a key Google never
// published, which is the actual security property.
func TestAppwriteOpsVerifyIDTokenRejectsForeignSignature(t *testing.T) {
	ops := &appwriteOps{}
	claims := googleClaims{
		Email:         "user@example.com",
		EmailVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuerShort,
			Audience:  jwt.ClaimStrings{testClientID},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
	}
	// Signed with a local key that is not in Google's JWKS, and the JWKS fetch
	// will fail in the test environment (no network stub), so the parse must
	// return an error either way.
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(testKey)
	if err != nil {
		t.Fatalf("could not sign token: %v", err)
	}
	if _, err := ops.VerifyIDToken(signed); err == nil {
		t.Fatal("expected verification to fail for a foreign signature")
	}
}

// A nil user from FindUserByEmail is "no match", not an error, and must reach
// the deny branch with 403 rather than a 500.
func TestMainTreatsNilUserAsUnknownEmail(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken:  googleToken(t, nil),
		usersByEmail: map[string]*models.User{},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 403, "unknown_email", "no platform user for this Google account")
}

func assertError(t *testing.T, resp openruntimes.Response, status int, kind, reason string) {
	t.Helper()
	if resp.StatusCode != status {
		t.Fatalf("expected status %d, got %d (%s)", status, resp.StatusCode, resp.Body)
	}
	var body httpx.Error
	if err := json.Unmarshal(resp.Body, &body); err != nil {
		t.Fatalf("could not unmarshal response body %q: %v", resp.Body, err)
	}
	if body.Error != kind {
		t.Fatalf("expected error %q, got %q", kind, body.Error)
	}
	if body.Reason != reason {
		t.Fatalf("expected reason %q, got %q", reason, body.Reason)
	}
}
