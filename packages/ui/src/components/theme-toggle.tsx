"use client";

import { useAppColorScheme } from "@cdorneles/theme";
import { Box } from "@mantine/core";
import { Moon, Sun } from "lucide-react";

import { IconButton, type IconButtonIcon } from "./icon-button";

export interface ThemeToggleProps {
  className?: string;
}

/**
 * Both icons are always rendered; the active one is picked by CSS
 * (`lightHidden`/`darkHidden`) from the pre-hydration
 * `data-mantine-color-scheme` attribute. Reading the scheme in render output
 * would desync server and client and break hydration.
 */
const ThemeToggleIcon: IconButtonIcon = ({ size = 18, ...rest }) => (
  <>
    <Box component="span" lightHidden>
      <Sun size={size} {...rest} />
    </Box>
    <Box component="span" darkHidden>
      <Moon size={size} {...rest} />
    </Box>
  </>
);

/** Light/Dark toggle. There is no "System" option (AGENTS.md). */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { colorScheme, setColorScheme } = useAppColorScheme();

  return (
    <IconButton
      className={className}
      icon={ThemeToggleIcon}
      label="Alternar tema claro/escuro"
      variant="default"
      onClick={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")}
    />
  );
}
