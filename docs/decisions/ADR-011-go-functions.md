# ADR-011: Go for Appwrite Functions

## Status

Accepted

## Context

Appwrite Functions are the platform's security boundary. They were initially
written in TypeScript, bundled with esbuild, with shared authorization logic in
`@cdorneles/authz`.

Appwrite's Go runtime imposes a specific deployment contract:

- The runtime **always compiles from source** — there is no pre-built binary
  path. Its `compile.sh` runs `go get openruntimes/handler@v0.0.0` and
  `go build` against the function's own directory mounted at `/usr/local/build`.
- The server module declares `replace openruntimes/handler v0.0.0 => /usr/local/build`.
- Therefore each function must be a **standalone Go module named
  `openruntimes/handler`**, with `main.go` at its root exporting
  `func Main(ctx openruntimes.Context) openruntimes.Response` in `package handler`.
- Only the function's own directory is available at build time, so shared code
  cannot be imported across functions.

## Decision

Appwrite Functions are written in **Go**.

- Each function is its own module named `openruntimes/handler`.
- Shared code lives in `functions/shared/` (`authz`, `appwrite`, `httpx`) as the
  source of truth.
- `functions/scripts/prepare.sh` materialises `shared/` into each function's
  `internal/` directory (generated, gitignored) before building, testing or
  deploying. This is how DRY is preserved despite Appwrite's per-function build
  isolation.
- `functions/Makefile` drives `prepare`, `build`, `vet`, `test`, `fmt`, `clean`.
- Deployment uploads the function's source directory with entrypoint `main.go`.
- The HTTP contract (paths, request/response JSON, status codes) is unchanged
  from the TypeScript implementation, so no client code changes were required.

## Consequences

- The security boundary is compile-time type-safe and built by Appwrite from
  source, matching the runtime's supported path.
- `@cdorneles/authz` and the TypeScript functions are removed; the Go
  `internal/authz` port is the single source of truth.
- Contributors need the Go toolchain (`go 1.26.8`; the Appwrite 2.x Go SDK
  requires `go >= 1.26.5`).
- `pnpm lint/typecheck/test/build` no longer cover functions; `make -C functions test`
  does.
- `functions/*/internal/` is generated — never edit it by hand; edit
  `functions/shared/` instead.
