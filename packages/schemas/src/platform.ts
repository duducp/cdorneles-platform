import { APPLICATION_IDS, THEME_MODES } from "@cdorneles/types";
import { z } from "zod";

export const applicationIdSchema = z.enum(APPLICATION_IDS);

export const themeModeSchema = z.enum(THEME_MODES);
