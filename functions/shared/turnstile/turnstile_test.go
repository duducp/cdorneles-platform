package turnstile

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func withSiteverify(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	previous := siteverifyURL
	siteverifyURL = server.URL
	t.Cleanup(func() { siteverifyURL = previous })
}

func TestVerifyAcceptsSuccess(t *testing.T) {
	withSiteverify(t, func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("form: %v", err)
		}
		if got := r.FormValue("secret"); got != "s3cret" {
			t.Errorf("secret = %q", got)
		}
		if got := r.FormValue("response"); got != "tok" {
			t.Errorf("response = %q", got)
		}
		if got := r.FormValue("remoteip"); got != "203.0.113.9" {
			t.Errorf("remoteip = %q", got)
		}
		_, _ = w.Write([]byte(`{"success":true}`))
	})
	if err := Verify("s3cret", "tok", "203.0.113.9"); err != nil {
		t.Fatalf("Verify = %v", err)
	}
}

func TestVerifyDeniesRejection(t *testing.T) {
	// The token sentinel is distinctive: a bare "tok" would false-positive on
	// the word "token" in ErrInvalid's own message.
	const token = "tok-canary-7f3a"
	withSiteverify(t, func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("form: %v", err)
		}
		if got := r.FormValue("remoteip"); got != "" {
			t.Errorf("remoteip = %q, want absent", got)
		}
		if _, present := r.Form["remoteip"]; present {
			t.Error("remoteip present in form, want omitted when blank")
		}
		_, _ = w.Write([]byte(`{"success":false,"error-codes":["timeout-or-duplicate"]}`))
	})
	var invalid *ErrInvalid
	if err := Verify("s3cret", token, ""); !errors.As(err, &invalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	} else if strings.Contains(err.Error(), "s3cret") || strings.Contains(err.Error(), token) {
		t.Errorf("err = %q must not leak secret or token", err.Error())
	}
	if len(invalid.Codes) != 1 || invalid.Codes[0] != "timeout-or-duplicate" {
		t.Fatalf("codes = %v", invalid.Codes)
	}
}

func TestVerifyDeniesMissingSecret(t *testing.T) {
	if err := Verify("  ", "tok", ""); !errors.Is(err, ErrMissingSecret) {
		t.Fatalf("err = %v, want ErrMissingSecret", err)
	}
}

func TestVerifyDeniesEmptyToken(t *testing.T) {
	var invalid *ErrInvalid
	if err := Verify("s3cret", " ", ""); !errors.As(err, &invalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
}

func TestVerifyDeniesNetworkFailure(t *testing.T) {
	previous := siteverifyURL
	siteverifyURL = "http://127.0.0.1:1/siteverify"
	t.Cleanup(func() { siteverifyURL = previous })
	const token = "tok-canary-7f3a"
	var unavailable *ErrUnavailable
	if err := Verify("s3cret", token, ""); !errors.As(err, &unavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	} else if strings.Contains(err.Error(), "s3cret") || strings.Contains(err.Error(), token) {
		t.Errorf("err = %q must not leak secret or token", err.Error())
	}
}

func TestVerifyDeniesNon200AndBadJSON(t *testing.T) {
	for _, payload := range []string{`oops`, `{"success":}`} {
		withSiteverify(t, func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(payload))
		})
		var unavailable *ErrUnavailable
		if err := Verify("s3cret", "tok", ""); !errors.As(err, &unavailable) {
			t.Fatalf("payload %q: err = %v, want ErrUnavailable", payload, err)
		}
	}
}
