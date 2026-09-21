"use client";

import { Notifications } from "@mantine/notifications";

/**
 * The notification host. Render it exactly once, inside the Mantine provider —
 * mounting more than one duplicates every notification.
 *
 * The duration is a fallback only: `notify*` helpers pass their own per kind,
 * and a per-notification value wins over this one.
 */
export function AppNotifications() {
  return (
    <Notifications
      position="top-right"
      limit={3}
      autoClose={4000}
      pauseResetOnHover="notification"
    />
  );
}
