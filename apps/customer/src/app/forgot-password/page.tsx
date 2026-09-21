import type { Metadata } from "next";

import { ForgotPasswordPageClient } from "./page-client";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient redirectWhenAuthenticated />;
}
