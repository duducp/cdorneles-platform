import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthCard } from "./auth-card";

describe("AuthCard", () => {
  it("renders the form and the visual panel", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} visual={<span>visual-slot</span>} />
      </ThemeProvider>,
    );

    expect(screen.getByText("form-slot")).toBeInTheDocument();
    expect(screen.getByText("visual-slot")).toBeInTheDocument();
  });

  it("omits the visual panel when not provided", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    expect(screen.getByText("form-slot")).toBeInTheDocument();
    expect(screen.queryByText("visual-slot")).not.toBeInTheDocument();
  });

  it("shows a blocking overlay while loading and makes the content inert", () => {
    render(
      <ThemeProvider>
        <AuthCard
          form={
            <form>
              <button type="button">Entrar</button>
            </form>
          }
          loading
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Entrando…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Entrar" });
    expect(button.closest("[inert]")).not.toBeNull();
  });

  it("has no overlay when not loading", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    expect(screen.queryByText("Entrando…")).not.toBeInTheDocument();
  });

  it("owns the form panel padding so slots pass content only", () => {
    render(
      <ThemeProvider>
        <AuthCard form={<span>form-slot</span>} />
      </ThemeProvider>,
    );

    const panel = screen.getByText("form-slot").parentElement;
    expect(panel?.getAttribute("style")).toContain("padding");
  });
});
