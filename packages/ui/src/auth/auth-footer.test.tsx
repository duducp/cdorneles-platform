import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthFooter } from "./auth-footer";

function renderFooter() {
  return render(
    <ThemeProvider>
      <AuthFooter />
    </ThemeProvider>,
  );
}

describe("AuthFooter", () => {
  it("renders the brand logo and version in a footer landmark", () => {
    renderFooter();

    // The Logo renders one <img> per color scheme; all must sit in the footer.
    const logos = screen.getAllByAltText("Carlos Dorneles");
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect(screen.getByRole("contentinfo")).toContainElement(logo);
    }
  });

  it("shows the Turnstile protection notice when the site key is configured", () => {
    const original = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";

    try {
      renderFooter();
      expect(screen.getByText("Protegido pelo Cloudflare Turnstile")).toBeInTheDocument();
    } finally {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = original;
    }
  });

  it("omits the Turnstile notice when the site key is not configured", () => {
    const original = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    try {
      renderFooter();
      expect(screen.queryByText("Protegido pelo Cloudflare Turnstile")).not.toBeInTheDocument();
    } finally {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = original;
    }
  });

  it("omits the Turnstile notice when the site key is empty", () => {
    const original = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "";

    try {
      renderFooter();
      expect(screen.queryByText("Protegido pelo Cloudflare Turnstile")).not.toBeInTheDocument();
    } finally {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = original;
    }
  });
});
