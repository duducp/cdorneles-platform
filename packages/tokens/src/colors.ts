import type { ColorScale } from "./color";

/**
 * Platform palettes. These are tokens: components must consume them instead of
 * hardcoded colors. Index 5 is the primary/main shade used by Mantine.
 *
 * Brand palette from the CDorneles visual identity guide (setembro/2026):
 * primary `#F45D22`. The guide lists a 950 shade; a Mantine tuple holds ten
 * shades, so 50→index 0 … 900→index 9.
 */
export const brand: ColorScale = [
  "#fff7f2",
  "#ffebdd",
  "#ffd5bd",
  "#ffb58c",
  "#ff8a55",
  "#f45d22",
  "#dc4b16",
  "#b83b12",
  "#8f2f12",
  "#6f2712",
];

/** Neutral gray scale (no blue cast), anchored on the guide fundamentals. */
export const gray: ColorScale = [
  "#fafafa",
  "#f5f5f5",
  "#e5e5e5",
  "#d4d4d4",
  "#a3a3a3",
  "#737373",
  "#525252",
  "#404040",
  "#262626",
  "#171717",
];

/**
 * Dark-mode neutrals consumed by Mantine's `dark` palette. Mantine maps
 * `--mantine-color-body` to index 7, surfaces to 6 and borders to 4.
 */
export const dark: ColorScale = [
  "#fafafa",
  "#e5e5e5",
  "#d4d4d4",
  "#a3a3a3",
  "#292929",
  "#1c1c1c",
  "#141414",
  "#0c0c0c",
  "#0a0a0a",
  "#000000",
];

export const success: ColorScale = [
  "#ecfdf5",
  "#d1fae5",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#10b981",
  "#059669",
  "#047857",
  "#065f46",
  "#064e3b",
];

export const warning: ColorScale = [
  "#fffbeb",
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
  "#92400e",
  "#78350f",
];

export const danger: ColorScale = [
  "#fef2f2",
  "#fee2e2",
  "#fecaca",
  "#fca5a5",
  "#f87171",
  "#ef4444",
  "#dc2626",
  "#b91c1c",
  "#991b1b",
  "#7f1d1d",
];

export const info: ColorScale = [
  "#f0f9ff",
  "#e0f2fe",
  "#bae6fd",
  "#7dd3fc",
  "#38bdf8",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#075985",
  "#0c4a6e",
];

export const palettes = {
  brand,
  gray,
  dark,
  success,
  warning,
  danger,
  info,
} as const;

export type PaletteName = keyof typeof palettes;

/**
 * Semantic surface/text tokens per theme mode. Used by state components and the
 * theme's CSS-variable resolver so they adapt to Light/Dark without hardcoded
 * colors.
 */
export const semanticColors = {
  light: {
    background: gray[0],
    surface: "#ffffff",
    surfaceMuted: brand[0],
    border: gray[2],
    text: gray[9],
    textMuted: gray[5],
  },
  dark: {
    background: dark[7],
    surface: dark[6],
    surfaceMuted: dark[5],
    border: dark[4],
    text: dark[0],
    textMuted: dark[3],
  },
} as const;
