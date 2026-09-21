import "@testing-library/jest-dom/vitest";

import { notifications, notificationsStore } from "@mantine/notifications";
import { beforeEach, describe, expect, it } from "vitest";

import {
  NOTIFICATION_AUTO_CLOSE,
  notifyError,
  notifyHide,
  notifyInfo,
  notifySuccess,
} from "./notify";

interface StoredNotification {
  id?: string;
  color?: string;
  icon?: unknown;
  autoClose?: number | false;
}

/** Reads the store the `notifications` singleton writes to. */
function visible(): StoredNotification[] {
  return notificationsStore.getState().notifications as StoredNotification[];
}

describe("notify", () => {
  beforeEach(() => {
    notifications.clean();
  });

  it("keeps an error open until it is dismissed", () => {
    notifyError("Não foi possível salvar.");

    expect(visible()[0].autoClose).toBe(false);
    expect(NOTIFICATION_AUTO_CLOSE.error).toBe(false);
  });

  it("closes a success on its own", () => {
    notifySuccess("Organização atualizada.");

    expect(visible()[0].autoClose).toBe(NOTIFICATION_AUTO_CLOSE.success);
  });

  it("lets a caller override the duration", () => {
    notifyInfo("oi", { autoClose: 1234 });

    expect(visible()[0].autoClose).toBe(1234);
  });

  it("does not stack duplicates when a stable id is re-shown", () => {
    notifyInfo("Sessão expirando.", { id: "session-expiring" });
    notifyInfo("Sessão expirando.", { id: "session-expiring" });

    expect(visible()).toHaveLength(1);
  });

  it("removes a toast by id", () => {
    const id = notifyInfo("oi");

    notifyHide(id);

    expect(visible()).toHaveLength(0);
  });

  it("pairs every kind with an icon and a theme color", () => {
    notifyError("e");
    notifyInfo("i");
    notifySuccess("s");

    expect(visible().map((n) => n.color)).toEqual(["danger", "info", "success"]);
    for (const notification of visible()) {
      expect(notification.icon).toBeTruthy();
    }
  });
});
