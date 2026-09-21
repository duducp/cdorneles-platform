import { MfaPage } from "@cdorneles/app/auth";

export { mfaMetadata as metadata } from "@cdorneles/app/auth-metadata";

export default function Page() {
  return <MfaPage redirectWhenAuthenticated={false} />;
}
