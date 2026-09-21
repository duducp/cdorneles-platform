import { LoginPage } from "@cdorneles/app/auth";

export { loginMetadata as metadata } from "@cdorneles/app/auth-metadata";

export default function Page() {
  return <LoginPage redirectWhenAuthenticated={false} />;
}
