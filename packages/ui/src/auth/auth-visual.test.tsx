import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthVisual } from "./auth-visual";

describe("AuthVisual", () => {
  it("is decorative and hidden from assistive tech", () => {
    const { container } = render(
      <ThemeProvider>
        <AuthVisual />
      </ThemeProvider>,
    );

    const visual = container.querySelector<HTMLElement>('[aria-hidden="true"]');

    expect(visual).toHaveAttribute("aria-hidden", "true");
  });
});
