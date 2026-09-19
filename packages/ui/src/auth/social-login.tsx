"use client";

import { Button } from "../components/button";
import { GoogleIcon } from "./google-icon";

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
      leftSection={<GoogleIcon size={18} />}
    >
      Entrar com Google
    </Button>
  );
}
