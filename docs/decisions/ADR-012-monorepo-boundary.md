# ADR-012: Monorepo Boundary — Functions Stay In-Repo

## Status

Accepted

## Context

The platform is a pnpm monorepo containing the Next.js applications, the shared
TypeScript packages, and the Go Appwrite Functions (`functions/`, see ADR-011).
The question arose whether `functions/` should instead live in a separate GitHub
repository.

The functions are not independent of the rest of the repo. They are coupled to
TypeScript sources of truth:

| Source of truth (TypeScript) | Consumed by the Go functions |
|---|---|
| `packages/provisioning/src/config.ts` — `DATABASE_ID` | `shared/appwrite/client.go` (literal constant) |
| `config.ts` — deterministic row ids `perm_*`, `feat_*`, `app_*` | `provision-organization` references them literally |
| `config.ts` — the 10 tables, their columns and indexes | every `GrantRepo` query (`organizationId`, `roleId`, `featureId`, `key`) |
| `packages/permissions` — the `resource.action` permission shape | `authorize()` checks `organizations.update`, `white-label` |
| Function ids and JSON contracts | `resolveGrants`, `TenantService.getProfile`, `createOrganization` |

Appwrite supports monorepos natively: the VCS integration takes a
`providerRootDirectory`, so a function can be pointed at `functions/<name>` in
this repository. There is no technical obstacle to keeping the functions here.

## Decision

Appwrite Functions remain in this monorepo, under `functions/`.

Rationale:

- **Atomic cross-cutting changes.** A change to the database schema, a permission
  key, or a function's JSON contract must land in both the TypeScript and Go
  sides at once. In one repository that is a single commit; across two it is a
  coordinated pair of PRs with an unavoidable window of inconsistency.
- **One source of truth.** The schema, the seed ids and the permission keys are
  defined once, in TypeScript, and read by the Go code. Splitting the repo would
  require duplicating or publishing that contract and versioning it.
- **Small team.** The coordination overhead of polyrepo is not repaid by any
  access-control or cadence benefit at the current scale.
- **Appwrite supports it.** `providerRootDirectory` makes the monorepo a
  first-class deployment target.

## Consequences

- A single CI runs both gates: `pnpm lint/typecheck/test/build` for the
  TypeScript side and `make -C functions build/vet/test` for the Go side.
- Deployment stays in `functions/scripts/deploy.sh`, driven by
  `make -C functions deploy` (all) or `make -C functions deploy-<name>` (one).
- The seed ids and permission keys are currently literal strings in the Go code.
  Any change to `packages/provisioning/src/config.ts` or
  `packages/permissions` must be reflected in the functions by hand.
- Repository access is all-or-nothing: anyone who can work on the frontend can
  read the security boundary's source.

## Revisit when

This decision should be reconsidered if any of the following becomes true:

- external contributors work on the frontend but must not access or change the
  security boundary;
- the functions' release cadence diverges substantially from the applications';
- the functions grow beyond Appwrite Functions into a standalone service;
- another product begins consuming the same functions;
- the duplicated-contract risk (see "Consequences") starts causing real drift,
  and a published, versioned contract becomes the better trade.
