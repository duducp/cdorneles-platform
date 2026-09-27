import { isApiError } from "@cdorneles/api-client";

import { AuthNotConfiguredError } from "./provider";

/**
 * Turns an authentication failure into something worth showing a user.
 *
 * The Appwrite `type` (surfaced as `ApiError.code`) is the stable key; known
 * causes get a specific message instead of being swallowed into a generic one,
 * which is what makes a failure diagnosable for the person hitting it.
 */
export function describeAuthError(
  error: unknown,
  fallback = "Não foi possível entrar. Tente novamente.",
): string {
  if (error instanceof AuthNotConfiguredError) {
    return "Autenticação não configurada neste ambiente.";
  }

  if (isApiError(error)) {
    switch (error.code) {
      case "user_invalid_credentials":
      case "user_not_found":
        return "E-mail ou senha inválidos.";
      case "user_blocked":
        return "Conta bloqueada. Fale com um administrador.";
      case "general_argument_invalid":
        return "Verifique os dados informados.";
      case "account_mismatch":
        return "Esta conta Google não corresponde à sua conta.";
      case "user_invalid_token":
        return "Código inválido ou expirado. Solicite um novo código.";
      case "general_rate_limit_exceeded":
        return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
      case "invalid_turnstile_token":
        return "Não foi possível verificar que você é humano. Tente novamente.";
      case "turnstile_verification_failed":
        return "Não foi possível concluir a verificação. Tente novamente.";
      case "turnstile_not_configured":
        return "Verificação de segurança não configurada neste ambiente.";
      default:
        break;
    }

    if (error.status === 429) {
      return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
    }
  }

  return fallback;
}
