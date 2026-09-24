"use client";

import { isUnauthorized } from "@cdorneles/api-client";
import { useAuth } from "@cdorneles/auth";
import { notifyError, notifyHide, notifyInfo } from "@cdorneles/ui";
import { Button } from "@mantine/core";
import { useEffect, useRef } from "react";

const NOTICE_ID = "session-expiring";

/**
 * Warns that the session is about to expire, with a way to renew it.
 *
 * `AuthProvider` exposes `expiryWarning`, which steps from `15m` to `5m` as the
 * session approaches its expiry. The toast is keyed by a stable id, so the
 * 5-minute step replaces the 15-minute one rather than stacking a second notice,
 * and it is cleared as soon as the warning returns to `none` (renewal or logout).
 */
export function SessionExpiryNotice() {
  const { expiryWarning, status, renewSession } = useAuth();
  const renewSessionRef = useRef(renewSession);
  renewSessionRef.current = renewSession;

  useEffect(() => {
    if (expiryWarning === "none" || status !== "authenticated") {
      notifyHide(NOTICE_ID);
      return;
    }

    const minutes = expiryWarning === "15m" ? "15" : "5";

    notifyInfo(`Sua sessão expira em ${minutes} minutos.`, {
      id: NOTICE_ID,
      title: "Sessão expirando",
      autoClose: false,
      action: (
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => {
            void renewSessionRef.current().catch((error: unknown) => {
              // A dead session already moved the provider to "expired" and
              // opened the dialog; anything else is a real failure to surface.
              if (isUnauthorized(error)) return;
              notifyError("Não foi possível renovar a sessão. Tente novamente.");
            });
          }}
        >
          Renovar sessão
        </Button>
      ),
    });
  }, [expiryWarning, status]);

  return null;
}
