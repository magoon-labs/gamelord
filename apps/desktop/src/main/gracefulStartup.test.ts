// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies that index.html contains the inline critical styles and theme
 * script needed to prevent FOUC (flash of unstyled content) on cold launch.
 */
describe("graceful startup — index.html", () => {
  const htmlPath = path.resolve(__dirname, "../../index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  it("has an inline theme script that reads localStorage and sets colorScheme", () => {
    expect(html).toContain("localStorage.getItem('gamelord:theme')");
    expect(html).toContain("document.documentElement.style.colorScheme");
  });

  it("sets a pre-paint background on <html> that follows the .dark class", () => {
    expect(html).toMatch(/html\s*\{[^}]*background:\s*#fff/);
    expect(html).toMatch(/html\.dark\s*\{[^}]*background:\s*#000/);
  });

  it("runs the theme script without touching <body>, which doesn't exist yet in <head>", () => {
    const script = html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const classList = { toggle: vi.fn() };
    const documentStub = {
      documentElement: { classList, style: { colorScheme: "" } },
      body: null,
    };
    const run = new Function("window", "document", "localStorage", script!);

    expect(() =>
      run({ matchMedia: () => ({ matches: true }) }, documentStub, { getItem: () => null }),
    ).not.toThrow();
    expect(classList.toggle).toHaveBeenCalledWith("dark", true);
    expect(documentStub.documentElement.style.colorScheme).toBe("dark");
  });

  it("starts #root with opacity 0 for fade-in", () => {
    expect(html).toMatch(/#root\s*\{[^}]*opacity:\s*0/);
  });

  it("defines a .mounted class that sets opacity to 1", () => {
    expect(html).toMatch(/#root\.mounted\s*\{[^}]*opacity:\s*1/);
  });

  it("has a CSS transition on #root opacity", () => {
    expect(html).toMatch(/#root\s*\{[^}]*transition:\s*opacity/);
  });
});
