import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APPS = ["admin", "client", "design-system"];
const MEDIA_QUERY = "@media (max-width: 767.98px)";

function globalsCss(app: string): string {
  return readFileSync(
    join(import.meta.dirname, "..", "..", "..", app, "src", "app", "globals.css"),
    "utf8",
  );
}

function mediaBlock(css: string): { index: number; content: string } {
  const index = css.indexOf(MEDIA_QUERY);
  if (index === -1) {
    return { index, content: "" };
  }

  const openIndex = css.indexOf("{", index);
  if (openIndex === -1) {
    return { index, content: "" };
  }

  let depth = 1;
  let cursor = openIndex + 1;
  while (cursor < css.length) {
    const char = css[cursor];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
    cursor += 1;
  }

  return { index, content: css.slice(openIndex + 1, cursor) };
}

describe.each(APPS)("apps/%s/src/app/globals.css", (app) => {
  const css = globalsCss(app);
  const media = mediaBlock(css);

  it("puts the app-surface overrides inside the mobile media query", () => {
    expect(media.index).toBeGreaterThan(-1);

    const transparentIndex = media.content.indexOf("background: transparent !important;");
    expect(transparentIndex).toBeGreaterThan(-1);

    const watermarkIndex = media.content.indexOf("body:has([data-auth-card])::before");
    expect(watermarkIndex).toBeGreaterThan(-1);
    expect(media.content.indexOf("opacity: 0 !important;", watermarkIndex)).toBeGreaterThan(
      watermarkIndex,
    );
  });

  it("keeps the full-bleed card chrome overrides", () => {
    expect(media.content).toContain("border: none !important;");
    expect(media.content).toContain("border-radius: 0 !important;");
    expect(media.content).toContain("box-shadow: none !important;");
  });
});
