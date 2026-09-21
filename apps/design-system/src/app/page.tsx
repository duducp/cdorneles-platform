"use client";

import {
  breakpoints,
  elevation,
  fontSizes,
  fontWeights,
  palettes,
  radius,
  spacing,
} from "@cdorneles/tokens";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  notifyError,
  notifyInfo,
  notifySuccess,
  PageContainer,
  PageHeader,
  ResponsiveGrid,
  Section,
  Stack,
  StatusBadge,
  STATUS_VALUES,
  ThemeToggle,
} from "@cdorneles/ui";
import {
  Anchor,
  Box,
  Checkbox,
  Code,
  Group,
  Select,
  SimpleGrid,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** Auth and tenant screens shipped in this app. */
const SCREENS = [
  {
    href: "/login",
    title: "Login",
    description: "E-mail e senha, com detecção de MFA.",
  },
  {
    href: "/forgot-password",
    title: "Esqueci minha senha",
    description: "Solicita o e-mail de recuperação.",
  },
  {
    href: "/reset-password",
    title: "Redefinir senha",
    description: "Define uma nova senha a partir do link recebido.",
  },
  {
    href: "/mfa",
    title: "Verificação em duas etapas",
    description: "Código por app autenticador ou e-mail.",
  },
  {
    href: "/select-org",
    title: "Selecionar organização",
    description: "Escolhe a organização ativa e cria uma nova.",
  },
];

export default function DesignSystemPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [notifications, setNotifications] = useState(false);

  return (
    <PageContainer size="xl" py="xl">
      <Stack gap="xl">
        <PageHeader
          title="Cdorneles Design System"
          description="Playground for tokens, components and states. Toggle Light/Dark to verify both themes."
          actions={
            <Group gap="sm">
              <Badge color="gray">v{process.env.NEXT_PUBLIC_APP_VERSION}</Badge>
              <ThemeToggle />
            </Group>
          }
        />

        <Section
          title="Screens"
          description="Fluxos de autenticação e de organização implementados neste app."
        >
          <ResponsiveGrid columns={{ base: 1, sm: 2, md: 3 }}>
            {SCREENS.map((screen) => (
              <Card key={screen.href}>
                <Stack gap="xs">
                  <Text fw={fontWeights.semibold}>{screen.title}</Text>
                  <Text size="sm" c="dimmed">
                    {screen.description}
                  </Text>
                  <Anchor component={Link} href={screen.href} underline="always">
                    Abrir
                  </Anchor>
                </Stack>
              </Card>
            ))}
          </ResponsiveGrid>
        </Section>

        <Section title="Colors" description="Token palettes (index 0 lightest → 9 darkest).">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {Object.entries(palettes).map(([name, scale]) => (
              <Stack key={name} gap={6}>
                <Text fw={fontWeights.semibold} size="sm">
                  {name}
                </Text>
                <Group gap={2} wrap="nowrap">
                  {scale.map((shade, index) => (
                    <Box
                      key={index}
                      w={20}
                      h={32}
                      bg={shade}
                      style={{ borderRadius: radius.xs, border: "1px solid rgba(0,0,0,0.06)" }}
                    />
                  ))}
                </Group>
              </Stack>
            ))}
          </SimpleGrid>
        </Section>

        <Section title="Typography" description="Default UI size is 14px.">
          <Stack gap="xs">
            {Object.entries(fontSizes).map(([token, size]) => (
              <Text key={token} fz={size}>
                {token} — {size}px
              </Text>
            ))}
          </Stack>
        </Section>

        <Section title="Spacing" description="Spacing scale in pixels.">
          <Stack gap="xs">
            {Object.entries(spacing).map(([token, value]) => (
              <Group key={token} gap="sm">
                <Text w={40} size="xs" c="dimmed">
                  {token}
                </Text>
                <Box h={12} w={value} bg="var(--mantine-color-brand-5)" />
                <Text size="xs" c="dimmed">
                  {value}px
                </Text>
              </Group>
            ))}
          </Stack>
        </Section>

        <Section title="Radius and elevation" description="Low elevation, subtle borders.">
          <ResponsiveGrid columns={{ base: 1, sm: 2, md: 3 }}>
            {Object.entries(radius).map(([token, value]) => (
              <Box
                key={token}
                h={64}
                bg="var(--mantine-color-default)"
                style={{
                  borderRadius: value,
                  border: "1px solid var(--mantine-color-default-border)",
                }}
              >
                <Text size="xs" c="dimmed" p="xs">
                  radius.{token}
                </Text>
              </Box>
            ))}
            {Object.entries(elevation).map(([token, value]) => (
              <Box key={token} h={64} bg="var(--mantine-color-body)" style={{ boxShadow: value }}>
                <Text size="xs" c="dimmed" p="xs">
                  elevation.{token}
                </Text>
              </Box>
            ))}
          </ResponsiveGrid>
        </Section>

        <Section title="Buttons" description="Semantic variants mapped onto Mantine.">
          <Group gap="sm">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="danger">Danger</Button>
            <IconButton icon={Plus} label="Add" variant="default" />
            <IconButton icon={Search} label="Search" />
            <IconButton icon={Trash2} label="Delete" color="danger" />
          </Group>
        </Section>

        <Section
          title="Feedback"
          description="Toasts are for transient outcomes. A failed form keeps its inline FormError instead — a toast that expires takes the reason with it."
        >
          <Group gap="sm">
            <Button variant="primary" onClick={() => notifySuccess("Organização atualizada.")}>
              Success
            </Button>
            <Button variant="secondary" onClick={() => notifyInfo("Sua sessão expira em alguns minutos.")}>
              Info
            </Button>
            <Button variant="danger" onClick={() => notifyError("Não foi possível salvar.")}>
              Error (persists)
            </Button>
          </Group>
        </Section>

        <Section
          title="Inputs"
          description="Form controls come from Mantine (Mantine Form is the form layer)."
        >
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <TextInput
              label="Name"
              placeholder="Type a name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Select
              label="Role"
              placeholder="Select"
              data={["Admin", "Member", "Viewer"]}
              value={role}
              onChange={setRole}
            />
            <TextInput label="Disabled" placeholder="Disabled" disabled />
            <Checkbox
              label="Active"
              checked={active}
              onChange={(event) => setActive(event.currentTarget.checked)}
            />
            <Switch
              label="Notifications"
              checked={notifications}
              onChange={(event) => setNotifications(event.currentTarget.checked)}
            />
          </SimpleGrid>
        </Section>

        <Section title="Cards" description="Surface container defaults.">
          <ResponsiveGrid>
            <Card>
              <Stack gap="xs">
                <Text fw={fontWeights.semibold}>Default card</Text>
                <Text size="sm" c="dimmed">
                  Border, subtle shadow and medium radius.
                </Text>
                <Button variant="secondary" size="xs">
                  Action
                </Button>
              </Stack>
            </Card>
            <Card shadow="md">
              <Stack gap="xs">
                <Text fw={fontWeights.semibold}>Elevated card</Text>
                <Text size="sm" c="dimmed">
                  Higher shadow for emphasis.
                </Text>
              </Stack>
            </Card>
            <Card withBorder={false} bg="var(--mantine-color-gray-1)">
              <Stack gap="xs">
                <Text fw={fontWeights.semibold}>Borderless card</Text>
                <Text size="sm" c="dimmed">
                  Uses a surface background instead of a border.
                </Text>
              </Stack>
            </Card>
          </ResponsiveGrid>
        </Section>

        <Section title="Badges" description="Generic badges and the semantic status vocabulary.">
          <Stack gap="sm">
            <Group gap="sm">
              <Badge color="brand">Brand</Badge>
              <Badge color="success">Success</Badge>
              <Badge color="warning">Warning</Badge>
              <Badge color="danger">Danger</Badge>
              <Badge color="brand" variant="filled">
                Filled
              </Badge>
            </Group>
            <Group gap="sm">
              {STATUS_VALUES.map((status) => (
                <StatusBadge key={status} status={status} />
              ))}
            </Group>
          </Stack>
        </Section>

        <Section title="States" description="Loading, empty and error patterns.">
          <ResponsiveGrid columns={{ base: 1, md: 3 }}>
            <Card padding={0}>
              <LoadingState label="Loading data" />
            </Card>
            <Card padding={0}>
              <EmptyState
                title="No records"
                description="Create the first record to get started."
                action={
                  <Button size="xs" variant="secondary">
                    Create
                  </Button>
                }
              />
            </Card>
            <Card padding={0}>
              <ErrorState
                title="Failed to load"
                description="Something went wrong while loading data."
                onRetry={() => undefined}
              />
            </Card>
          </ResponsiveGrid>
        </Section>

        <Section title="Responsiveness" description="Breakpoints shared by every application.">
          <Stack gap="sm">
            <Group gap="sm">
              {Object.entries(breakpoints).map(([token, value]) => (
                <Group key={token} gap={4}>
                  <Code>{token}</Code>
                  <Text size="sm" c="dimmed">
                    {value}px
                  </Text>
                </Group>
              ))}
            </Group>
            <ResponsiveGrid columns={{ base: 1, sm: 2, md: 3, lg: 4, xl: 6 }}>
              {Array.from({ length: 6 }, (_, index) => (
                <Card key={index} padding="sm">
                  <Text size="sm">Item {index + 1}</Text>
                </Card>
              ))}
            </ResponsiveGrid>
          </Stack>
        </Section>
      </Stack>
    </PageContainer>
  );
}
