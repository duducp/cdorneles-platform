"use client";

import { Button } from "../components/button";
import { GoogleIcon } from "./google-icon";

export interface SocialLoginProps {
  onGoogleClick?: () => void;
  disabled?: boolean;
  label?: string;
}

/** Social sign-in entry points. Google only for now (visual). */
export function SocialLogin({
  onGoogleClick,
  disabled,
  label = "Entrar com Google",
}: SocialLoginProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      disabled={disabled}
      onClick={onGoogleClick}
      leftSection={<GoogleIcon size={18} />}
    >
      {label}
    </Button>
  );
}
