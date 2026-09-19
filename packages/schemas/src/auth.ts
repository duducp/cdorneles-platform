import { z } from "zod";

/** Login credentials (e-mail + password). */
export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export type LoginFormValues = z.input<typeof loginSchema>;
