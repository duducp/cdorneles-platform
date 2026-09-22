import { ApiError } from "@cdorneles/api-client";
import { describe, expect, it } from "vitest";

import { describeAuthError } from "./describe-error";
import { AuthNotConfiguredError } from "./provider";

describe("describeAuthError", () => {
  it("maps invalid credentials", () => {
    const error = new ApiError("Invalid credentials", {
      code: "user_invalid_credentials",
      status: 401,
    });
    expect(describeAuthError(error)).toBe("E-mail ou senha inválidos.");
  });

  it("treats an unknown user as invalid credentials, to avoid enumeration", () => {
    const error = new ApiError("User not found", { code: "user_not_found", status: 404 });
    expect(describeAuthError(error)).toBe("E-mail ou senha inválidos.");
  });

  it("maps a blocked account", () => {
    const error = new ApiError("Blocked", { code: "user_blocked", status: 401 });
    expect(describeAuthError(error)).toBe("Conta bloqueada. Fale com um administrador.");
  });

  it("maps rate limiting by code", () => {
    const error = new ApiError("Too many", {
      code: "general_rate_limit_exceeded",
      status: 429,
    });
    expect(describeAuthError(error)).toContain("Muitas tentativas");
  });

  it("maps rate limiting by status when the code is unfamiliar", () => {
    const error = new ApiError("Too many", { code: "something_new", status: 429 });
    expect(describeAuthError(error)).toContain("Muitas tentativas");
  });

  it("reports a misconfigured environment", () => {
    expect(describeAuthError(new AuthNotConfiguredError("login"))).toBe(
      "Autenticação não configurada neste ambiente.",
    );
  });

  it("falls back for an unknown error", () => {
    expect(describeAuthError(new Error("boom"))).toBe("Não foi possível entrar. Tente novamente.");
    expect(describeAuthError(new ApiError("odd", { code: "weird_thing", status: 500 }))).toBe(
      "Não foi possível entrar. Tente novamente.",
    );
  });
});
