import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APPS = ["admin", "client", "design-system"];
const MEDIA_QUERY = "@media (max-width: 767.98px)";

function globalsCss(app: string): string {
  return readFileSync(join(process.cwd(), "apps", app, "src", "app", "globals.css"), "utf8");
}

describe.each(APPS)("apps/%s/src/app/globals.css", (app) => {
  const css = globalsCss(app);

  it("puts the app-surface overrides inside the mobile media query", () => {
    const mediaIndex = css.indexOf(MEDIA_QUERY);
    expect(mediaIndex).toBeGreaterThan(-1);

    const transparentIndex = css.indexOf("background: transparent !important;");
    expect(transparentIndex).toBeGreaterThan(mediaIndex);

    const watermarkIndex = css.indexOf("body:has([data-auth-card])::before");
    expect(watermarkIndex).toBeGreaterThan(mediaIndex);
    expect(css.indexOf("opacity: 0 !important;", watermarkIndex)).toBeGreaterThan(watermarkIndex);
  });

  it("keeps the full-bleed card chrome overrides", () => {
    expect(css).toContain("border: none !important;");
    expect(css).toContain("border-radius: 0 !important;");
    expect(css).toContain("box-shadow: none !important;");
  });
});
