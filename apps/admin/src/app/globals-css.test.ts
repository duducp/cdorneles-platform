import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APPS = ["admin", "client", "design-system"];
const MEDIA_QUERY = "@media (max-width: 767.98px)";
const CARD_SELECTOR = "[data-auth-card] {";
const WATERMARK_SELECTOR = "body:has([data-auth-card])::before";

function globalsCss(app: string): string {
  return readFileSync(
    join(import.meta.dirname, "..", "..", "..", app, "src", "app", "globals.css"),
    "utf8",
  );
}

function blockAt(css: string, selector: string, from = 0): { index: number; content: string } {
  const index = css.indexOf(selector, from);
  if (index === -1) {
    return { index, content: "" };
  }

  const openIndex = css.indexOf("{", index + selector.length - 1);
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

function mediaBlock(css: string): { index: number; content: string } {
  return blockAt(css, MEDIA_QUERY);
}

describe.each(APPS)("apps/%s/src/app/globals.css", (app) => {
  const css = globalsCss(app);
  const media = mediaBlock(css);

  it("puts the app-surface overrides inside the mobile media query", () => {
    expect(media.index).toBeGreaterThan(-1);

    const card = blockAt(media.content, CARD_SELECTOR);
    expect(card.index).toBeGreaterThan(-1);
    expect(card.content).toContain("background: transparent !important;");

    const watermark = blockAt(media.content, WATERMARK_SELECTOR);
    expect(watermark.index).toBeGreaterThan(-1);
    expect(watermark.content).toContain("opacity: 0 !important;");
  });

  it("keeps the full-bleed card chrome overrides", () => {
    const card = blockAt(media.content, CARD_SELECTOR);
    expect(card.content).toContain("border: none !important;");
    expect(card.content).toContain("border-radius: 0 !important;");
    expect(card.content).toContain("box-shadow: none !important;");
  });
});

describe("the three globals.css copies", () => {
  it("are byte-identical to each other", () => {
    const [first, ...rest] = APPS.map(globalsCss);
    for (const css of rest) {
      expect(css).toBe(first);
    }
  });
});
