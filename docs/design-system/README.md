# Design System

Primary framework: Mantine.

Icons: Lucide.

Shared components: `@cdorneles/ui`.

Tokens: `@cdorneles/tokens`.

Theme: `@cdorneles/theme`.

Visual direction: Professional SaaS / Enterprise Dashboard.

Default UI size: 14px.

The system supports Light and Dark themes and all defined responsive breakpoints.

## Feature flags

- **Platform-wide (pre-authentication) flags** — e.g. whether public sign-up exists at all — are **environment flags**: `NEXT_PUBLIC_*`, defaulting to `false`. They are read in the app/route and passed down as a prop. `LoginForm`'s `showSignUp` is the reference case.
- **Organization features** use the Appwrite `features` / `organization_features` tables and `FeatureGate` / `AccessProvider` — these are **post-login** (resolved per organization). Do not use them for pre-auth platform flags.

## Forms and auth pages

Patterns established while building the auth pages — follow them on every new
page.

- **Form-level errors** use the shared `FormError` component (`@cdorneles/ui`):
  an `Alert variant="light" color="danger"` with an icon and `role="alert"`.
  It renders `null` when there is no message. Never hand-roll
  `<div role="alert">` or render loose red `<Text c="danger">`.
- **Error messages must differentiate causes** (reference: design-system
  `/mfa`). Map `AuthNotConfiguredError` to an "auth not configured" message;
  map `ApiError` with `status === 401` (or code `general_unauthorized_scope`)
  to "session missing/expired — log in again"; keep a generic fallback only for
  unknown errors. Never collapse an error into an unrelated generic message,
  and always give the user a next step (e.g. a link back to `/login`).
- **`AuthCard` owns the form panel padding** (`p="xl"`). Slots pass content
  only — do not add padding to form components or to page-level wrappers
  inside the card.
- Auth forms carry **no layout opinion** (no outer padding/margin) so they can
  be composed anywhere.
- Forms that need Mantine style props must use `Box component="form"`, not a
  native `<form>` — native elements ignore style props.
- Each auth form carries its own title block: exactly one heading
  (`Text component="h1"`) plus a dimmed description. Pages must not add a
  second heading for the form.
- Every new `@cdorneles/ui` component ships with a co-located `*.test.tsx`.

## Branding assets

- **Platform brand** (default logo + favicon) lives in the repo at `apps/<app>/public/brand/` (`logo-light.png`, `logo-dark.png`, `favicon.png`) and is served by Next. Keep it optimized (small PNG/SVG); it is versioned with the app. It is **not** stored in Appwrite Storage.
- **Organization brand** (white-label) is per tenant: the files go in the Appwrite Storage `branding-logos` bucket and the URLs are stored on `organization_profiles.logoLight` / `logoDark` / `favicon` (see `brandingSchema`). The login page is pre-auth, so it shows the platform brand.
- The shared `Logo` component (`@cdorneles/ui`) picks light/dark from the theme and accepts `lightSrc`/`darkSrc` overrides for the organization case.

## Icons

- Line icons come from **Lucide**. Lucide no longer ships brand icons, so brand glyphs (e.g. the Google mark) are **inline SVGs** in `@cdorneles/ui` (`GoogleIcon`), rendered `aria-hidden`/`focusable="false"` with the accessible name coming from the button label.
