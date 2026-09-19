"use client";

import { Globe } from "lucide-react";

import { Button } from "../components/button";

export interface SocialLoginProps {
  onGoogleClick?: () => void;
  disabled?: boolean;
}

/** Social sign-in entry points. Google only for now (visual). */
export function SocialLogin({ onGoogleClick, disabled }: SocialLoginProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      disabled={disabled}
      onClick={onGoogleClick}
      leftSection={<Globe size={18} aria-hidden />}
    >
      Entrar com Google
    </Button>
  );
}
