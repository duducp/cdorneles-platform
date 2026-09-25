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

## Shell topbar

The authenticated shell topbar (`Topbar` in `@cdorneles/ui/shell`, composed by
`createShellLayout`) follows a fixed left-to-right order:

1. **Logo** — the platform `Logo` in the `symbol` variant (the small favicon
   mark), passed through the `logo` slot. Apps may substitute the organization's
   white-label brand.
2. **Left section** — optional. Org-scoped apps pass the `OrgSwitcher` (also
   `@cdorneles/ui/shell`), an Appwrite-console-style dropdown: current
   organization on the trigger, the full list with the active one checked, and
   — gated by the `organizations.create` permission (`PermissionGate` semantics,
   never role-name checks) — a "Create organization" item at the end, which
   opens the shared `CreateOrganizationForm` in a modal. The admin app does not
   switch organizations and leaves the slot empty (the default).
3. **Right section** — the filter `TextInput` (visual-only by default; wire it
   by passing `filterValue`/`onFilterChange`), the `ThemeToggle`, and the
   `UserMenu`.

The `UserMenu` trigger shows the avatar (photo via the `userPhoto` prop when
available, initials otherwise), the user's first name plus surname
(`visibleFrom="sm"`), and a chevron. `createShellLayout` passes the **user's**
name — not the organization's — and hides the name text on mobile so the
topbar never overflows.

4. **Breadcrumbs** — derived automatically from the pathname by
   `createShellLayout` (`deriveTrail`): the first segment reuses the nav
   item's label, deeper segments are capitalized, and the last crumb is the
   current page (plain text with `aria-current="page"`). Hidden below `md`.

The sidebar (`Sidebar`) groups its items into sections: `SidebarNavItem`
accepts an optional `section`, items sharing one render under a caps dimmed
title in first-appearance order, and unsectioned items render first in an
untitled group. Collapsed sidebars hide the section titles.

`PageBody` renders its toolbar and content inside one bordered `Paper`
surface — the console panel look. The title, description and primary action
stay above the panel.

## Theme and contrast

- **Mantine 9 resolves the primary color at the fixed main shade (index 5)** — there is no index 10, and `primaryShade` does not change which swatch filled buttons use. The theme pins `primaryShade: 5` so rendered UI matches `tokens.<palette>[5]`; contrast must always be computed against index 5 (`brand[5]`, the CDorneles Orange `#F45D22`), never against the old `{ light: 6, dark: 4 }` assumption.
- **`autoContrast: true`** is set platform-wide: filled components pick black/white text from the background luminance (threshold 0.3). Never hardcode text color on filled buttons/variants; to improve contrast of a primary action, adjust or re-map the palette token instead of overriding text color.
- **Brand palette** follows the CDorneles visual identity guide (setembro/2026): primary `brand[5] = #F45D22` (CDorneles Orange); neutral grays `#FAFAFA` / `#E5E5E5` / `#737373` / `#171717`; dark surfaces `#0C0C0C` / `#141414` / `#292929`. The typeface is **Inter**, loaded with `next/font/google` and exposed as `--font-inter` (referenced at the head of the `@cdorneles/tokens` sans stack).

## Page structure (Next.js App Router)

- Public pages follow the **server page + client component split** (reference: `apps/design-system/src/app/login/`): `page.tsx` stays a Server Component exporting `metadata` (Next 16 forbids `metadata` in `"use client"` files) and renders `<XxxPageClient />` from a co-located `page-client.tsx` that holds the hooks and handlers.
- Each page exports a **document title** via `metadata`; the root layout provides the `%s | Carlos Dorneles Platform` template.
- Exactly one `<h1>` per page. Auth forms carry their own `h1`; pages without a form-level heading (e.g. `select-org`) add a visually hidden one (`VisuallyHidden` + `Title order={1}`).
- Announce transient states to screen readers with a `VisuallyHidden aria-live="polite"` region (reference: login page "Entrando..."); use the shared `LoadingScreen` (`role="status"`) for full-page loading instead of bare dimmed text.
- Keep the theme toggle row compact (`p="sm"`) so the `IconButton` stays near the touch target on mobile; links that are not underlined by default must set `underline="always"` (footer legal links) — never color alone.

## Loading

Four different waits, four different mechanisms — pick by what is actually
waiting, not by habit.

| Wait | Mechanism |
|---|---|
| A button's own action (submit, resend) | Mantine's `loading` prop on `Button` / `IconButton` |
| A route segment being fetched | `loading.tsx` in that route group, rendering `LoadingScreen` |
| The session and organization resolving | the `fallback` prop on `OrgGuard` |
| A specific link's navigation | `useLinkStatus` (Next 16), rendered beside the nav label |

Notes:

- **`loading.tsx` is a safety net, not a visible feature.** With static pages
  that Next has prefetched, navigation is instant and it never renders. It earns
  its keep once a segment loads data on the server. Do not reach for it to give
  feedback on every click — that is `useLinkStatus`.
