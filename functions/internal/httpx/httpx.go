// Package httpx provides shared JSON request/response helpers for the
// Appwrite Go runtime.
package httpx

import (
	"github.com/open-runtimes/types-for-go/v4/openruntimes"
)

// Error is the standard error body returned by every function.
type Error struct {
	Error  string `json:"error"`
	Reason string `json:"reason"`
}

// BadRequest returns a 400 response.
func BadRequest(ctx openruntimes.Context, reason string) openruntimes.Response {
	return ctx.Res.Json(
		Error{Error: "bad_request", Reason: reason},
		ctx.Res.WithStatusCode(400),
	)
}

// Unauthorized returns a 401 response.
func Unauthorized(ctx openruntimes.Context, reason string) openruntimes.Response {
	return ctx.Res.Json(
		Error{Error: "unauthorized", Reason: reason},
		ctx.Res.WithStatusCode(401),
	)
}

// Forbidden returns a 403 response.
func Forbidden(ctx openruntimes.Context, reason string) openruntimes.Response {
	return ctx.Res.Json(
		Error{Error: "forbidden", Reason: reason},
		ctx.Res.WithStatusCode(403),
	)
}
