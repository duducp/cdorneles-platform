"use client";

import { Avatar, Box, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown, LogOut, Settings } from "lucide-react";

/** The trigger shows the first name plus the last name ("Ana Silva"), when present. */
function displayUserName(userName: string): string {
  const parts = userName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function initialsOf(userName: string): string {
  const parts = userName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export interface UserMenuProps {
  userName: string;
  userEmail?: string;
  /**
   * Avatar photo URL. When absent the avatar falls back to the user's
   * initials, so the menu works before a photo field exists.
   */
  userPhoto?: string | null;
  onLogout: () => void;
}

export function UserMenu({ userName, userEmail, userPhoto, onLogout }: UserMenuProps) {
  const displayName = displayUserName(userName);

  return (
    <Menu shadow="md" width={220}>
      <Menu.Target>
        <UnstyledButton
          aria-label={`Conta: ${displayName}`}
          style={{ borderRadius: "var(--mantine-radius-md)" }}
        >
          <Group gap="xs" wrap="nowrap">
            <Avatar src={userPhoto ?? undefined} size={32} radius="xl" color="brand">
              {initialsOf(userName)}
            </Avatar>
            <Box visibleFrom="sm">
              <Text size="sm" fw={500} lineClamp={1}>
                {displayName}
              </Text>
            </Box>
            <ChevronDown size={14} aria-hidden style={{ opacity: 0.6 }} />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={500} lineClamp={1}>
            {userName}
          </Text>
          {userEmail && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {userEmail}
            </Text>
          )}
        </Menu.Label>
        <Menu.Divider />
        <Menu.Item leftSection={<Settings size={16} />}>Settings</Menu.Item>
        <Menu.Item leftSection={<LogOut size={16} />} color="red" onClick={onLogout}>
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
