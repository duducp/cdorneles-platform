import { AppwriteException } from "appwrite";
import { describe, expect, it } from "vitest";

import { ApiError } from "../errors";
import { mapAppwriteError } from "./map-error";

describe("mapAppwriteError", () => {
  it("maps an AppwriteException to an ApiError", () => {
    const mapped = mapAppwriteError(
      new AppwriteException("Unauthorized", 401, "user_unauthorized"),
    );

    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped.message).toBe("Unauthorized");
    expect(mapped.code).toBe("user_unauthorized");
    expect(mapped.status).toBe(401);
  });

  it("falls back to a generic code when the type is empty", () => {
    const mapped = mapAppwriteError(new AppwriteException("Boom"));

    expect(mapped.code).toBe("appwrite");
    expect(mapped.status).toBeUndefined();
  });

  it("normalizes non-Appwrite errors", () => {
    const mapped = mapAppwriteError(new Error("network"));

    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped.code).toBe("unknown");
  });
});
