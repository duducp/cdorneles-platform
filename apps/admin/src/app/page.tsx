import {
  Button,
  Card,
  PageContainer,
  PageHeader,
  ResponsiveGrid,
  Section,
  Stack,
  StatusBadge,
} from "@cdorneles/ui";

export default function HomePage() {
  return (
    <PageContainer py="xl">
      <Stack gap="xl">
        <PageHeader
          title="Cdorneles Admin"
          description="Internal administration of the Cdorneles Platform."
          actions={<Button>Placeholder action</Button>}
        />

        <Section
          title="Foundation status"
          description="The monorepo foundation is wired and ready for business modules."
        >
          <ResponsiveGrid>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="active" />
                <strong>Design system</strong>
                <span>@cdorneles/ui, theme and tokens are connected.</span>
              </Stack>
            </Card>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="info" />
                <strong>Auth</strong>
                <span>Appwrite authentication abstraction prepared.</span>
              </Stack>
            </Card>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="pending" />
                <strong>Tenancy</strong>
                <span>Organization context prepared (Appwrite Team).</span>
              </Stack>
            </Card>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="neutral" />
                <strong>Observability</strong>
                <span>Provider-agnostic abstraction, noop by default.</span>
              </Stack>
            </Card>
          </ResponsiveGrid>
        </Section>
      </Stack>
    </PageContainer>
  );
}
