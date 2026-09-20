"use client";

import { Alert, type AlertProps } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export interface FormErrorProps extends Omit<AlertProps, "children" | "color" | "variant" | "icon"> {
  /** The error message. When null/undefined the alert is not rendered. */
  children?: ReactNode;
}

/**
 * Form-level error alert. Renders nothing without a message, keeps
 * `role="alert"` for screen readers and pairs the text with an icon so the
 * state is never conveyed by color alone.
 */
export function FormError({ children, ...others }: FormErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <Alert
      role="alert"
      variant="light"
      color="danger"
      icon={<AlertCircle size={18} aria-hidden />}
      {...others}
    >
      {children}
    </Alert>
  );
}
