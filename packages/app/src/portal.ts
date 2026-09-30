/**
 * Prefix of every authenticated route (`/p` — private/portal).
 *
 * The whole signed-in surface (shell pages and `select-org`) lives under this
 * single subtree, so the session gate protects one path instead of a list that
 * grows — and drifts — with every new resource group.
 *
 * Public routes stay at the root: `/login`, `/mfa`, `/forgot-password`,
 * `/reset-password`.
 */
export const PORTAL_PREFIX = "/p";
