import "@testing-library/jest-dom/vitest";

import { featureKey, permissionKey } from "@cdorneles/permissions";
import { ThemeProvider } from "@cdorneles/theme";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { StatusBadge, getStatusConfig } from "./components/status-badge";
import { AccessProvider } from "./permissions/access-provider";
import { FeatureGate } from "./permissions/feature-gate";
import { PermissionGate } from "./permissions/permission-gate";
import { EmptyState } from "./states/empty-state";
import { ErrorState } from "./states/error-state";
import { LoadingState } from "./states/loading-state";

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("StatusBadge", () => {
  it("maps statuses to semantic colors", () => {
    expect(getStatusConfig("active").color).toBe("success");
    expect(getStatusConfig("suspended").color).toBe("danger");
    expect(getStatusConfig("pending").color).toBe("warning");
  });

  it("renders a default label and allows overriding it", () => {
    renderWithTheme(<StatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();

    renderWithTheme(<StatusBadge status="active" label="Em uso" />);
    expect(screen.getByText("Em uso")).toBeInTheDocument();
  });
});

describe("PermissionGate", () => {
  const granted = {
    permissions: [permissionKey("customers.read"), permissionKey("customers.update")],
    features: [featureKey("advanced_reporting")],
  };

  function renderGate(ui: ReactElement) {
    return renderWithTheme(<AccessProvider granted={granted}>{ui}</AccessProvider>);
  }

  it("renders children when the permission is granted", () => {
    renderGate(
      <PermissionGate permission={permissionKey("customers.read")}>
        <span>allowed</span>
      </PermissionGate>,
    );
    expect(screen.getByText("allowed")).toBeInTheDocument();
  });

  it("renders the fallback when the permission is missing", () => {
    renderGate(
      <PermissionGate permission={permissionKey("customers.delete")} fallback={<span>denied</span>}>
        <span>allowed</span>
      </PermissionGate>,
    );
    expect(screen.getByText("denied")).toBeInTheDocument();
    expect(screen.queryByText("allowed")).not.toBeInTheDocument();
  });

  it("supports all/any modes for multiple permissions", () => {
    renderGate(
      <PermissionGate
        mode="any"
        permission={[permissionKey("customers.delete"), permissionKey("customers.update")]}
      >
        <span>any-allowed</span>
      </PermissionGate>,
    );
    expect(screen.getByText("any-allowed")).toBeInTheDocument();

    renderGate(
      <PermissionGate
        mode="all"
        permission={[permissionKey("customers.delete"), permissionKey("customers.update")]}
        fallback={<span>all-denied</span>}
      >
        <span>all-allowed</span>
      </PermissionGate>,
    );
    expect(screen.getByText("all-denied")).toBeInTheDocument();
  });
});

describe("FeatureGate", () => {
  it("depends on feature enablement, not permissions", () => {
    renderWithTheme(
      <AccessProvider granted={{ permissions: [], features: [featureKey("advanced_reporting")] }}>
        <FeatureGate feature={featureKey("advanced_reporting")}>
          <span>feature-on</span>
        </FeatureGate>
        <FeatureGate feature={featureKey("experimental_ai")} fallback={<span>feature-off</span>}>
          <span>hidden</span>
        </FeatureGate>
      </AccessProvider>,
    );
    expect(screen.getByText("feature-on")).toBeInTheDocument();
    expect(screen.getByText("feature-off")).toBeInTheDocument();
  });
});

describe("state components", () => {
  it("expose accessible semantics", () => {
    renderWithTheme(<LoadingState label="Carregando" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Carregando")).toBeInTheDocument();

    renderWithTheme(<ErrorState title="Falhou" onRetry={() => undefined} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();

    renderWithTheme(<EmptyState title="Nada aqui" />);
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
  });
});
