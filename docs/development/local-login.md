# Local development login

How to get a working login against a local (or self-hosted) Appwrite
environment. All commands run from the repository root.

## Prerequisites

- Node.js `>= 22`, pnpm `>= 11`
- An Appwrite instance reachable from your machine
- `.env` at the repository root with at least:
  - `APPWRITE_ENDPOINT` / `APPWRITE_PROJECT_ID` (or their `NEXT_PUBLIC_*`
    counterparts — the provisioning package accepts both)
  - `APPWRITE_API_KEY` (server key; **never** expose it in `NEXT_PUBLIC_*`)
  - optionally `NEXT_PUBLIC_PLATFORM_TEAM_ID` — when set, `owner@demo.local`
    is added to the platform team and gets `organizations.create` plus the
    other platform capabilities

## Steps

```bash
pnpm install
cp .env.example .env   # then fill in the values
pnpm provision         # seeds the database schema: applications, permissions, features
pnpm seed:dev          # creates demo users, organizations, memberships, roles, features
pnpm dev:client        # http://localhost:3002
```

Run `pnpm provision` once per environment (it is idempotent). Run
`pnpm seed:dev` whenever you want to (re)create the demo data — it is safe to
re-run.

## Demo accounts

Password for all accounts: **`SenhaDemo123!`** (defined as `DEMO_PASSWORD` in
`packages/provisioning/src/seed-dev.ts`, and printed by the seed when it
finishes).

| E-mail              | Password        | Role                                                        |
| ------------------- | --------------- | ----------------------------------------------------------- |
| `owner@demo.local`  | `SenhaDemo123!` | Owner in Acme **and** Globex; platform team member          |
| `admin@demo.local`  | `SenhaDemo123!` | Admin in Acme                                               |
| `member@demo.local` | `SenhaDemo123!` | Member in Acme — read permissions, client application only  |

Log in at `/login`:

| App           | URL                                        |
| ------------- | ------------------------------------------ |
| client        | <http://localhost:3002/login>              |
| admin         | <http://localhost:3001/login>              |
| design-system | <http://localhost:3004/login> (auth gallery, no redirect) |

What each account exercises:

- **owner** — two organizations (org switcher) and, with the platform team
  configured, `organizations.create` (the "create organization" item).
- **admin** — everything but `features.manage`; both applications.
- **member** — read-only permissions, `app_client` only (the admin app should
  reject the session).

## What the seed creates

`pnpm seed:dev` (`packages/provisioning/src/seed-dev.ts`) is create-if-missing
and idempotent. Per run it:

1. Creates the demo users (resetting their password to `DEMO_PASSWORD` so the
   accounts always log in).
2. Creates the `demo-acme` and `demo-globex` teams with
   `organization_profiles` rows.
3. Creates the per-organization `owner` / `admin` / `member` roles with the
   same shape `provision-organization` produces, plus `role_permissions` and
   `role_applications`.
4. Creates one `organization_features` row per seeded feature (only
   `white-label` enabled by default).
5. Creates **confirmed** memberships (no e-mail invite) for the demo users:
   owner in both organizations, admin and member in Acme.

Note: memberships are created over the raw REST endpoint with `confirm: true`
because the Node SDK's typed params dropped the flag. Without it the membership
stays "invited" and invisible to `Teams.list` until the invite is accepted.

## Troubleshooting

| Symptom                                   | Cause / fix                                                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing env vars` from `pnpm seed:dev`   | Set `APPWRITE_API_KEY` plus `APPWRITE_ENDPOINT`/`APPWRITE_PROJECT_ID` (or `NEXT_PUBLIC_*`) in `.env`.                                               |
| Connection error / timeout                | Appwrite not running, or the endpoint in `.env` is not reachable from where you run the seed (e.g. `localhost` inside vs outside a container network). |
| Login fails with valid credentials        | Seed did not run against the same project the app points at — compare `NEXT_PUBLIC_APPWRITE_PROJECT_ID` in the app's env with the seed's.           |
| User sees no organizations after login    | Memberships were created unconfirmed, or the user is only in organizations whose profile/roles were not provisioned — re-run `pnpm provision` then `pnpm seed:dev`. |
| Admin app rejects a `member@demo.local` session | Expected: the member role grants `app_client` only.                                                                                        |

## Security notes

- `SenhaDemo123!` and the `*.local` accounts are for **local development
  only**. Never seed demo accounts into a shared or production environment.
- `APPWRITE_API_KEY` is server-side only and must never be committed or
  exposed through `NEXT_PUBLIC_*` variables.
