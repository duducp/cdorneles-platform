"use client";

import { createProviders } from "@cdorneles/app";
import * as Sentry from "@sentry/nextjs";

export const Providers = createProviders({ applicationId: "admin", observability: Sentry });
