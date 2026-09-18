/**
 * Framework-agnostic color utilities. These power white-label color handling
 * (ADR-006): organization colors are expanded into a Mantine-compatible scale
 * and validated for contrast.
 */

/** Mantine color tuple: 10 shades, index 0 lightest → index 9 darkest. */
export type ColorScale = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim();
  const short = HEX_SHORT.exec(value);
  if (short) {
    return {
      r: parseInt(`${short[1]}${short[1]}`, 16),
      g: parseInt(`${short[2]}${short[2]}`, 16),
      b: parseInt(`${short[3]}${short[3]}`, 16),
    };
  }

  const long = HEX_LONG.exec(value);
  if (long) {
    return {
      r: parseInt(long[1], 16),
      g: parseInt(long[2], 16),
      b: parseInt(long[3], 16),
    };
  }

  return null;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexChannel(value: number): string {
  return clampChannel(value).toString(16).padStart(2, "0");
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
}

/**
 * Linearly mixes two colors in sRGB space. `weight` is the contribution of
 * `to` (0 → only `from`, 1 → only `to`).
 */
export function mixColors(from: string, to: string, weight: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) {
    return from;
  }
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: a.r + (b.r - a.r) * w,
    g: a.g + (b.g - a.g) * w,
    b: a.b + (b.b - a.b) * w,
  });
}

const WHITE = "#ffffff";
const BLACK = "#000000";

/**
 * Expands a single base color into a 10-shade Mantine-compatible scale.
 * Returns a neutral gray scale when the input is not a valid hex color.
 */
export function createColorScale(base: string): ColorScale {
  if (!hexToRgb(base)) {
    return [
      "#ffffff",
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
  }

  return [
    mixColors(base, WHITE, 0.9),
    mixColors(base, WHITE, 0.75),
    mixColors(base, WHITE, 0.55),
    mixColors(base, WHITE, 0.35),
    mixColors(base, WHITE, 0.15),
    base,
    mixColors(base, BLACK, 0.12),
    mixColors(base, BLACK, 0.26),
    mixColors(base, BLACK, 0.42),
    mixColors(base, BLACK, 0.58),
  ];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }
  return (
    0.2126 * channelToLinear(rgb.r) +
    0.7152 * channelToLinear(rgb.g) +
    0.0722 * channelToLinear(rgb.b)
  );
}

/** WCAG 2.1 contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hasMinimumContrast(foreground: string, background: string, minimum = 4.5): boolean {
  return contrastRatio(foreground, background) >= minimum;
}

/** Picks the most readable of black/white for the given background. */
export function readableTextColor(background: string): "#000000" | "#ffffff" {
  return contrastRatio(BLACK, background) >= contrastRatio(WHITE, background)
    ? "#000000"
    : "#ffffff";
}
