package handler

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/appwrite/sdk-for-go/v7/users"
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

	token       *models.Token
	tokenErr    error
	tokenUserID string
	tokenCalls  int
	verifyCalls int
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

func (f *fakeOps) CreateLoginToken(userID string) (*models.Token, error) {
	f.tokenCalls++
	f.tokenUserID = userID
	if f.tokenErr != nil {
		return nil, f.tokenErr
	}
	return f.token, nil
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
	if ops.tokenCalls != 0 {
		t.Fatal("no login token may be created when Google auth is disabled")
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
	if ops.tokenCalls != 0 {
		t.Fatal("no login token may be created for an unverified token")
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
		token: &models.Token{Id: "t1", UserId: "u1", Secret: "sec"},
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
	if ops.tokenCalls != 0 {
		t.Fatal("no login token may be created for an unknown e-mail")
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
	if ops.tokenCalls != 0 {
		t.Fatal("no login token may be created for a disabled account")
	}
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
	if ops.tokenCalls != 0 {
		t.Fatal("no login token may be created for an Appwrite-unverified e-mail")
	}
}

func TestMainLogsInAndReturnsCredentials(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, nil),
		usersByEmail: map[string]*models.User{
			"user@example.com": activeUser("u1", "user@example.com"),
		},
		token: &models.Token{Id: "t1", UserId: "u1", Secret: "the-secret"},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if ops.foundEmail != "user@example.com" {
		t.Fatalf("expected lookup by token e-mail, got %q", ops.foundEmail)
	}
	if ops.tokenUserID != "u1" {
		t.Fatalf("expected a login token for u1, got %q", ops.tokenUserID)
	}
	var out oneTapLoginResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if out.UserID != "u1" || out.Secret != "the-secret" {
		t.Fatalf("unexpected credentials %+v", out)
	}
}

func TestMainReturns500WhenTokenCreationFails(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken: googleToken(t, nil),
		usersByEmail: map[string]*models.User{
			"user@example.com": activeUser("u1", "user@example.com"),
		},
		tokenErr: errors.New("boom"),
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 500, "internal_error", "failed to create login token")
}

func TestMainRejectsAnEmptyLoginTokenSecret(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken:  googleToken(t, nil),
		usersByEmail: map[string]*models.User{"user@example.com": activeUser("u1", "user@example.com")},
		token:        &models.Token{Id: "t1", UserId: "u1", Secret: ""},
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 500, "internal_error", "failed to create login token")
}

