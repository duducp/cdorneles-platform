import "@testing-library/jest-dom/vitest";

import type { FunctionsApi } from "@cdorneles/api-client";
import { permissionKey } from "@cdorneles/permissions";
import { AccessProvider } from "@cdorneles/ui/permissions";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClientsPage } from "./clients-page";
import { FunctionsApiProvider } from "./functions-api-context";

function renderPage(listOrganizations: ReturnType<typeof vi.fn>) {
  const value = { listOrganizations } as unknown as FunctionsApi;
  return render(
    <MantineProvider>
      <FunctionsApiProvider value={value}>
        <AccessProvider granted={{ permissions: [permissionKey("customers.read")], features: [] }}>
          <ClientsPage />
        </AccessProvider>
      </FunctionsApiProvider>
    </MantineProvider>,
  );
}

describe("ClientsPage", () => {
  it("lists clients when the request succeeds", async () => {
    const listOrganizations = vi.fn().mockResolvedValue({
      organizations: [{ id: "org-1", name: "Acme" }],
    });

    renderPage(listOrganizations);

    expect(await screen.findByText("Acme")).toBeInTheDocument();
  });

  it("surfaces a load failure in an ErrorState with a retry action", async () => {
    const listOrganizations = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ organizations: [{ id: "org-1", name: "Acme" }] });

    renderPage(listOrganizations);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar os clientes");
    expect(alert).toHaveTextContent("boom");

    await userEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(listOrganizations).toHaveBeenCalledTimes(2);
  });
});
