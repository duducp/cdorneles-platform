"use client";

import { CreateOrganizationForm } from "../tenant/create-organization-form";
import {
  Avatar,
  Box,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";

export interface OrgSwitcherOrganization {
  id: string;
  name: string;
}

export interface OrgSwitcherProps {
  organizations: OrgSwitcherOrganization[];
  currentOrganizationId?: string | null;
  onSelect: (organizationId: string) => void;
  /**
   * Whether the caller is allowed to create organizations. Only then the
   * "Create organization" item renders at the end of the dropdown.
   */
  canCreate?: boolean;
  /** Creates the organization; required when `canCreate` is set. */
  onCreateOrganization?: (name: string) => Promise<void>;
  /** True while the organization list is still loading. */
  loading?: boolean;
}

/**
 * Topbar organization switcher, modelled after the Appwrite console's project
 * dropdown: current organization on the trigger, the full list in the menu
 * with the active one checked, and "Create organization" last.
 */
export function OrgSwitcher({
  organizations,
  currentOrganizationId,
  onSelect,
  canCreate = false,
  onCreateOrganization,
  loading = false,
}: OrgSwitcherProps) {
  const [createOpened, setCreateOpened] = useState(false);

  const current = organizations.find((org) => org.id === currentOrganizationId) ?? null;
  const canOpenCreate = canCreate && !!onCreateOrganization;

  // CreateOrganizationForm owns submit/feedback state: it disables nothing,
  // keeps the submit enabled and renders its own FormError on failure.
  async function handleCreate(name: string) {
    if (!onCreateOrganization) return;
    await onCreateOrganization(name);
    setCreateOpened(false);
  }

  return (
    <>
      <Menu shadow="md" width={260}>
        <Menu.Target>
          <UnstyledButton
            aria-label="Trocar organização"
            style={{ borderRadius: "var(--mantine-radius-md)" }}
          >
            <Group gap="xs" wrap="nowrap">
              <Avatar size={26} radius="sm" color="brand">
                {(current?.name ?? "?").charAt(0).toUpperCase()}
              </Avatar>
              <Box visibleFrom="sm" maw={160}>
                <Text size="sm" fw={500} truncate>
                  {current?.name ?? "Organization"}
                </Text>
              </Box>
              <ChevronsUpDown size={14} aria-hidden style={{ opacity: 0.6 }} />
            </Group>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          {loading ? (
            <Group justify="center" p="md">
              <Loader size="sm" aria-hidden />
            </Group>
          ) : organizations.length === 0 ? (
            <Menu.Label>Nenhuma organização</Menu.Label>
          ) : (
            organizations.map((org) => {
              const isSelected = org.id === currentOrganizationId;
              return (
                <Menu.Item
                  key={org.id}
                  leftSection={
                    <Avatar size={22} radius="sm" color={isSelected ? "brand" : "gray"}>
                      {org.name.charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  rightSection={isSelected ? <Check size={14} aria-hidden /> : null}
                  fw={isSelected ? 600 : undefined}
                  onClick={() => onSelect(org.id)}
                >
                  {org.name}
                </Menu.Item>
              );
            })
          )}

          {canOpenCreate && (
            <>
              <Divider />
              <Menu.Item
                leftSection={<Plus size={16} aria-hidden />}
                onClick={() => setCreateOpened(true)}
              >
                Create organization
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title="New organization"
        centered
      >
        <CreateOrganizationForm onCreate={handleCreate} onCancel={() => setCreateOpened(false)} />
      </Modal>
    </>
  );
}
