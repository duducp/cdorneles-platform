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
- **Announce submit errors and loading at form level** (reference: `packages/ui/src/auth/login-form.tsx`). Focus moves to the first invalid input, so its inline error is not announced: render the first field error also inside the shared `FormError` (its `role="alert"` announces it), point `aria-describedby` on the `<Box component="form">` to that alert's id, and set `aria-busy` on the form while submitting. Keep Mantine's own `aria-invalid`/`aria-describedby` wiring — do not duplicate it manually where `error` already flows through `getInputProps`.
- **The visible label is the accessible name** (WCAG 2.5.3 Label in Name). Never add an `aria-label` that differs from the visible label on the same input; use `aria-describedby` for extra hints. Do not set `required` on auth forms: Mantine renders the asterisk inside the `<label>` (which breaks exact-match tests) and the indicator is redundant when validation happens on submit with `noValidate`.
- **Password visibility toggles**: rely on Mantine's `aria-pressed` for state; pass only a static `aria-label` via `visibilityToggleButtonProps` plus `visibilityToggleFocusable`. There is no `aria-label-pressed` — do not invent it.
- Every new `@cdorneles/ui` component ships with a co-located `*.test.tsx`.

## Theme and contrast

- **Mantine 9 resolves the primary color at the fixed main shade (index 5)** — there is no index 10, and `primaryShade` does not change which swatch filled buttons use. The theme pins `primaryShade: 5` so rendered UI matches `tokens.<palette>[5]`; contrast must always be computed against index 5, never against the old `{ light: 6, dark: 4 }` assumption.
- **`autoContrast: true`** is set platform-wide: filled components pick black/white text from the background luminance (threshold 0.3). Never hardcode text color on filled buttons/variants; to improve contrast of a primary action, adjust or re-map the palette token instead of overriding text color.

## Page structure (Next.js App Router)

- Public pages follow the **server page + client component split** (reference: `apps/design-system/src/app/login/`): `page.tsx` stays a Server Component exporting `metadata` (Next 16 forbids `metadata` in `"use client"` files) and renders `<XxxPageClient />` from a co-located `page-client.tsx` that holds the hooks and handlers.
- Each page exports a **document title** via `metadata`; the root layout provides the `%s | Cdorneles Design System` template.
- Exactly one `<h1>` per page. Auth forms carry their own `h1`; pages without a form-level heading (e.g. `select-org`) add a visually hidden one (`VisuallyHidden` + `Title order={1}`).
- Announce transient states to screen readers with a `VisuallyHidden aria-live="polite"` region (reference: login page "Entrando..."); use the shared `LoadingState` (`role="status"`) for full-page loading instead of bare dimmed text.
- Keep the theme toggle row compact (`p="sm"`) so the `IconButton` stays near the touch target on mobile; links that are not underlined by default must set `underline="always"` (footer legal links) — never color alone.

## Branding assets

- **Platform brand** (default logo + favicon) lives in the repo at `apps/<app>/public/brand/` (`logo-light.png`, `logo-dark.png`, `favicon.png`) and is served by Next. Keep it optimized (small PNG/SVG); it is versioned with the app. It is **not** stored in Appwrite Storage.
- **Organization brand** (white-label) is per tenant: the files go in the Appwrite Storage `branding-logos` bucket and the URLs are stored on `organization_profiles.logoLight` / `logoDark` / `favicon` (see `brandingSchema`). The login page is pre-auth, so it shows the platform brand.
- The shared `Logo` component (`@cdorneles/ui`) picks light/dark from the theme and accepts `lightSrc`/`darkSrc` overrides for the organization case.
- **Variants:** `default` (square lockup, 2:1) and `horizontal` (wide lockup). The horizontal variant expects `logo-light-h.png` / `logo-dark-h.png` in the consuming app's `public/brand/` and uses a wider aspect ratio (≈5.6:1) as its default width. If an app has not shipped the `-h` assets yet, keep using the default variant.

## Icons

- Line icons come from **Lucide**. Lucide no longer ships brand icons, so brand glyphs (e.g. the Google mark) are **inline SVGs** in `@cdorneles/ui` (`GoogleIcon`), rendered `aria-hidden`/`focusable="false"` with the accessible name coming from the button label.
