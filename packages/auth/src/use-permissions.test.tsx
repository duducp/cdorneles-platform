import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FunctionsApi } from "@cdorneles/api-client";

import { usePermissions, type UsePermissionsResult } from "./use-permissions";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("./auth-context", () => ({
  useAuth: useAuthMock,
}));

function createMockFunctionsApi(responseBody: string): FunctionsApi {
  return {
    createExecution: vi.fn().mockResolvedValue({
      $id: "exec-1",
      status: "completed",
      responseBody,
    }),
    createUser: vi.fn(),
    updateUserPermissions: vi.fn(),
    listUsers: vi.fn(),
    listOrganizations: vi.fn(),
    oneTapLogin: vi.fn(),
    publicLogin: vi.fn(),
    publicRequestRecovery: vi.fn(),
    publicCompleteRecovery: vi.fn(),
  };
}

function renderUsePermissions(
  organizationId: string | null | undefined,
  functionsApi: FunctionsApi,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const captured: { current: UsePermissionsResult | null } = { current: null };

  function Capture() {
    captured.current = usePermissions("admin", organizationId, functionsApi);
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  render(<Capture />, { wrapper: Wrapper });

  return { captured, queryClient };
}

describe("usePermissions", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: {
        id: "u1",
        email: "user@example.com",
        name: "User",
        emailVerified: true,
        mfaEnabled: false,
      },
      status: "authenticated",
    });
  });

  it("resolves platform grants when there is no organization", async () => {
    const functionsApi = createMockFunctionsApi(
      JSON.stringify({ permissions: ["organizations.create"], features: [] }),
    );

    const { captured } = renderUsePermissions(null, functionsApi);

    await waitFor(() =>
      expect(captured.current?.granted).toEqual({
        permissions: ["organizations.create"],
        features: [],
      }),
    );

    expect(captured.current?.granted?.permissions).toContain("organizations.create");
    expect(functionsApi.createExecution).toHaveBeenCalledWith({
      functionId: "resolve-grants",
      body: JSON.stringify({ userId: "u1", organizationId: "", applicationId: "admin" }),
      method: "POST",
    });
  });

  it("stays disabled while the tenant is unresolved", async () => {
    const functionsApi = createMockFunctionsApi(
      JSON.stringify({ permissions: ["organizations.create"], features: [] }),
    );

    const { captured } = renderUsePermissions(undefined, functionsApi);

    // Give the query a chance to run if it were (incorrectly) enabled.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(captured.current?.granted).toBeNull();
    expect(captured.current?.status).toBe("loading");
    expect(functionsApi.createExecution).not.toHaveBeenCalled();
  });

  it("does not invalidate the grants cache on mount", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    const functionsApi = createMockFunctionsApi(
      JSON.stringify({ permissions: ["organizations.create"], features: [] }),
    );

    try {
      const { captured } = renderUsePermissions("org-1", functionsApi);

      await waitFor(() => expect(captured.current?.status).toBe("resolved"));

      // The mount-time effect must not fire an extra invalidate/refetch; the
      // query key already carries the organization, so the first load is enough.
      expect(invalidateSpy).not.toHaveBeenCalled();
    } finally {
      invalidateSpy.mockRestore();
    }
  });
});
