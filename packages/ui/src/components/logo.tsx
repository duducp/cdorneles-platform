"use client";

import { Box, Image } from "@mantine/core";

export interface LogoProps {
  lightSrc?: string;
  darkSrc?: string;
  alt: string;
  height?: number;
  width?: number;
  className?: string;
}

const DEFAULT_LIGHT_SRC = "/brand/logo-light.png";
const DEFAULT_DARK_SRC = "/brand/logo-dark.png";

/**
 * Platform logo that follows the active Light/Dark scheme. Both sources are
 * always rendered; CSS (`lightHidden`/`darkHidden`) picks the active one from
 * the pre-hydration `data-mantine-color-scheme` attribute, so server and client
 * HTML stay identical during hydration.
 */
export function Logo({
  lightSrc = DEFAULT_LIGHT_SRC,
  darkSrc = DEFAULT_DARK_SRC,
  alt,
  height = 40,
  width,
  className,
}: LogoProps) {
  const size = { h: height, w: width ?? height * 2, fit: "contain" } as const;

  return (
    <Box className={className}>
      <Image darkHidden src={lightSrc} alt={alt} {...size} />
      <Image lightHidden src={darkSrc} alt={alt} {...size} />
    </Box>
  );
}
