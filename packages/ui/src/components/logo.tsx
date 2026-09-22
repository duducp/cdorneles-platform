"use client";

import { Box, Image } from "@mantine/core";

export interface LogoProps {
  /** `default` (2:1 lockup), `horizontal` (wide lockup) or `symbol` (mark only). */
  variant?: "default" | "horizontal" | "symbol";
  lightSrc?: string;
  darkSrc?: string;
  alt: string;
  height?: number;
  width?: number;
  className?: string;
}

const BRAND_SRC = {
  default: { light: "/brand/logo-light.png", dark: "/brand/logo-dark.png" },
  horizontal: { light: "/brand/logo-light-h.png", dark: "/brand/logo-dark-h.png" },
  symbol: { light: "/brand/favicon.png", dark: "/brand/favicon.png" },
} as const;

/** Default width as a multiple of `height`, per variant aspect ratio. */
const DEFAULT_ASPECT = {
  default: 1.7,
  horizontal: 4.8,
  symbol: 1,
} as const;

/**
 * Platform logo that follows the active Light/Dark scheme. Both sources are
 * always rendered; CSS (`lightHidden`/`darkHidden`) picks the active one from
 * the pre-hydration `data-mantine-color-scheme` attribute, so server and client
 * HTML stay identical during hydration. The `symbol` variant instead renders a
 * single image (its own opaque background makes it mode-independent).
 *
 * Each app ships its own brand assets under `/public/brand/`; the `horizontal`
 * variant requires the `-h` files to exist in the consuming app.
 */
export function Logo({
  variant = "default",
  lightSrc,
  darkSrc,
  alt,
  height = 40,
  width,
  className,
}: LogoProps) {
  const size = {
    h: height,
    w: width ?? Math.round(height * DEFAULT_ASPECT[variant]),
    fit: "contain",
  } as const;

  if (variant === "symbol") {
    return (
      <Box className={className}>
        <Image src={lightSrc ?? BRAND_SRC.symbol.light} alt={alt} {...size} />
      </Box>
    );
  }

  return (
    <Box className={className}>
      <Image darkHidden src={lightSrc ?? BRAND_SRC[variant].light} alt={alt} {...size} />
      <Image lightHidden src={darkSrc ?? BRAND_SRC[variant].dark} alt={alt} {...size} />
    </Box>
  );
}
