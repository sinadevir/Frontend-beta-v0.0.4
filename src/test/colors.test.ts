import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every source file except the colour definitions themselves and generated code. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (["theme", "generated", "test"].includes(name)) continue;
      sourceFiles(p, out);
    } else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".gen.ts")) out.push(p);
  }
  return out;
}

const files = sourceFiles(join(process.cwd(), "src"));

describe("colours live only in src/theme", () => {
  it("no page or component writes a colour code directly", () => {
    const offenders = files.filter((f) => /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|\boklch\(|\brgba?\(|\bhsla?\(/.test(readFileSync(f, "utf8").replace(/\[stroke='#(ccc|fff)'\]/g, "")));
    expect(offenders).toEqual([]);
  });

  it("no page or component uses Tailwind's built-in palette instead of the named system colours", () => {
    const raw = /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/;
    const offenders = files.filter((f) => f.endsWith(".tsx") && raw.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the browser toolbar colour equals the logo blue in the palette", async () => {
    const css = readFileSync(join(process.cwd(), "src/theme/colors.css"), "utf8");
    const { BROWSER_THEME_COLOR } = await import("@/theme/brand");
    expect(css).toContain(`--palette-logo-blue: ${BROWSER_THEME_COLOR};`);
    expect(BROWSER_THEME_COLOR).toBe("#004fac");
  });
});
