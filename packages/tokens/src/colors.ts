import type { ColorScale } from "./color";

/**
 * Platform palettes. These are tokens: components must consume them instead of
 * hardcoded colors. Index 5 is the primary/main shade used by Mantine.
 */
export const brand: ColorScale = [
  "#eef2ff",
  "#e0e7ff",
  "#c7d2fe",
  "#a5b4fc",
  "#818cf8",
  "#6366f1",
  "#4f46e5",
  "#4338ca",
  "#3730a3",
  "#312e81",
];

export const gray: ColorScale = [
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#cbd5e1",
  "#94a3b8",
  "#64748b",
  "#475569",
  "#334155",
  "#1e293b",
  "#0f172a",
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
  success,
  warning,
  danger,
  info,
} as const;

export type PaletteName = keyof typeof palettes;

/**
 * Semantic surface/text tokens per theme mode. Used by state components so
 * they adapt to Light/Dark without hardcoded colors.
 */
export const semanticColors = {
  light: {
    background: gray[0],
    surface: "#ffffff",
    border: gray[2],
    text: gray[9],
    textMuted: gray[6],
  },
  dark: {
    background: gray[9],
    surface: gray[8],
    border: gray[7],
    text: gray[0],
    textMuted: gray[4],
  },
} as const;
