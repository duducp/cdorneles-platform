import type { Metadata } from "next";

import { LoginPageClient } from "./page-client";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return <LoginPageClient redirectWhenAuthenticated />;
}
