"use client";

import { Image } from "@mantine/core";

import { useAppColorScheme } from "@cdorneles/theme";

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

/** Platform logo that follows the active Light/Dark scheme. */
export function Logo({
  lightSrc = DEFAULT_LIGHT_SRC,
  darkSrc = DEFAULT_DARK_SRC,
  alt,
  height = 40,
  width,
  className,
}: LogoProps) {
  const { colorScheme } = useAppColorScheme();

  return (
    <Image
      className={className}
      src={colorScheme === "dark" ? darkSrc : lightSrc}
      alt={alt}
      h={height}
      w={width ?? height * 2}
      fit="contain"
    />
  );
}
