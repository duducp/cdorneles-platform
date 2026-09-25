import { permissionKey } from "@cdorneles/permissions";
import type { RouteEntry } from "@cdorneles/ui/shell";
import { Building2, LayoutDashboard, Settings, UserCog, Users } from "lucide-react";

/**
 * The platform's route registry — the single source of truth for shell
 * navigation, breadcrumb labels, group index pages, visible page titles and
 * permission gating (UX only; the server remains the security boundary).
 *
 * URL pattern (Django-admin style):
 * - `/group`          → group index listing its pages;
 * - `/group/resource` → list;
 * - `.../add`         → dedicated create page;
 * - `.../<id>/change` → edit page (when the API supports it).
 *
 * Dashboard and Settings stay top-level on purpose: they are not part of a
 * business resource group.
 */
export const ADMIN_ROUTES: RouteEntry[] = [
  {
    kind: "group",
    href: "/admin",
    label: "Administração",
    description: "Gestão da plataforma: usuários e organizações clientes.",
    tags: ["admin", "platform"],
    icon: UserCog,
    items: [
      {
        kind: "page",
        href: "/admin/users",
        label: "Usuários",
        description: "Pessoas com acesso à plataforma e suas permissões por organização.",
        tags: ["admin", "users", "iam"],
        permissions: { allOf: [permissionKey("users.read")] },
        icon: Users,
      },
      {
        kind: "page",
        href: "/admin/clients",
        label: "Clientes",
        description: "Organizações clientes atendidas pela plataforma.",
    tags: ["admin", "organizations", "crm"],
    permissions: { allOf: [permissionKey("customers.read")] },
    icon: Building2,
      },
    ],
  },
  {
    kind: "page",
    href: "/dashboard",
    label: "Dashboard",
    description: "Visão geral da plataforma.",
    tags: ["admin", "overview"],
    icon: LayoutDashboard,
  },
  {
    kind: "page",
    href: "/settings",
    label: "Configurações",
    description: "Preferências da conta e do ambiente.",
    tags: ["admin", "settings"],
    icon: Settings,
  },
];

export const CLIENT_ROUTES: RouteEntry[] = [
  {
    kind: "group",
    href: "/crm",
    label: "CRM",
    description: "Gestão de clientes da sua organização.",
    tags: ["crm"],
    icon: Building2,
    items: [
      {
        kind: "page",
        href: "/crm/customers",
        label: "Clientes",
        description: "Cadastro de clientes da organização.",
        tags: ["crm", "customers"],
        permissions: { allOf: [permissionKey("customers.read")] },
        icon: Building2,
      },
    ],
  },
  {
    kind: "page",
    href: "/dashboard",
    label: "Dashboard",
    description: "Visão geral da sua organização.",
    tags: ["overview"],
    icon: LayoutDashboard,
  },
  {
    kind: "page",
    href: "/settings",
    label: "Configurações",
    description: "Preferências da conta e da organização.",
    tags: ["settings"],
    icon: Settings,
  },
];
