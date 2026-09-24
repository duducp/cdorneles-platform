"use client";

import { isApiError } from "@cdorneles/api-client";
import { forgotPasswordSchema } from "@cdorneles/schemas";
import {
  describeAuthError,
  MfaRequiredError,
  resolvePostAuthRedirect,
  useAuth,
  useRedirectIfAuthenticated,
} from "@cdorneles/auth";
import { AppVersion, AuthCard, AuthVisual, LoginForm, Logo, ThemeToggle } from "@cdorneles/ui";
import { describeOneTapError, GoogleOneTap } from "./google-one-tap";
import { isGoogleAuthEnabled } from "./google-auth-enabled";
import { Flex, Stack, VisuallyHidden } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const LAST_METHOD_KEY = "cdorneles-last-login-method";
type LoginMethod = "email" | "google";

export interface LoginPageProps {
  /**
   * Send an already-authenticated visitor to the app instead of showing the
   * form. Defaults to on; the design-system gallery passes false so every
   * screen stays viewable there.
   */
  redirectWhenAuthenticated?: boolean;
}

export function LoginPage({ redirectWhenAuthenticated = true }: LoginPageProps) {
  const { login, status } = useAuth();
  const router = useRouter();
  const goToApp = useCallback(() => {
    router.replace(resolvePostAuthRedirect(window.location.search));
  }, [router]);
  const canRender = useRedirectIfAuthenticated(redirectWhenAuthenticated, goToApp);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [oneTapLoading, setOneTapLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  // Read the stored method only after hydration: the auth routes are
  // prerendered, so touching localStorage during render would mismatch the
  // server's neutral heading.
  const [lastMethod, setLastMethod] = useState<LoginMethod | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem(LAST_METHOD_KEY);
    setLastMethod(stored === "email" || stored === "google" ? stored : null);
  }, []);
  const enableSignUp = process.env.NEXT_PUBLIC_ENABLE_SIGN_UP === "true";
  // One Tap only runs with a configured client id, and only for confirmed
  // anonymous visitors — never while the session is still being resolved and
  // never for an authenticated user (requirement 5).
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleEnabled = isGoogleAuthEnabled();
  const heading = lastMethod ? "Bem-vindo de volta" : "Bem vindo";

  // Carry a valid e-mail to the recovery screen so it does not have to be
  // retyped; anything else goes to the plain screen and is validated there.
  const handleForgotPassword = useCallback(
    (email: string) => {
      const valid = forgotPasswordSchema.shape.email.safeParse(email).success;
      router.push(
        valid ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password",
      );
    },
    [router],
  );

  // One Tap errors arrive raw: only an MFA challenge gets special routing;
  // everything else becomes display text via the module's mapper.
  const handleOneTapError = useCallback(
    (err: unknown) => {
      setOneTapLoading(false);
      if (err instanceof MfaRequiredError) {
        router.push(
          `/mfa?redirect=${encodeURIComponent(resolvePostAuthRedirect(window.location.search))}`,
        );
        return;
      }
      setError(describeOneTapError(err));
    },
    [router],
  );

  async function handleSubmit(credentials: { email: string; password: string }) {
    setError(null);
    setAnnouncement("Entrando...");
    setLoading(true);
    try {
      await login(credentials);
      localStorage.setItem(LAST_METHOD_KEY, "email");
      // Honour the path the proxy sent the user away from.
      router.push(resolvePostAuthRedirect(window.location.search));
    } catch (err) {
      setAnnouncement("");
      if (err instanceof MfaRequiredError) {
        router.push(
          `/mfa?redirect=${encodeURIComponent(resolvePostAuthRedirect(window.location.search))}`,
        );
      } else if (isApiError(err) && err.code === "user_session_already_exists") {
        // The browser already holds a valid session — there is nothing to fix,
        // so let the user straight through instead of showing a failure.
        router.push(resolvePostAuthRedirect(window.location.search));
      } else {
        setError(describeAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!canRender) {
    return null;
  }

  return (
    <Flex direction="column" mih="100dvh">
      {googleEnabled && !!googleClientId ? (
        <GoogleOneTap
          clientId={googleClientId ?? ""}
          enabled={canRender && status === "anonymous" && !!googleClientId}
          buttonParentRef={googleButtonRef}
          buttonText={lastMethod === "google" ? "continue_with" : "signin_with"}
          onSuccess={() => {
            // Clear before navigating: a redirect to the same route (e.g.
            // `/login?redirect=/login`) fires no unmount, so the overlay would
            // otherwise stay up forever.
            setOneTapLoading(false);
            // Land where a successful e-mail/password login would.
            router.replace(resolvePostAuthRedirect(window.location.search));
          }}
          onStart={() => {
            setOneTapLoading(true);
            localStorage.setItem(LAST_METHOD_KEY, "google");
          }}
          onError={handleOneTapError}
        />
      ) : null}
      <Flex justify="flex-end" p="sm">
        <ThemeToggle />
      </Flex>

      <Flex component="main" align="center" justify="center" p="md" style={{ flex: 1 }}>
        <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
        <Stack w="100%" maw={920} gap="xl">
          <AuthCard
            form={
              <LoginForm
                onSubmit={handleSubmit}
                loading={loading}
                error={error}
                showSignUp={enableSignUp}
                heading={heading}
                showGoogle={googleEnabled && !!googleClientId && status === "anonymous"}
                googleSlot={
                  <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center" }} />
                }
                onForgotPassword={handleForgotPassword}
              />
            }
            visual={<AuthVisual />}
            loading={oneTapLoading}
          />

          <Stack component="footer" align="center" gap="sm">
            <Logo alt="Cdorneles" variant="horizontal" height={32} />
            <AppVersion />
          </Stack>
        </Stack>
      </Flex>
    </Flex>
  );
}
