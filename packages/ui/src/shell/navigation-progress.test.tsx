import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { NavigationProgress, usePendingLink } from "./navigation-progress";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function Reporter({ pending }: { pending: boolean }) {
  usePendingLink(pending);
  return null;
}

describe("NavigationProgress", () => {
  it("renders nothing while no navigation is pending", () => {
    renderWithProviders(
      <NavigationProgress>
        <div>content</div>
      </NavigationProgress>,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("shows the bar while a link is pending and completes when it settles", async () => {
    const { rerender } = renderWithProviders(
      <NavigationProgress>
        <Reporter pending />
      </NavigationProgress>,
    );

    await waitFor(() => expect(screen.getByRole("progressbar")).toBeInTheDocument());

    rerender(
      <ThemeProvider>
        <NavigationProgress>
          <Reporter pending={false} />
        </NavigationProgress>
      </ThemeProvider>,
    );

    // The bar lingers briefly to complete at 100%, then unmounts.
    await waitFor(
      () => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it("keeps the bar up while at least one link is still pending", async () => {
    const { rerender } = renderWithProviders(
      <NavigationProgress>
        <Reporter pending />
        <Reporter pending />
      </NavigationProgress>,
    );

    await waitFor(() => expect(screen.getByRole("progressbar")).toBeInTheDocument());

    // One of two links settled — the other keeps the bar visible.
    rerender(
      <ThemeProvider>
        <NavigationProgress>
          <Reporter pending={false} />
          <Reporter pending />
        </NavigationProgress>
      </ThemeProvider>,
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("announces the loading state to screen readers without visual text", async () => {
    renderWithProviders(
      <NavigationProgress>
        <Reporter pending />
      </NavigationProgress>,
    );

    await act(async () => {});
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });
});
