import { z } from "zod";

/** Appwrite team names are limited to 128 characters. */
export const organizationNameSchema = z.string().trim().min(1).max(128);
