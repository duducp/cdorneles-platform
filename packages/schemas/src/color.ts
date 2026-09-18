import { z } from "zod";

/** Matches `#rgb` and `#rrggbb`. */
export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color such as #6366f1");
