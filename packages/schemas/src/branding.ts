import { z } from "zod";

import { hexColorSchema } from "./color";
import { themeModeSchema } from "./platform";

/**
 * White-label branding (ADR-006). URLs and colors are optional; only the
 * display name and default theme are required.
 */
export const brandingSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  logoLight: z.url().nullish(),
  logoDark: z.url().nullish(),
  favicon: z.url().nullish(),
  primaryColor: hexColorSchema.nullish(),
  secondaryColor: hexColorSchema.nullish(),
  defaultTheme: themeModeSchema,
});

export type BrandingInput = z.input<typeof brandingSchema>;
export type BrandingOutput = z.output<typeof brandingSchema>;
