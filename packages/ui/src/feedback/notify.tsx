"use client";

import { Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { createElement, type ReactNode } from "react";

export type NotificationKind = "success" | "info" | "error";

/**
 * Default auto-close per kind. Success and info are transient; an error stays
 * until it is dismissed, because it usually explains why something failed and
 * the user may need to read it more than once.
 *
 * None of these is a substitute for an inline `FormError`: a toast that expires
 * takes the reason the form failed with it.
 */
export const NOTIFICATION_AUTO_CLOSE: Record<NotificationKind, number | false> = {
  success: 4000,
  info: 6000,
  error: false,
};

const ICONS: Record<NotificationKind, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  error: AlertCircle,
};

/** Keys of `theme.colors`, never raw values. */
const COLORS: Record<NotificationKind, string> = {
  success: "success",
  info: "info",
  error: "danger",
};

export interface NotifyOptions {
  title?: string;
  /** Override the default duration for this kind. `false` keeps it open. */
  autoClose?: number | false;
  /**
   * Stable id. Re-showing an id that is already visible updates that toast in
   * place instead of stacking a duplicate, so it is safe under repeated
   * renders; it also lets `notifyHide` target the toast.
   */
  id?: string;
  /** Extra content below the message, e.g. an action button. */
  action?: ReactNode;
}

/**
 * Shows a toast. Prefer the named helpers; they fix the icon and color per kind
 * so the state is never conveyed by color alone.
 */
function show(kind: NotificationKind, message: ReactNode, options: NotifyOptions = {}): string {
  const { title, autoClose, id, action } = options;

  return notifications.show({
    id,
    title,
    color: COLORS[kind],
    icon: createElement(ICONS[kind], { size: 18, "aria-hidden": true }),
    autoClose: autoClose ?? NOTIFICATION_AUTO_CLOSE[kind],
    withBorder: true,
    message: action ? (
      <Stack gap="xs">
        <span>{message}</span>
        {action}
      </Stack>
    ) : (
      message
    ),
  });
}

/** Confirms an action that succeeded. Closes on its own. */
export function notifySuccess(message: ReactNode, options?: NotifyOptions): string {
  return show("success", message, options);
}

/** Neutral, transient information. */
export function notifyInfo(message: ReactNode, options?: NotifyOptions): string {
  return show("info", message, options);
}

/**
 * Reports a failure. Stays open until dismissed — use it for failures whose
 * context is obvious; a form that failed keeps its inline `FormError` instead.
 */
export function notifyError(message: ReactNode, options?: NotifyOptions): string {
  return show("error", message, options);
}

/** Dismisses a toast by id. A no-op when it is not visible. */
export function notifyHide(id: string): void {
  notifications.hide(id);
}
