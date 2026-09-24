import { describe, expect, it } from "vitest";

import { createMetadata } from "./metadata";

describe("createMetadata", () => {
  it("uses the platform title template and the default favicon", () => {
    const metadata = createMetadata({ title: "Carlos Dorneles Admin", description: "x" });

    expect(metadata.title).toEqual({
      default: "Carlos Dorneles Admin",
      template: "%s | Carlos Dorneles Platform",
    });
    expect(metadata.icons).toEqual({ icon: "/brand/favicon.png" });
  });

  it("accepts a per-app favicon override", () => {
    const metadata = createMetadata({
      title: "Carlos Dorneles Admin",
      description: "x",
      icon: "/brand/favicon-black.png",
    });

    expect(metadata.icons).toEqual({ icon: "/brand/favicon-black.png" });
  });
});
