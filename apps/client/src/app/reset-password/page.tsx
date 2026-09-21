import type { Metadata } from "next";

import { ResetPasswordPageClient } from "./page-client";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient redirectWhenAuthenticated />;
}
