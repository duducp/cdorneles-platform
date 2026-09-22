import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SocialLogin } from "./social-login";

describe("SocialLogin", () => {
  it("renders a custom label when provided", () => {
    render(
      <ThemeProvider>
        <SocialLogin label="Continuar com Google novamente" />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Continuar com Google novamente" }),
    ).toBeInTheDocument();
  });

  it("calls the handler when the Google button is clicked", async () => {
    const onGoogleClick = vi.fn();
    render(
      <ThemeProvider>
        <SocialLogin onGoogleClick={onGoogleClick} />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Entrar com Google" }));
    expect(onGoogleClick).toHaveBeenCalledOnce();
  });

  it("renders a custom label when provided", () => {
    render(
      <ThemeProvider>
        <SocialLogin label="Continuar com Google novamente" />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Continuar com Google novamente" }),
    ).toBeInTheDocument();
  });
});