func TestMainRejectsANilLoginToken(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", testClientID)
	ops := &fakeOps{
		verifyToken:  googleToken(t, nil),
		usersByEmail: map[string]*models.User{"user@example.com": activeUser("u1", "user@example.com")},
		token:        nil,
	}
	resp := handle(newContext(`{"idToken":"x"}`), ops)
	assertError(t, resp, 500, "internal_error", "failed to create login token")
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
	// Signed with a local key that is not in Google's JWKS. The JWKS fetch is
	// stubbed to fail, so the parse must return an error without any network.
	original := httpGet
	httpGet = func(string) (*http.Response, error) {
		return nil, errors.New("no network in tests")
	}
	t.Cleanup(func() { httpGet = original })
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

func TestVerifyIDTokenAcceptsARealSignedToken(t *testing.T) {
	claims := googleClaims{
		Email:         "user@example.com",
		EmailVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuerShort,
			Audience:  jwt.ClaimStrings{testClientID},
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-kid"
	signed, err := token.SignedString(testKey)
	if err != nil {
		t.Fatalf("could not sign token: %v", err)
	}

	ops := &appwriteOps{
		keys:          map[string]*rsa.PublicKey{"test-kid": &testKey.PublicKey},
		keysFetchedAt: clock(),
	}

	parsed, err := ops.VerifyIDToken(signed)
	if err != nil {
		t.Fatalf("VerifyIDToken rejected a valid token: %v", err)
	}
	got, err := validateClaims(parsed, testClientID)
	if err != nil {
		t.Fatalf("validateClaims rejected a valid token: %v", err)
	}
	if got.Email != "user@example.com" {
		t.Fatalf("expected the e-mail claim, got %q", got.Email)
	}
}

// signedTokenWithKid signs a token whose header carries the given kid, so
// VerifyIDToken's key selection can be exercised without a real Google key.
func signedTokenWithKid(t *testing.T, kid string) string {
	t.Helper()
	claims := googleClaims{
		Email:         "user@example.com",
		EmailVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuerShort,
			Audience:  jwt.ClaimStrings{testClientID},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	signed, err := token.SignedString(testKey)
	if err != nil {
		t.Fatalf("could not sign token: %v", err)
	}
	return signed
}

// jwksBody renders a valid JWKS document containing one RSA key under kid.
func jwksBody(t *testing.T, kid string) string {
	t.Helper()
	body, err := json.Marshal(map[string]interface{}{
		"keys": []map[string]string{{
			"kid": kid,
			"n":   base64.RawURLEncoding.EncodeToString(testKey.PublicKey.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(65537).Bytes()),
		}},
	})
	if err != nil {
		t.Fatalf("could not marshal JWKS: %v", err)
	}
	return string(body)
}

// stubHTTPGet replaces the JWKS fetch seam and returns a counter of the calls.
func stubHTTPGet(t *testing.T, body string) *int {
	t.Helper()
	calls := 0
	original := httpGet
	httpGet = func(string) (*http.Response, error) {
		calls++
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(body)),
		}, nil
	}
	t.Cleanup(func() { httpGet = original })
	return &calls
}

// An unknown kid on a fresh cache is attacker-controlled, so it must not force
// an outbound JWKS fetch more than once per cooldown.
func TestVerifyIDTokenCooldownBoundsForcedRefreshes(t *testing.T) {
	calls := stubHTTPGet(t, jwksBody(t, "rotated-kid"))

	ops := &appwriteOps{
		keys:              map[string]*rsa.PublicKey{"known-kid": &testKey.PublicKey},
		keysFetchedAt:     clock(),
		lastForcedRefresh: clock(),
	}

	if _, err := ops.VerifyIDToken(signedTokenWithKid(t, "attacker-kid")); err == nil {
		t.Fatal("expected verification to fail for an unknown kid")
	}
	if *calls != 0 {
		t.Fatalf("unknown kid on a fresh cache within the cooldown must not fetch, got %d", *calls)
	}

	// Once the cooldown has elapsed, one forced refresh is allowed so a real
	// rotation can be picked up.
	ops.lastForcedRefresh = clock().Add(-(forcedRefreshCooldown + time.Second))
	if _, err := ops.VerifyIDToken(signedTokenWithKid(t, "attacker-kid")); err == nil {
		t.Fatal("expected verification to fail for an unknown kid")
	}
	if *calls != 1 {
		t.Fatalf("expected exactly one forced refresh after the cooldown, got %d", *calls)
	}

	// A second unknown kid immediately afterwards stays inside the cooldown.
	if _, err := ops.VerifyIDToken(signedTokenWithKid(t, "another-attacker-kid")); err == nil {
		t.Fatal("expected verification to fail for an unknown kid")
	}
	if *calls != 1 {
		t.Fatalf("a second unknown kid within the cooldown must not fetch again, got %d", *calls)
	}
}

// A stale cache must be subject to the same cooldown as a fresh one: without
// it, an unknown kid on every request during a Google outage would re-attempt
// the outbound fetch indefinitely.
func TestVerifyIDTokenCooldownBoundsRefreshOnStaleCache(t *testing.T) {
	calls := stubHTTPGet(t, jwksBody(t, "rotated-kid"))

	ops := &appwriteOps{
		keys:              map[string]*rsa.PublicKey{"known-kid": &testKey.PublicKey},
		keysFetchedAt:     clock().Add(-(keysTTL + time.Second)),
		lastForcedRefresh: clock(),
	}

	if _, err := ops.VerifyIDToken(signedTokenWithKid(t, "attacker-kid")); err == nil {
		t.Fatal("expected verification to fail for an unknown kid on a stale cache")
	}
	if *calls != 0 {
		t.Fatalf("stale cache unknown kid within the cooldown must not fetch, got %d", *calls)
	}

	// Once the cooldown has elapsed the same stale cache is allowed one refresh
	// so a genuine rotation can still be picked up.
	ops.lastForcedRefresh = clock().Add(-(forcedRefreshCooldown + time.Second))
	if _, err := ops.VerifyIDToken(signedTokenWithKid(t, "attacker-kid")); err == nil {
		t.Fatal("expected verification to fail for an unknown kid")
	}
	if *calls != 1 {
		t.Fatalf("expected exactly one refresh after the cooldown on a stale cache, got %d", *calls)
	}
}

// A stale cache that still holds the requested kid keeps serving it while the
// cooldown blocks the refresh: the signature is still verified against a
// previously-fetched Google key, so availability is preserved.
func TestVerifyIDTokenServesStaleCachedKeyWhenCooldownBlocks(t *testing.T) {
	calls := stubHTTPGet(t, jwksBody(t, "rotated-kid"))

	ops := &appwriteOps{
		keys:              map[string]*rsa.PublicKey{"test-kid": &testKey.PublicKey},
		keysFetchedAt:     clock().Add(-(keysTTL + time.Second)),
		lastForcedRefresh: clock(),
	}

	if _, err := ops.VerifyIDToken(signedTokenWithKid(t, "test-kid")); err != nil {
		t.Fatalf("expected the stale cached key to verify the token, got %v", err)
	}
	if *calls != 0 {
		t.Fatalf("serving a stale cached key within the cooldown must not fetch, got %d", *calls)
	}
}

// Appwrite stores normalised lower-case e-mails, so a mixed-case Google claim
// must be normalised before the lookup or a real user would fail to match.
func TestFindUserByEmailQueriesWithNormalisedEmail(t *testing.T) {
	var gotQueries []string
	original := listUsers
	listUsers = func(_ *users.Users, queries []string) (*models.UserList, error) {
		gotQueries = queries
		return &models.UserList{Users: []models.User{*activeUser("u1", "user@example.com")}}, nil
	}
	t.Cleanup(func() { listUsers = original })

	user, err := (&appwriteOps{}).FindUserByEmail("  User@Example.COM ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user == nil || user.Id != "u1" {
		t.Fatalf("expected the normalised lookup to find u1, got %+v", user)
	}
	joined := strings.Join(gotQueries, " ")
	if !strings.Contains(joined, "user@example.com") {
		t.Fatalf("expected a lower-cased e-mail query, got %q", joined)
	}
	if strings.Contains(joined, "User@Example.COM") {
		t.Fatalf("query must not use the raw mixed-case e-mail: %q", joined)
	}
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
