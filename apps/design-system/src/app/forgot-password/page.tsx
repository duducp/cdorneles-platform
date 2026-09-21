import type { Metadata } from "next";

import { ForgotPasswordPageClient } from "./page-client";

export const metadata: Metadata = { title: "Recuperar senha" };

/**
 * Reads `?email=` on the server so the client component stays free of
 * `useSearchParams`, which would otherwise force a Suspense boundary around a
 * statically rendered page. The login screen links here with the address the
 * user already typed.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return <ForgotPasswordPageClient initialEmail={email} />;
}