- **`OrgGuard` renders its `fallback` while resolving**, and also when there is
  nothing to show (no organizations, or a selection is pending). It defaulted to
  `null`, which left the shell blank until the session resolved.
- **Do not disable a submit button to show that it is working.** Keep it enabled
  and let `loading` show progress; a disabled button hides why it is disabled.
- `LoadingState` carries `role="status"` and `aria-live="polite"`; prefer it
  over bare dimmed text so the state reaches screen readers.
- **`LoadingScreen` is the route-level loader**: centred logo + build version,
  with the spinner in the semantic `<footer>`. It announces its label through
  `aria-label` without rendering a visible caption, and adds no `<main>` — it
  renders inside `AppShell.Main`, which is already the page's `<main>`.
- **`LoadingState` stays for the non-route waits** (the `OrgGuard` fallback and
  the select-org page); it shows its label as visible dimmed text.
- **Live regions announce content changes, not their accessible name.** A
  `role="status"` region that carries only `aria-label` and no text node may not
  be announced on mount. When the message must reach screen readers, render it as
  visually hidden text (`VisuallyHidden`), as the login page does; `LoadingScreen`
  deliberately uses `aria-label` to keep the caption out of the DOM.

## Feedback: inline vs toast

Two mechanisms, and the choice is not cosmetic.

| Situation | Use |
|---|---|
| A form failed validation or submit | inline `FormError` |
| A terminal state on the page ("senha redefinida") | inline, `role="status"` |
| An action succeeded, context is obvious | `notifySuccess` |
| Transient system information (session expiring) | `notifyInfo` |
| A failure with no form to attach it to | `notifyError` |

The rule behind the table: **a toast must never be the only place a failure is
explained.** It expires, it lives in a portal away from the control that failed,
and once dismissed the information is gone. A form that failed keeps its inline
`FormError`; the toast is for outcomes whose context the user already has.

`notify*` helpers (`@cdorneles/ui`) fix the icon and the theme color per kind, so
the state is never conveyed by color alone, and set the duration:

| Kind | Duration | Why |
|---|---|---|
| `success` | 4s | confirms, then gets out of the way |
| `info` | 6s | readable but transient |
| `error` | never | a failure the user may need to read twice |

Pass a stable `id` for anything that can re-fire (the session warning does):
re-showing an id that is already visible is a no-op, so repeated renders cannot
stack duplicates. `notifyHide(id)` clears it.

`<AppNotifications />` is the host and is mounted once by
`createProviders`. Mounting a second one duplicates every notification.

## Framework boundary

`@cdorneles/ui` must not import Next.js. The shell components render whatever
element or component the application hands them, and `@cdorneles/app` — which
does depend on Next — supplies the framework-aware pieces:

```tsx
<Sidebar
  items={navItems}
  linkComponent={Link}                 {/* next/link: client-side navigation */}
  pendingComponent={NavPendingIndicator} {/* useLinkStatus: pending feedback */}
/>
```

The same reasoning applies elsewhere: `@cdorneles/auth` and `@cdorneles/tenant`
stay Next-free too (`OrgGuard` takes an `onRedirectToSelectOrg` callback rather
than importing a router). Next-specific wiring belongs in the application or in
`@cdorneles/app`.

## Branding assets

- **Platform brand** (logos + favicon) lives in the repo at `apps/<app>/public/brand/` and is served by Next. Files: `logo-light.webp` / `logo-dark.webp` (lockup, height 160), `logo-light-h.webp` / `logo-dark-h.webp` (horizontal lockup, height 128), `favicon.png` (orange, 512px) and `favicon-black.png` (admin panel only, 512px). The logos are optimized **WebP**; the favicons stay small PNG (logos ≤ ~10 KB, favicons ≤ ~40 KB). They are versioned with the app and are **not** stored in Appwrite Storage. The high-resolution source exports live in `apps/design-system/brand-original/` (outside `public/`, never served) — regenerate the served assets from there (ImageMagick: `-quality 82 … .webp` for the logos, `PNG8:` for the favicons).
- **Organization brand** (white-label) is per tenant: the files go in the Appwrite Storage `branding-logos` bucket and the URLs are stored on `organization_profiles.logoLight` / `logoDark` / `favicon` (see `brandingSchema`). The login page is pre-auth, so it shows the platform brand.
- The shared `Logo` component (`@cdorneles/ui`) picks light/dark from the theme and accepts `lightSrc`/`darkSrc` overrides for the organization case.
- **Variants:** `default` (lockup, ≈1.7:1), `horizontal` (wide lockup, ≈4.8:1) and `symbol` (the `[C D]` mark only, 1:1, uses `/brand/favicon.png`). The `-h` assets must exist in the consuming app's `public/brand/`. The collapsed sidebar renders the `symbol` variant.

## Icons

- Line icons come from **Lucide**. Lucide no longer ships brand icons, so brand glyphs (e.g. the Google mark) are **inline SVGs** in `@cdorneles/ui` (`GoogleIcon`), rendered `aria-hidden`/`focusable="false"` with the accessible name coming from the button label.
