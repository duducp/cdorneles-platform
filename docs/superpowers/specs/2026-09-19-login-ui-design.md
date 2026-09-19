# Login UI — Design Spec

**Date:** 2026-09-19
**Status:** Approved
**Scope:** The first real authentication UI: a reusable, componentized login screen for the platform. It follows the *layout and composition* of the Appwrite sign-in reference but uses only the platform's design system, tokens, and brand.

## Context

- TODO item 2: "Add a real login UI in `apps/design-system` (the probe covers the service chain; no app has a login screen yet)."
- The auth service chain is already proven live (`packages/auth/scripts/verify-auth.ts`). No app calls `useAuth()` yet — this is the first consumer.
- Visual reference: `appwrite.io/sign-in` (an SPA; only the layout/composition is taken from it — no Appwrite logo, name, colors, or illustration).
- Constraints: `AGENTS.md` UI rules; ADR-001 (Mantine/Lucide/Mantine Form/Zod, no Tailwind/shadcn), ADR-002 (consume UI via `@cdorneles/ui`, tokens, light/dark), ADR-006 (branding), ADR-010 (search the design system before creating UI); ARCHITECTURE §13 (professional SaaS, minimal elevation, no glassmorphism, no decorative gradients, subtle motion, 14px base) and §14 (breakpoints); `DEFINITION_OF_DONE.md` UI checklist.

## Goals

- A reusable, componentized login UI that any app composes (design-system first; admin/client/customer later).
- Premium, modern, minimalist B2B look, native to the ERP.
- Email + password + Google (visual) for this first iteration.
- Full Light/Dark support, responsive, accessible, token-driven.

## Non-Goals

- Functional Google OAuth — the button is visual only in this iteration (the `AuthService` has no OAuth method yet).
- Sign-up, forgot-password and MFA flows — rendered as links only.
- An i18n framework — pt-BR strings are hardcoded for now.
- Route protection / middleware / an authenticated area.
- Wiring the login into `admin`/`client`/`customer` (design-system first).

## Architecture

- **Presentational components in `@cdorneles/ui`** (no auth logic; no dependency on `@cdorneles/auth`):
  `AuthCard`, `AuthVisual`, `LoginForm`, `SocialLogin`, `ThemeToggle`.
- **A thin route per app**: `apps/design-system/src/app/login/page.tsx` (client component) composes the pieces and wires `useAuth()`.
- Reuse is by composition: another app imports the same components and supplies its own `onSubmit`/branding.
- New dependency: `@mantine/form` (already in the pnpm catalog) added to `@cdorneles/ui`.

## Components

### `AuthCard` — `packages/ui/src/auth/auth-card.tsx`

The centered container. Renders a two-column card: the form on the left (slightly wider), the visual on the right.

```ts
export interface AuthCardProps {
  form: ReactNode;
  visual?: ReactNode;
}
```

- Width ~920px (max), height ~600px on desktop, centered horizontally and vertically on the page background (`background` token).
- `radius="lg"`, border via the `border` token, `overflow: hidden`.
- Grid: form `1.05fr` / visual `1fr`.
- Below the `sm` breakpoint: single column; the visual is hidden (`display: none`).

### `AuthVisual` — `packages/ui/src/auth/auth-visual.tsx`

The abstract right-hand panel ("ribbons"). Purely decorative.

```ts
export interface AuthVisualProps {
  className?: string;
}
```

- A CSS composition (no images/SVG assets): 3–4 overlapping rounded bands with gradients derived from the `brand` color scale, soft blur/glow and depth via `box-shadow`.
- Adapts to Light/Dark through tokens (light = lighter gradients on a light surface; dark = deeper, higher-contrast on a dark surface). Same identity in both.
- `aria-hidden="true"`, `pointer-events: none`.
- Optional subtle motion gated by `prefers-reduced-motion`.

### `LoginForm` — `packages/ui/src/auth/login-form.tsx`

The form. Owns its field state (Mantine Form + Zod), exposes a callback.

```ts
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  onGoogleClick?: () => void;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
}
```

- Contents, top to bottom: title/subtitle → `SocialLogin` (Google) → divider "OU CONTINUE COM" → e-mail field → password field (show/hide) → "Esqueci minha senha" → primary "Entrar" button → "Não tem uma conta? Criar conta".
- Validation with a Zod schema (e-mail format, password required) applied through Mantine Form's `validate`.
- Enter submits; while `loading`, the submit is disabled and repeated submits are blocked.
- Field-level validation errors plus a form-level `error` prop rendered with `role="alert"`.

