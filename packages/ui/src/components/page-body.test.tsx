import "@testing-library/jest-dom/vitest";

import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageBody, type PageBodyProps } from "./page-body";

function renderBody(props: Partial<PageBodyProps> = {}) {
  return render(
    <ThemeProvider>
      <PageBody title="Users" {...props}>
        <div data-testid="content">content</div>
      </PageBody>
    </ThemeProvider>,
  );
}

describe("PageBody", () => {
  it("renders the title and content", () => {
    renderBody();

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    renderBody({ description: "Manage users" });

    expect(screen.getByText("Manage users")).toBeInTheDocument();
  });

  it("renders the action on the title row", () => {
    renderBody({ action: <button type="button">New user</button> });

    expect(screen.getByRole("button", { name: "New user" })).toBeInTheDocument();
  });

  it("renders toolbar controls above the content", () => {
    renderBody({ toolbar: <input aria-label="Search" /> });

    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("renders without optional slots", () => {
    renderBody();

    expect(screen.queryByLabelText("Search")).not.toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
