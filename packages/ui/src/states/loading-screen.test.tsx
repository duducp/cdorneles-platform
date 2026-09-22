import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingScreen } from "./loading-screen";

const renderScreen = () =>
  render(
    <ThemeProvider>
      <LoadingScreen />
    </ThemeProvider>,
  );

describe("LoadingScreen", () => {
  it("renders the brand logo in the centred content", () => {
    renderScreen();

    expect(screen.getAllByAltText("Cdorneles")).toHaveLength(2);
  });

  it("pins an accessible spinner to the footer region", () => {
    renderScreen();

    const status = screen.getByRole("status", { name: "Carregando" });
    expect(status).toBeInTheDocument();
    expect(status.closest("footer")).not.toBeNull();
  });

  it("does not render a visible loading caption", () => {
    renderScreen();

    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument();
  });

  it("does not add a nested main landmark", () => {
    renderScreen();

    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });
});
