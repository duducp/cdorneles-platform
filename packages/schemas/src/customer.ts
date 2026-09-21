import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.email(),
  phone: z.string().trim().max(20).nullish(),
  document: z.string().trim().max(20).nullish(),
  active: z.boolean().default(true),
});

export type CustomerInput = z.infer<typeof customerSchema>;
