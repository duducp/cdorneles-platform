import {
  Card,
  EmptyState,
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
        <PageHeader title="Cdorneles Customer" description="End-customer experience." />

        <Section title="Foundation status">
          <ResponsiveGrid>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="active" />
                <strong>Shared UI</strong>
                <span>Design system, theme and tokens connected.</span>
              </Stack>
            </Card>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="info" />
                <strong>Tenant aware</strong>
                <span>Organization context available through providers.</span>
              </Stack>
            </Card>
          </ResponsiveGrid>
        </Section>

        <Card padding={0}>
          <EmptyState
            title="No customer data yet"
            description="Business modules will be added in a later phase."
          />
        </Card>
      </Stack>
    </PageContainer>
  );
}
