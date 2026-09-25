import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UserMenu, type UserMenuProps } from "./user-menu";

function renderMenu(props: Partial<UserMenuProps> = {}) {
  return render(
    <ThemeProvider>
      <UserMenu
        userName="Ana Paula Silva"
        userEmail="ana@example.com"
        onLogout={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("UserMenu", () => {
  it("shows first and last name in the trigger", () => {
    renderMenu({ onLogout: vi.fn() });

    expect(screen.getByLabelText(/conta: ana silva/i)).toBeInTheDocument();
  });

  it("shows the full name in the dropdown label", async () => {
    renderMenu({ onLogout: vi.fn() });

    await userEvent.click(screen.getByLabelText(/conta: ana silva/i));

    expect(await screen.findByText("Ana Paula Silva")).toBeInTheDocument();
  });

  it("shows only the single name when there is no surname", () => {
    renderMenu({ userName: "Ana", onLogout: vi.fn() });

    expect(screen.getByLabelText(/conta: ana/i)).toBeInTheDocument();
  });

  it("renders initials avatar without a photo prop", () => {
    renderMenu({ onLogout: vi.fn() });

    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("uses the photo URL when provided", () => {
    renderMenu({ userPhoto: "https://example.com/photo.png", onLogout: vi.fn() });

    const photo = screen
      .getAllByRole("img", { hidden: true })
      .find((img) => img.getAttribute("src")?.startsWith("https://example.com/"));
    expect(photo).toBeDefined();
    expect(photo).toHaveAttribute("src", "https://example.com/photo.png");
  });

  it("falls back to initials when the photo URL is empty", () => {
    renderMenu({ userPhoto: "", onLogout: vi.fn() });

    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("opens the menu and calls onLogout", async () => {
    const onLogout = vi.fn();
    renderMenu({ onLogout });

    await userEvent.click(screen.getByLabelText(/conta: ana silva/i));
    await userEvent.click(await screen.findByRole("menuitem", { name: /sair/i }));

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
