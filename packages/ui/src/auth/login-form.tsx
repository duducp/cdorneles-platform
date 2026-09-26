"use client";

import { loginSchema, type LoginFormValues } from "@cdorneles/schemas";
import { Anchor, Box, Divider, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import type { ReactNode } from "react";
import { Button } from "../components/button";
import { FormError } from "../components/form-error";

export type LoginCredentials = LoginFormValues;

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  showSignUp?: boolean;
  heading?: string;
  showGoogle?: boolean;
  /** Caller-owned Google sign-in content rendered with the divider. */
  googleSlot?: ReactNode;
  onForgotPassword?: (email: string) => void;
  onSignUp?: () => void;
}

export function LoginForm({
  onSubmit,
  loading = false,
  error = null,
  showSignUp = false,
  heading = "Bem-vindo de volta",
  showGoogle = true,
  googleSlot,
  onForgotPassword,
  onSignUp,
}: LoginFormProps) {
  const form = useForm<LoginCredentials>({
    initialValues: { email: "", password: "" },
    validate: (values) => {
      const result = loginSchema.safeParse(values);
      if (result.success) {
        return {};
      }
      const errors: Partial<Record<keyof LoginCredentials, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if ((key === "email" || key === "password") && errors[key] === undefined) {
          errors[key] = issue.message;
        }
      }
      return errors;
    },
  });

  const handleSubmit = form.onSubmit(
    (values) => onSubmit(values),
    (errors) => {
      const firstInvalid = (["email", "password"] as const).find(
        (field) => errors[field] !== undefined,
      );
      if (firstInvalid) {
        form.getInputNode(firstInvalid)?.focus();
      }
    },
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={loading || undefined}
      aria-describedby={error ? "login-form-error" : undefined}
    >
      <FormError id="login-form-error" mb="md">
        {error}
      </FormError>

      <Stack gap={4}>
        <Text component="h1" fw={600} fz="xl">
          {heading}
        </Text>
        <Text c="dimmed" fz="sm">
          Entre na sua conta
        </Text>
      </Stack>

      <Stack gap="md" mt="lg">
        {showGoogle && googleSlot ? (
          <>
            {googleSlot}
            <Divider label="OU CONTINUE COM" labelPosition="center" />
          </>
        ) : null}

        <TextInput
          label="E-mail"
          placeholder="seu@email.com"
          type="email"
          inputMode="email"
          autoComplete="email"
          disabled={loading}
          {...form.getInputProps("email")}
        />
        <PasswordInput
          label="Senha"
          placeholder="Sua senha"
          autoComplete="current-password"
          disabled={loading}
          visibilityToggleFocusable
          visibilityToggleButtonProps={{ "aria-label": "Alternar visibilidade da senha" }}
          {...form.getInputProps("password")}
          aria-invalid={form.errors.password ? true : undefined}
        />

        <Anchor
          component="button"
          type="button"
          size="sm"
          underline="hover"
          c="brand"
          ta="start"
          onClick={() => onForgotPassword?.(form.values.email)}
        >
          Esqueci minha senha
        </Anchor>

        <Button type="submit" fullWidth loading={loading} disabled={loading}>
          Entrar
        </Button>

        {showSignUp ? (
          <Text fz="sm" ta="center" c="dimmed">
            Não tem uma conta?{" "}
            <Anchor component="button" type="button" underline="hover" c="brand" onClick={onSignUp}>
              Criar conta
            </Anchor>
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
