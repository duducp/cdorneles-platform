import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, clearMock, queryClientMock } = vi.hoisted(() => {
  const clearMock = vi.fn();
  return {
    useAuthMock: vi.fn(),
    clearMock,
    queryClientMock: { clear: clearMock },
  };
});

vi.mock("@cdorneles/auth", () => ({ useAuth: useAuthMock }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => queryClientMock }));

const { UserCacheGuard } = await import("./user-cache-guard");

describe("UserCacheGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the cache when the authenticated user changes", () => {
    useAuthMock.mockReturnValue({ user: { id: "a" } });
    const { rerender } = render(<UserCacheGuard />);

    expect(clearMock).not.toHaveBeenCalled();

    useAuthMock.mockReturnValue({ user: { id: "b" } });
    rerender(<UserCacheGuard />);

    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the cache when the same user re-authenticates", () => {
    useAuthMock.mockReturnValue({ user: { id: "a" } });
    const { rerender } = render(<UserCacheGuard />);

    rerender(<UserCacheGuard />);

    expect(clearMock).not.toHaveBeenCalled();
  });

  it("clears across an anonymous gap (A -> null -> B)", () => {
    useAuthMock.mockReturnValue({ user: { id: "a" } });
    const { rerender } = render(<UserCacheGuard />);

    useAuthMock.mockReturnValue({ user: null });
    rerender(<UserCacheGuard />);
    expect(clearMock).toHaveBeenCalledTimes(1);

    useAuthMock.mockReturnValue({ user: { id: "b" } });
    rerender(<UserCacheGuard />);
    expect(clearMock).toHaveBeenCalledTimes(1);
  });
});
