"use client";

import { useAppColorScheme } from "@cdorneles/theme";
import { Moon, Sun } from "lucide-react";

import { IconButton } from "./icon-button";

export interface ThemeToggleProps {
  className?: string;
}

/** Light/Dark toggle. There is no "System" option (AGENTS.md). */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { colorScheme, toggleColorScheme } = useAppColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <IconButton
      className={className}
      icon={isDark ? Sun : Moon}
      label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      variant="default"
      onClick={() => toggleColorScheme()}
    />
  );
}
