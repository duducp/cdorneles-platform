import { z } from "zod";

/** Login credentials (e-mail + password). */
export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export type LoginFormValues = z.input<typeof loginSchema>;

/** Password recovery request (e-mail only). */
export const forgotPasswordSchema = z.object({
  email: z.email("Informe um e-mail válido."),
});

export type ForgotPasswordFormValues = z.input<typeof forgotPasswordSchema>;

/** New password + confirmation (Appwrite requires at least 8 characters). */
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    passwordConfirmation: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirmation"],
  });

export type ResetPasswordFormValues = z.input<typeof resetPasswordSchema>;

/** MFA one-time code (six digits). */
export const mfaChallengeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
});

export type MfaChallengeFormValues = z.input<typeof mfaChallengeSchema>;
