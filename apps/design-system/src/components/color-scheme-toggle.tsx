"use client";

import { useAppColorScheme } from "@cdorneles/theme";
import { IconButton } from "@cdorneles/ui";
import { Moon, Sun } from "lucide-react";

/** Demonstrates the organization-default + user-override theme model. */
export function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useAppColorScheme();

  return (
    <IconButton
      icon={colorScheme === "dark" ? Sun : Moon}
      label={colorScheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      variant="default"
      onClick={() => toggleColorScheme()}
    />
  );
}
