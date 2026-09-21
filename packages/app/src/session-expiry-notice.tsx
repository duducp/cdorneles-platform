"use client";

import { useAuth } from "@cdorneles/auth";
import { notifyHide, notifyInfo } from "@cdorneles/ui";
import { Button } from "@mantine/core";
import { useEffect, useRef } from "react";

const NOTICE_ID = "session-expiring";

/**
 * Warns that the session is about to expire, with a way to renew it.
 *
 * `AuthProvider` has always computed `sessionExpiring` (five minutes before the
 * session dies) but nothing consumed it, so the user was signed out with no
 * warning at all. This is the notice it was meant for.
 *
 * The toast is keyed by a stable id and cleared as soon as the flag drops, so
 * renewing the session removes it and repeated renders cannot stack duplicates.
 */
export function SessionExpiryNotice() {
  const { sessionExpiring, status, refresh } = useAuth();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!sessionExpiring || status !== "authenticated") {
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
            void refreshRef.current();
          }}
        >
          Renovar sessão
        </Button>
      ),
    });
  }, [sessionExpiring, status]);

  return null;
}
