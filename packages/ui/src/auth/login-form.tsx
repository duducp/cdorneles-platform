"use client";

import { loginSchema, type LoginFormValues } from "@cdorneles/schemas";
import { Anchor, Box, Divider, Group, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AlertCircle } from "lucide-react";

import { Button } from "../components/button";
import { SocialLogin } from "./social-login";

export type LoginCredentials = LoginFormValues;

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  showSignUp?: boolean;
  onGoogleClick?: () => void;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
}

export function LoginForm({
  onSubmit,
  loading = false,
  error = null,
  showSignUp = false,
  onGoogleClick,
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

  const handleSubmit = form.onSubmit((values) => onSubmit(values));

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate p="xl">
      <Stack gap={4}>
        <Text fw={600} fz="xl">
          Bem-vindo de volta
        </Text>
        <Text c="dimmed" fz="sm">
          Entre na sua conta
        </Text>
      </Stack>

      <Stack gap="md" mt="lg">
        <SocialLogin onGoogleClick={onGoogleClick} disabled={loading} />

        <Divider label="OU CONTINUE COM" labelPosition="center" />

        <TextInput
          label="E-mail"
          placeholder="seu@email.com"
          autoComplete="email"
          disabled={loading}
          {...form.getInputProps("email")}
        />
        <PasswordInput
          label="Senha"
          placeholder="Sua senha"
          autoComplete="current-password"
          disabled={loading}
          {...form.getInputProps("password")}
        />

        <Anchor component="button" type="button" size="sm" c="brand" onClick={onForgotPassword}>
          Esqueci minha senha
        </Anchor>

        {error ? (
          <Group gap={6} wrap="nowrap" role="alert">
            <AlertCircle size={16} aria-hidden />
            <Text c="danger" fz="sm">
              {error}
            </Text>
          </Group>
        ) : null}

        <Button type="submit" fullWidth loading={loading} disabled={loading}>
          Entrar
        </Button>

        {showSignUp ? (
          <Text fz="sm" ta="center" c="dimmed">
            Não tem uma conta?{" "}
            <Anchor component="button" type="button" c="brand" onClick={onSignUp}>
              Criar conta
            </Anchor>
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