### `SocialLogin` — `packages/ui/src/auth/social-login.tsx`

```ts
export interface SocialLoginProps {
  onGoogleClick?: () => void;
  disabled?: boolean;
}
```

- One primary-width "Entrar com Google" button (monochrome, `surface`/`border`/`text` tokens — not Google's brand colors), with a Lucide `Chrome`/`Github`-style icon.
- Compact icon buttons for other providers are out of scope for now (only Google).

### `ThemeToggle` — `packages/ui/src/components/theme-toggle.tsx`

Promoted from the app-local `ColorSchemeToggle` so it is reusable.

```ts
export interface ThemeToggleProps {
  className?: string;
}
```

- Shows the current mode; toggles Light/Dark; Lucide `Sun`/`Moon`; hover + focus states; keyboard accessible; `aria-label`; persists via the theme provider; updates without reload.
- Built on `IconButton` + `useAppColorScheme()`.

## Layout

- Page background: `background` token; the card is centered horizontally and vertically.
- Theme toggle: top-right of the page (outside the card).
- Page footer, below the card: "Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade." — "Termos de Uso" and "Política de Privacidade" are links (`primary` token, hover + focus).

## Theme

- Priority on load: (1) the user's persisted choice (`localStorage`, key `cdorneles-color-scheme`), (2) `prefers-color-scheme`, (3) fallback = `light`.
- Implemented through the existing `ThemeProvider`/`MantineProvider`; **no second theme system**.
- `ThemeProvider` resolves the first-visit scheme from `prefers-color-scheme` when no choice is stored (Mantine `defaultColorScheme` "auto" semantics), so there is no flash and no fixed default.
- The toggle exposes **only Light and Dark** — no "System" option (per `AGENTS.md`).
- Consequence to note: this gives `prefers-color-scheme` precedence over the organization default (`organizationDefault` / branding `defaultTheme`) on a first visit. ADR-006's "org default, user-overridable" still holds once the user chooses; the org default remains the fallback. Flagged for a follow-up note in ADR-006 if the team wants the org default to outrank the system preference.

## States & errors

- Form states: default, hover, focus, disabled, loading, error.
- `loading`: primary button shows a spinner and is disabled; inputs disabled.
- Error mapping in the route: `ApiError` with `code === "user_invalid_credentials"` → "E-mail ou senha inválidos."; `AuthNotConfiguredError` → "Autenticação não configurada neste ambiente."; other errors → generic message. Field-level messages come from Zod.
- Error text uses the `error` semantic token and is not the only signal (icon + text + `aria-live`/`role="alert"`).

## Accessibility

- Every input has an associated `<label>` (visible), a placeholder, a focus state, and an error state.
- Full keyboard navigation; visible focus ring consistent with the design system; Enter submits.
- `aria-label`/tooltip on the theme toggle; the decorative panel is `aria-hidden`.
- Minimum contrast for text/controls in both themes; state is not conveyed by color alone.

## Responsiveness

- Desktop: two panels, form slightly wider.
- Tablet: two panels while space allows, visual reduced proportionally.
- Mobile: single column, visual hidden; the form uses the available width; comfortable padding/tap targets; no horizontal overflow.

## Content (pt-BR, hardcoded for now)

| Element | String |
|---|---|
| Title | Bem-vindo de volta |
| Subtitle | Entre na sua conta |
| Google | Entrar com Google |
| Divider | OU CONTINUE COM |
| E-mail label / placeholder | E-mail / seu@email.com |
| Senha label / placeholder | Senha / Sua senha |
| Forgot | Esqueci minha senha |
| Submit | Entrar |
| Sign-up | Não tem uma conta? Criar conta |
| Footer | Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade. |
| Invalid credentials | E-mail ou senha inválidos. |

## Testing

- Unit tests in `packages/ui` (the vitest `include` covers `packages/*` and `functions/*`, not `apps/*`): `AuthCard` renders both panels; `LoginForm` renders fields/labels, submits on click and Enter, disables while `loading`, shows a form-level error with `role="alert"`; `ThemeToggle` toggles the mode and exposes an accessible name.
- Manual verification via `pnpm dev:design-system` in Light, Dark, and mobile widths.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Dependencies

- `@mantine/form` (catalog `9.6.1`) → add to `@cdorneles/ui` (user-authorized).
- Validation schema lives in `@cdorneles/schemas` (`loginSchema`, Zod — per ADR-001); `@cdorneles/ui` gains an internal dependency on `@cdorneles/schemas`. No direct `zod` dependency is added to `@cdorneles/ui`.
- No other new dependencies; icons from `lucide-react` (already present).
