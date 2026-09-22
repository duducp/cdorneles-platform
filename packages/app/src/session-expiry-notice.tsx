"use client";

import { useAuth } from "@cdorneles/auth";
import { notifyHide, notifyInfo } from "@cdorneles/ui";
import { Button } from "@mantine/core";
import { useEffect, useRef } from "react";

const NOTICE_ID = "session-expiring";

/**
 * Warns that the session is about to expire, with a way to renew it.
 *
 * `AuthProvider` reports the session as `expiring` five minutes before it dies,
 * but nothing consumed it, so the user was signed out with no warning at all.
 * This is the notice it was meant for.
 *
 * The toast is keyed by a stable id and cleared as soon as the state leaves
 * `expiring`, so renewing the session removes it and repeated renders cannot
 * stack duplicates.
 */
export function SessionExpiryNotice() {
  const { sessionState, status, renewSession } = useAuth();
  const renewSessionRef = useRef(renewSession);
  renewSessionRef.current = renewSession;

  useEffect(() => {
    if (sessionState !== "expiring" || status !== "authenticated") {
      notifyHide(NOTICE_ID);
      return;
    }

    notifyInfo("Sua sessão expira em alguns minutos.", {
      id: NOTICE_ID,
      title: "Sessão expirando",
      autoClose: false,
      action: (
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => {
            // A dead session already moved the provider to "expired" and opened
            // the dialog; swallow the rejection so it cannot leak unhandled.
            void renewSessionRef.current().catch(() => {
              /* handled by the provider's session state */
            });
          }}
        >
          Renovar sessão
        </Button>
      ),
    });
  }, [sessionState, status]);

  return null;
}
