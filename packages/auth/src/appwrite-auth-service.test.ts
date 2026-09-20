import { describe, expect, it, vi } from "vitest";
import { createAppwriteAuthService } from "./appwrite-auth-service";
import { ApiError, type AccountApi } from "@cdorneles/api-client";

function createMockAccountApi(): AccountApi {
  return {
    getCurrentUser: vi.fn(),
    getCurrentSession: vi.fn(),
    listSessions: vi.fn(),
    createEmailPasswordSession: vi.fn(),
    deleteSession: vi.fn(),
    createRecovery: vi.fn(),
    updateRecovery: vi.fn(),
    listMfaFactors: vi.fn(),
    createMfaChallenge: vi.fn(),
    updateMfaChallenge: vi.fn(),
  };
}

const futureDate = new Date(Date.now() + 86400000).toISOString();

describe("createAppwriteAuthService", () => {
  it("is a function", () => {
    expect(typeof createAppwriteAuthService).toBe("function");
  });

  describe("login", () => {
    it("calls createEmailPasswordSession and returns mapped AuthSession", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.createEmailPasswordSession).mockResolvedValue({
        $id: "s1",
        userId: "u1",
        expire: futureDate,
      });

      const service = createAppwriteAuthService(api);
      const session = await service.login({ email: "a@b.com", password: "pass" });

      expect(api.createEmailPasswordSession).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "pass",
      });
      expect(session).toEqual({
        id: "s1",
        userId: "u1",
        expiresAt: futureDate,
      });
    });

    it("propagates SDK errors", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.createEmailPasswordSession).mockRejectedValue(
        new Error("user_invalid_credentials"),
      );

      const service = createAppwriteAuthService(api);
      await expect(service.login({ email: "a@b.com", password: "wrong" })).rejects.toThrow(
        "user_invalid_credentials",
      );
    });
  });

  describe("logout", () => {
    it("calls deleteSession with provided sessionId", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.deleteSession).mockResolvedValue(undefined);

      const service = createAppwriteAuthService(api);
      await service.logout("s1");

      expect(api.deleteSession).toHaveBeenCalledWith("s1");
    });

    it("calls deleteSession with undefined when no sessionId", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.deleteSession).mockResolvedValue(undefined);

      const service = createAppwriteAuthService(api);
      await service.logout();

      expect(api.deleteSession).toHaveBeenCalledWith(undefined);
    });
  });

  describe("getSession", () => {
    it("returns the current session", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.getCurrentSession).mockResolvedValue({
        $id: "s1",
        userId: "u1",
        expire: futureDate,
      });

      const service = createAppwriteAuthService(api);
      const session = await service.getSession();

      expect(api.getCurrentSession).toHaveBeenCalled();
      expect(session).toEqual({
        id: "s1",
        userId: "u1",
        expiresAt: futureDate,
      });
    });

    it("returns null when unauthenticated (401)", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.getCurrentSession).mockRejectedValue(
        new ApiError("Unauthorized", { code: "user_unauthorized", status: 401 }),
      );

      const service = createAppwriteAuthService(api);

      await expect(service.getSession()).resolves.toBeNull();
    });

    it("propagates non-401 errors", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.getCurrentSession).mockRejectedValue(
        new ApiError("Server error", { code: "general_error", status: 500 }),
      );

      const service = createAppwriteAuthService(api);

      await expect(service.getSession()).rejects.toThrow("Server error");
    });
  });

  describe("getCurrentUser", () => {
    it("returns mapped AuthUser", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.getCurrentUser).mockResolvedValue({
        $id: "u1",
        email: "user@example.com",
        name: "User",
        status: true,
        emailVerification: true,
        mfa: false,
      });

      const service = createAppwriteAuthService(api);
      const user = await service.getCurrentUser();

      expect(user).toEqual({
        id: "u1",
        email: "user@example.com",
        name: "User",
        emailVerified: true,
        mfaEnabled: false,
      });
    });

    it("propagates SDK errors", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error("user_unauthorized"));

      const service = createAppwriteAuthService(api);
      await expect(service.getCurrentUser()).rejects.toThrow("user_unauthorized");
    });
  });

  describe("requestPasswordRecovery", () => {
    it("delegates to accountApi.createRecovery", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.createRecovery).mockResolvedValue(undefined);

      const service = createAppwriteAuthService(api);
      await service.requestPasswordRecovery({
        email: "a@b.com",
        redirectUrl: "https://app.test/reset-password",
      });

      expect(api.createRecovery).toHaveBeenCalledWith({
        email: "a@b.com",
        url: "https://app.test/reset-password",
      });
    });

    it("propagates SDK errors", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.createRecovery).mockRejectedValue(new Error("user_invalid_credentials"));

      const service = createAppwriteAuthService(api);
      await expect(
        service.requestPasswordRecovery({ email: "a@b.com", redirectUrl: "https://app.test/reset" }),
      ).rejects.toThrow("user_invalid_credentials");
    });
  });

  describe("confirmPasswordRecovery", () => {
    it("delegates to accountApi.updateRecovery", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.updateRecovery).mockResolvedValue(undefined);

      const service = createAppwriteAuthService(api);
      await service.confirmPasswordRecovery({
        userId: "u1",
        secret: "s1",
        password: "new-pass",
      });

      expect(api.updateRecovery).toHaveBeenCalledWith({
        userId: "u1",
        secret: "s1",
        password: "new-pass",
        passwordAgain: "new-pass",
      });
    });

    it("propagates SDK errors", async () => {
      const api = createMockAccountApi();
      vi.mocked(api.updateRecovery).mockRejectedValue(new Error("invalid_secret"));

      const service = createAppwriteAuthService(api);
      await expect(
        service.confirmPasswordRecovery({ userId: "u1", secret: "bad", password: "p" }),
      ).rejects.toThrow("invalid_secret");
    });
  });

  describe("completeMfa", () => {
    it("throws not implemented", async () => {
      const api = createMockAccountApi();
      const service = createAppwriteAuthService(api);
      await expect(service.completeMfa({ challengeId: "c1", code: "123" })).rejects.toThrow(
        "MFA not implemented yet",
      );
    });
  });
});
