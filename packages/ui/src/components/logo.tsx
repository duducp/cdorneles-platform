"use client";

import { useAppColorScheme } from "@cdorneles/theme";

export interface LogoProps {
  lightSrc?: string;
  darkSrc?: string;
  alt: string;
  height?: number;
  className?: string;
}

const DEFAULT_LIGHT_SRC = "/brand/logo-light.png";
const DEFAULT_DARK_SRC = "/brand/logo-dark.png";

/** Platform logo that follows the active Light/Dark scheme. */
export function Logo({
  lightSrc = DEFAULT_LIGHT_SRC,
  darkSrc = DEFAULT_DARK_SRC,
  alt,
  height = 40,
  className,
}: LogoProps) {
  const { colorScheme } = useAppColorScheme();

  return (
    <img
      src={colorScheme === "dark" ? darkSrc : lightSrc}
      alt={alt}
      height={height}
      className={className}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
