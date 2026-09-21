import type { Metadata } from "next";

import { MfaPageClient } from "./page-client";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default function MfaPage() {
  return <MfaPageClient />;
}
