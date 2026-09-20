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

## Branding assets

- **Platform brand** (default logo + favicon) lives in the repo at `apps/<app>/public/brand/` (`logo-light.png`, `logo-dark.png`, `favicon.png`) and is served by Next. Keep it optimized (small PNG/SVG); it is versioned with the app. It is **not** stored in Appwrite Storage.
- **Organization brand** (white-label) is per tenant: the files go in the Appwrite Storage `branding-logos` bucket and the URLs are stored on `organization_profiles.logoLight` / `logoDark` / `favicon` (see `brandingSchema`). The login page is pre-auth, so it shows the platform brand.
- The shared `Logo` component (`@cdorneles/ui`) picks light/dark from the theme and accepts `lightSrc`/`darkSrc` overrides for the organization case.

## Icons

- Line icons come from **Lucide**. Lucide no longer ships brand icons, so brand glyphs (e.g. the Google mark) are **inline SVGs** in `@cdorneles/ui` (`GoogleIcon`), rendered `aria-hidden`/`focusable="false"` with the accessible name coming from the button label.
