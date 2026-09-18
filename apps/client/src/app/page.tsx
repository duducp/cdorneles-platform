import {
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
          title="Cdorneles Client"
          description="Organization administration and operational panel."
        />

        <Section
          title="Foundation status"
          description="Shared packages are wired and ready for business modules."
        >
          <ResponsiveGrid>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="active" />
                <strong>Organization context</strong>
                <span>Appwrite Team is the organization boundary.</span>
              </Stack>
            </Card>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="info" />
                <strong>Permissions</strong>
                <span>Capability checks prepared, enforced server-side.</span>
              </Stack>
            </Card>
            <Card>
              <Stack gap="xs">
                <StatusBadge status="pending" />
                <strong>API client</strong>
                <span>Single Appwrite access layer, adapter pending.</span>
              </Stack>
            </Card>
          </ResponsiveGrid>
        </Section>
      </Stack>
    </PageContainer>
  );
}
