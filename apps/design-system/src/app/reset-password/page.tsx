import { ResetPasswordPage } from "@cdorneles/app/auth";

export { resetPasswordMetadata as metadata } from "@cdorneles/app/auth-metadata";

export default function Page() {
  return <ResetPasswordPage redirectWhenAuthenticated={false} />;
}
