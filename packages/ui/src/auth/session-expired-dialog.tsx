"use client";

import { Button, Divider, Modal, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { LockIcon } from "lucide-react";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";

import { FormError } from "../components/form-error";
import { MfaChallengeForm, type MfaChallengeFormValues } from "./mfa-challenge-form";
import { SocialLogin } from "./social-login";

/**
 * The shell both re-authentication steps share.
 *
 * Deliberately not dismissible: the session is gone, so there is nothing to
 * dismiss to. The only exits are authenticating or signing out, and both are
 * explicit. It is a modal rather than a navigation because the page behind it
 * must stay mounted — that is the whole point.
 */
function ReauthModal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Modal
      opened
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      centered
      title={title}
    >
      {children}
    </Modal>
  );
}

export interface GoogleReauthOption {
  onClick: () => void;
  /** Defaults to "Continuar com Google". */
  label?: string;
  disabled?: boolean;
}

export interface SessionExpiredDialogProps {
  /** The last known e-mail. Prefilled so only the password is typed. */
  email: string;
  onSubmit: (password: string) => Promise<void>;
  /** Leaves for the login page. The only way out without authenticating. */
  onSignOut: () => void;
  /** Shows Google re-auth below the password form when present. */
  google?: GoogleReauthOption;
  /** A caller-owned message (Google failures). A local submit error takes precedence. */
  errorMessage?: string | null;
}

/** First step: the password. */
export function SessionExpiredDialog({
  email,
  onSubmit,
  onSignOut,
  google,
  errorMessage,
}: SessionExpiredDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        await onSubmit(password);
        setPassword("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit, password],
  );

  return (
    <ReauthModal title="Sua sessão expirou">
      <Text c="dimmed" fz="sm" mb="md">
        Entre novamente para continuar de onde parou. Nada do que está na tela foi perdido.
      </Text>

      <form onSubmit={handleSubmit} noValidate>
        <FormError mb="md">{error ?? errorMessage}</FormError>

        <Stack gap="md">
          {/*
            Read-only (not disabled) on purpose: it keeps the known account
            visible and gives the modal's focus trap a first tabbable element
            that is not the password, so `data-autofocus` on the password
            genuinely controls the initial focus.
          */}
          <TextInput label="Conta" value={email} readOnly />

          <PasswordInput
            label="Senha"
            placeholder="Sua senha"
            required
            autoComplete="current-password"
            leftSection={<LockIcon size={16} aria-hidden />}
            visibilityToggleFocusable
            visibilityToggleButtonProps={{ "aria-label": "Alternar visibilidade da senha" }}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            aria-invalid={error ? true : undefined}
            data-autofocus
          />

          <Button type="submit" fullWidth loading={submitting}>
            Entrar
          </Button>

          {google ? (
            <>
              <Divider label="ou" labelPosition="center" />
              <SocialLogin
                onGoogleClick={() => {
                  setError(null);
                  google.onClick();
                }}
                disabled={google.disabled}
                label={google.label ?? "Continuar com Google"}
              />
            </>
          ) : null}

          <Button type="button" variant="subtle" fullWidth onClick={onSignOut}>
            Entrar com outra conta
          </Button>
        </Stack>
      </form>
    </ReauthModal>
  );
}

export interface SessionExpiredMfaDialogProps {
  onSubmit: (values: MfaChallengeFormValues) => Promise<void>;
  onResend?: () => Promise<void>;
  onSignOut: () => void;
}

/**
 * Second step: the code. Rendered in place, in the same shell — the login page
 * navigates to /mfa here, which would discard the page this exists to preserve.
 */
export function SessionExpiredMfaDialog({
  onSubmit,
  onResend,
  onSignOut,
}: SessionExpiredMfaDialogProps) {
  return (
    <ReauthModal title="Confirme o código">
      <MfaChallengeForm onSubmit={onSubmit} onResend={onResend} />
      <Button type="button" variant="subtle" fullWidth mt="md" onClick={onSignOut}>
        Entrar com outra conta
      </Button>
    </ReauthModal>
  );
}
