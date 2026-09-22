"use client";

import { Avatar, Menu, Text, UnstyledButton } from "@mantine/core";
import { LogOut, Settings } from "lucide-react";

export interface UserMenuProps {
  userName: string;
  userEmail?: string;
  onLogout: () => void;
}

export function UserMenu({ userName, userEmail, onLogout }: UserMenuProps) {
  return (
    <Menu shadow="md" width={220}>
      <Menu.Target>
        <UnstyledButton>
          <Avatar size={32} radius="xl" color="brand">
            {userName.charAt(0).toUpperCase()}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={500}>
            {userName}
          </Text>
          {userEmail && (
            <Text size="xs" c="dimmed">
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
