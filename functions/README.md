# Functions

Appwrite Functions for the Cdorneles Platform. These are the **security
boundary** for business operations (ADR-005, ADR-011): every sensitive
operation validates authentication, membership, organization status,
application access, permission and feature flags server-side. Deny-by-default.

Functions are written in **Go**.

## Appwrite Go runtime contract

Appwrite's Go runtime always compiles the function **from source** — there is no
pre-built binary path. Its build step runs:

```bash
cd /usr/local/server/src
go get openruntimes/handler@v0.0.0   # replace => /usr/local/build (the function dir)
go build -ldflags="-s -w"
```

with the server module declaring:

```
replace openruntimes/handler v0.0.0 => /usr/local/build
require openruntimes/handler v0.0.0
```

Two consequences shape this directory:

1. **Each function is its own Go module named `openruntimes/handler`**, with
   `main.go` at its root.
2. **Only the function's own directory exists at build time**, so shared code
   cannot be imported across functions.

The handler signature is fixed:

```go
package handler

func Main(ctx openruntimes.Context) openruntimes.Response
```

## Layout

```text
functions/
├── shared/                    # source of truth for shared packages
│   ├── authz/                 # effective-access evaluation (ADR-005)
│   ├── appwrite/              # SDK client + authz.GrantRepo implementation
│   └── httpx/                 # JSON error helpers
├── resolve-grants/            # module openruntimes/handler
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   └── internal/              # GENERATED from shared/ — do not edit
├── update-organization-profile/
├── send-email/
├── scripts/
│   ├── prepare.sh             # copies shared/ into each function's internal/
│   └── deploy.sh              # prepares and deploys every function
└── Makefile
```

`*/internal/` is **generated**. Edit `shared/` instead, then run `make prepare`.
The generated directories are gitignored.

## Functions

| Function | Purpose | Authorization |
|---|---|---|
| `resolve-grants` | Resolves a user's effective permissions and features for an organization + application | Authenticated; identity must match the body `userId`; membership required |
| `update-organization-profile` | Updates organization branding (display name, colors, logos) | Full `authorize()`: membership, active org, application, `organizations.update`, `white-label` |
| `send-email` | Sends transactional email via Appwrite Messaging | Authenticated |

## Requirements

- Go **1.26.8** (the Appwrite 2.x Go SDK requires `go >= 1.26.5`).
- The Appwrite CLI, logged in against the target instance, for deployment.

## Commands

```bash
make prepare   # materialise shared/ into each function's internal/
make build     # compile-check every function module
make test      # prepare + go test ./... in each function
make vet       # prepare + go vet ./... in each function
make fmt       # gofmt -w shared
make clean     # remove generated internal/ directories
```

Run a single function's tests directly:

```bash
make prepare
cd resolve-grants && go test ./...
```

## Deploy

```bash
./scripts/deploy.sh
```

The script runs `make prepare` and then, for each function, uploads the
function's directory as source with entrypoint `main.go`:

```bash
appwrite functions createDeployment \
  --functionId <function> \
  --entrypoint "main.go" \
  --code <function> \
  --activate true
```

Appwrite compiles the uploaded source. The runtime's environment provides
`APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID`, and the
per-execution API key arrives as the `x-appwrite-key` request header.

## Adding a function

1. Create the directory and module:

   ```bash
   mkdir my-function && cd my-function
   go mod init openruntimes/handler
   ```

2. Add `main.go` in `package handler` exporting `func Main(ctx openruntimes.Context) openruntimes.Response`.

3. Import shared code as `openruntimes/handler/internal/...` (for example
   `openruntimes/handler/internal/httpx`), then run `make prepare` from
   `functions/` so the package is materialised.

4. Add the function to `FUNCTIONS` in the `Makefile` and to the loop in
   `scripts/deploy.sh`.

5. `make build && make test`, then commit.

## Conventions

- Read the per-execution key from `ctx.Req.Headers["x-appwrite-key"]`; never
  hardcode credentials.
- Use the `httpx` helpers for `400`/`401`/`403` responses so error shapes stay
  consistent with the frontend contract.
- Never treat a client-supplied `tenantId`/`organizationId` as the source of
  tenant identity on its own — always resolve membership server-side.
- Keep the HTTP contract stable: `@cdorneles/permissions` and the apps depend on
  the exact request/response shapes.
- Never log passwords, tokens, API keys or session secrets.

## Related

- `docs/decisions/ADR-005-authorization.md`
- `docs/decisions/ADR-011-go-functions.md`
- `docs/authorization/README.md`
- `AGENTS.md`
