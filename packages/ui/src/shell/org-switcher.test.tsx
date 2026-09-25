import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OrgSwitcher } from "./org-switcher";

function renderSwitcher(
  props: Partial<Parameters<typeof OrgSwitcher>[0]> & {
    onCreate?: (name: string) => Promise<void>;
  } = {},
) {
  const onCreate = props.onCreate ?? vi.fn().mockResolvedValue(undefined);
  const { onCreate: _ignored, ...rest } = props;
  return render(
    <ThemeProvider>
      <OrgSwitcher
        organizations={[
          { id: "org-1", name: "Acme" },
          { id: "org-2", name: "Globex" },
        ]}
        currentOrganizationId="org-1"
        onSelect={vi.fn()}
        {...rest}
        onCreateOrganization={onCreate}
      />
    </ThemeProvider>,
  );
}

describe("OrgSwitcher", () => {
  it("shows the current organization on the trigger", () => {
    renderSwitcher();

    expect(screen.getByLabelText("Trocar organização")).toHaveTextContent("Acme");
  });

  it("lists all organizations with the active one checked", async () => {
    renderSwitcher();

    await userEvent.click(screen.getByLabelText("Trocar organização"));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Acme")).toBeInTheDocument();
    expect(within(menu).getByText("Globex")).toBeInTheDocument();
  });

  it("selects an organization from the menu", async () => {
    const onSelect = vi.fn();
    renderSwitcher({ onSelect });

    await userEvent.click(screen.getByLabelText("Trocar organização"));
    await userEvent.click(await screen.findByText("Globex"));

    expect(onSelect).toHaveBeenCalledWith("org-2");
  });

  it("hides the create item when creation is not allowed", async () => {
    renderSwitcher({ canCreate: false });

    await userEvent.click(screen.getByLabelText("Trocar organização"));

    expect(screen.queryByText(/create organization/i)).not.toBeInTheDocument();
  });

  it("shows the create item and opens the form when creation is allowed", async () => {
    renderSwitcher({ canCreate: true });

    await userEvent.click(screen.getByLabelText("Trocar organização"));
    await userEvent.click(await screen.findByText(/create organization/i));

    expect(await screen.findByLabelText(/organization name/i)).toBeInTheDocument();
  });

  it("creates an organization and closes the modal", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderSwitcher({ canCreate: true, onCreate });

    await userEvent.click(screen.getByLabelText("Trocar organização"));
    await userEvent.click(await screen.findByText(/create organization/i));

    const dialog = await screen.findByRole("dialog");
    const input = await within(dialog).findByLabelText(/organization name/i);
    await userEvent.type(input, "Nova Org");
    await userEvent.click(within(dialog).getByRole("button", { name: /create organization/i }));

    expect(onCreate).toHaveBeenCalledWith("Nova Org");
    await waitFor(() => expect(input).not.toBeVisible());
  });

  it("shows a loading state while organizations are being fetched", () => {
    renderSwitcher({ loading: true });

    expect(screen.getByLabelText("Trocar organização")).toBeInTheDocument();
  });
});
