import { Building2, type LucideIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { createAccessChecker, permissionKey } from "@cdorneles/permissions";

import {
  findRoute,
  flattenRoutes,
  groupIndexItems,
  visibleRoutes,
  type RouteEntry,
  type RouteGroup,
  type RoutePage,
} from "./route-registry";

const icon = Building2 as unknown as LucideIcon;

const page = (overrides: Partial<RoutePage> = {}): RoutePage => ({
  kind: "page",
  href: "/group/page",
  label: "Página",
  icon,
  ...overrides,
});

const group = (overrides: Partial<RouteGroup> = {}): RouteGroup => ({
  kind: "group",
  href: "/group",
  label: "Grupo",
  icon,
  items: [],
  ...overrides,
});

describe("visibleRoutes", () => {
  const tree: RouteEntry[] = [
    group({
      href: "/admin",
      items: [
        page({ href: "/admin/users", permissions: { allOf: [permissionKey("users.read")] } }),
        page({ href: "/admin/open" }),
      ],
    }),
    page({ href: "/dashboard", label: "Dashboard" }),
  ];

  it("keeps entries whose permissions are granted", () => {
    const checker = createAccessChecker({
      permissions: [permissionKey("users.read")],
      features: [],
    });

    const visible = visibleRoutes(tree, checker);

    expect(visible).toHaveLength(2);
    expect(visible[0]!.label).toBe("Grupo");
    expect(visible[1]!.label).toBe("Dashboard");
  });

  it("drops a group when none of its children remain visible", () => {
    const checker = createAccessChecker({ permissions: [], features: [] });

    const guarded: RouteEntry[] = [
      group({
        href: "/admin",
        items: [
          page({ href: "/admin/users", permissions: { allOf: [permissionKey("users.read")] } }),
        ],
      }),
      page({ href: "/dashboard", label: "Dashboard" }),
    ];

    const visible = visibleRoutes(guarded, checker);

    expect(visible).toHaveLength(1);
    expect(visible[0]!.label).toBe("Dashboard");
  });

  it("supports anyOf semantics", () => {
    const checker = createAccessChecker({
      permissions: [permissionKey("customers.read")],
      features: [],
    });

    const visible = visibleRoutes(
      [
        page({
          permissions: { anyOf: [permissionKey("users.read"), permissionKey("customers.read")] },
        }),
      ],
      checker,
    );

    expect(visible).toHaveLength(1);
  });

  it("is deny-by-default", () => {
    const checker = createAccessChecker({ permissions: [], features: [] });

    expect(
      visibleRoutes([page({ permissions: { allOf: [permissionKey("users.read")] } })], checker),
    ).toHaveLength(0);
    expect(visibleRoutes([page()], checker)).toHaveLength(1);
  });
});

describe("flattenRoutes and findRoute", () => {
  const tree: RouteEntry[] = [
    group({
      href: "/admin",
      items: [page({ href: "/admin/users" })],
    }),
    page({ href: "/dashboard" }),
  ];

  it("flattens the tree in declaration order", () => {
    expect(flattenRoutes(tree).map(({ href }) => href)).toEqual([
      "/admin",
      "/admin/users",
      "/dashboard",
    ]);
  });

  it("finds the exact route", () => {
    expect(findRoute(tree, "/admin/users")?.href).toBe("/admin/users");
  });

  it("finds the deepest matching route for id/verb paths", () => {
    expect(findRoute(tree, "/admin/users/abc/change")?.href).toBe("/admin/users");
    expect(findRoute(tree, "/admin")?.href).toBe("/admin");
    expect(findRoute(tree, "/nope")).toBeUndefined();
  });
});

describe("groupIndexItems", () => {
  it("collects only the group's visible pages", () => {
    const tree = group({
      items: [
        page({ href: "/admin/users", label: "Usuários", description: "Pessoas" }),
        group({ href: "/admin/nested", items: [] }),
      ],
    });

    expect(groupIndexItems(tree)).toEqual([
      {
        href: "/admin/users",
        label: "Usuários",
        description: "Pessoas",
        icon: tree.items[0]!.icon,
      },
    ]);
  });
});
