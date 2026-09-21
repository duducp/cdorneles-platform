import { ForgotPasswordPage } from "@cdorneles/app/auth";

export { forgotPasswordMetadata as metadata } from "@cdorneles/app/auth-metadata";

export default function Page() {
  return <ForgotPasswordPage redirectWhenAuthenticated={false} />;
}
