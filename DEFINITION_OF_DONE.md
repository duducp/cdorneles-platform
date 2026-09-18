# Definition of Done

A task is complete only when the applicable checks below pass.

## Functional

- [ ] Requested behavior is implemented.
- [ ] Existing behavior is preserved.
- [ ] Edge cases are handled.
- [ ] Loading, empty, and error states are considered.

## Architecture

- [ ] Existing shared capabilities were searched first.
- [ ] No unnecessary duplicate abstraction was created.
- [ ] Correct package/app boundary was used.
- [ ] No architectural rule was bypassed.
- [ ] Architectural changes have approval and documentation.

## Types

- [ ] TypeScript types are explicit and safe.
- [ ] No unjustified `any`.
- [ ] Shared types/schemas are reused when appropriate.

## Security

- [ ] Authentication is validated where required.
- [ ] Authorization is enforced at the backend boundary.
- [ ] Tenant isolation is preserved.
- [ ] Client-supplied tenant identifiers are not blindly trusted.
- [ ] Secrets and credentials are not logged or exposed.
- [ ] Administrative actions are audited where required.

## UI

- [ ] Existing `@cdorneles/ui` components were reused where possible.
- [ ] Design tokens are used.
- [ ] Light theme works.
- [ ] Dark theme works.
- [ ] Mobile works.
- [ ] Tablet works.
- [ ] Desktop works.
- [ ] Large desktop works.
- [ ] Keyboard accessibility works.
- [ ] Focus states are visible.
- [ ] Semantic labels are present.
- [ ] Motion respects accessibility preferences where applicable.

## Data

- [ ] Server state uses TanStack Query.
- [ ] Forms use Mantine Form where appropriate.
- [ ] Validation uses Zod.
- [ ] Appwrite access is appropriately encapsulated.

## Tests

- [ ] Unit tests added/updated for meaningful logic.
- [ ] Integration/E2E tests added when applicable.
- [ ] Regression coverage exists for important fixes.

## Quality

- [ ] ESLint passes.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] No debug code remains.
- [ ] No secrets are committed.

## Documentation

Documentation must be updated when:

- architecture changes;
- a new reusable pattern is introduced;
- a new security rule is introduced;
- an important Appwrite convention changes;
- a design-system rule changes.

## Final Agent Report

The agent should report:

1. What changed.
2. Important implementation decisions.
3. Files/packages affected.
4. Tests executed.
5. Lint/typecheck/build results.
6. Any follow-up or known limitations.
