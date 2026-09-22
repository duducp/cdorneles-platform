"use client";

import { Box } from "@mantine/core";

export interface AuthVisualProps {
  className?: string;
}

interface Band {
  top: string;
  left: string;
  width: string;
  height: number;
  rotate: string;
  from: string;
  to: string;
  opacity: number;
}

interface Palette {
  glow: string;
  shadow: string;
  bands: Band[];
}

/** Lighter brand shades for light surfaces. */
const LIGHT: Palette = {
  glow: "brand-3",
  shadow: "brand-4",
  bands: [
    {
      top: "18%",
      left: "-18%",
      width: "140%",
      height: 34,
      rotate: "-18deg",
      from: "brand-5",
      to: "brand-3",
      opacity: 1,
    },
    {
      top: "46%",
      left: "-12%",
      width: "132%",
      height: 26,
      rotate: "-9deg",
      from: "brand-3",
      to: "brand-5",
      opacity: 0.92,
    },
    {
      top: "68%",
      left: "2%",
      width: "120%",
      height: 20,
      rotate: "-24deg",
      from: "brand-2",
      to: "brand-4",
      opacity: 0.75,
    },
    {
      top: "6%",
      left: "-6%",
      width: "120%",
      height: 14,
      rotate: "10deg",
      from: "brand-2",
      to: "brand-4",
      opacity: 0.5,
    },
  ],
};

/** Deeper, higher-contrast brand shades for dark surfaces. */
const DARK: Palette = {
  glow: "brand-6",
  shadow: "brand-8",
  bands: [
    {
      top: "18%",
      left: "-18%",
      width: "140%",
      height: 34,
      rotate: "-18deg",
      from: "brand-8",
      to: "brand-6",
      opacity: 1,
    },
    {
      top: "46%",
      left: "-12%",
      width: "132%",
      height: 26,
      rotate: "-9deg",
      from: "brand-6",
      to: "brand-8",
      opacity: 0.92,
    },
    {
      top: "68%",
      left: "2%",
      width: "120%",
      height: 20,
      rotate: "-24deg",
      from: "brand-5",
      to: "brand-7",
      opacity: 0.75,
    },
    {
      top: "6%",
      left: "-6%",
      width: "120%",
      height: 14,
      rotate: "10deg",
      from: "brand-5",
      to: "brand-7",
      opacity: 0.5,
    },
  ],
};

function Composition({ palette }: { palette: Palette }) {
  return (
    <>
      <Box
        style={{
          position: "absolute",
          inset: "-30%",
          background: `radial-gradient(55% 55% at 72% 28%, color-mix(in srgb, var(--mantine-color-${palette.glow}) 55%, transparent), transparent 70%)`,
        }}
      />
      {palette.bands.map((band) => (
        <Box
          key={`${band.top}-${band.rotate}`}
          style={{
            position: "absolute",
            top: band.top,
            left: band.left,
            width: band.width,
            height: band.height,
            borderRadius: 999,
            opacity: band.opacity,
            transform: `rotate(${band.rotate})`,
            background: `linear-gradient(90deg, var(--mantine-color-${band.from}), var(--mantine-color-${band.to}))`,
            boxShadow: `0 24px 70px color-mix(in srgb, var(--mantine-color-${palette.shadow}) 45%, transparent)`,
          }}
        />
      ))}
    </>
  );
}

/** Decorative right-hand panel for the auth card. Purely presentational. */
export function AuthVisual({ className }: AuthVisualProps) {
  return (
    <Box
      className={className}
      aria-hidden="true"
      style={{
        position: "relative",
        height: "100%",
        minHeight: 320,
        overflow: "hidden",
        pointerEvents: "none",
        background: "var(--mantine-color-default)",
      }}
    >
      <Box darkHidden style={{ position: "absolute", inset: 0 }}>
        <Composition palette={LIGHT} />
      </Box>
      <Box lightHidden style={{ position: "absolute", inset: 0 }}>
        <Composition palette={DARK} />
      </Box>
    </Box>
  );
}
