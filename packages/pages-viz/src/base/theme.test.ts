import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme, clearTheme, LIGHT_THEME, DARK_THEME } from "./theme.js";
import type { PagesTheme } from "./theme.js";

describe("theme", () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  describe("LIGHT_THEME", () => {
    it("has all required tokens", () => {
      const keys: (keyof PagesTheme)[] = [
        "font", "fontSize", "text", "textMuted",
        "bg", "bgAlt", "bgHover", "bgDisabled",
        "border", "radius", "accent", "accentHover", "accentSubtle",
      ];
      for (const key of keys) {
        expect(LIGHT_THEME[key]).toBeDefined();
        expect(LIGHT_THEME[key].length).toBeGreaterThan(0);
      }
    });
  });

  describe("DARK_THEME", () => {
    it("has all required tokens", () => {
      const keys: (keyof PagesTheme)[] = [
        "font", "fontSize", "text", "textMuted",
        "bg", "bgAlt", "bgHover", "bgDisabled",
        "border", "radius", "accent", "accentHover", "accentSubtle",
      ];
      for (const key of keys) {
        expect(DARK_THEME[key]).toBeDefined();
        expect(DARK_THEME[key].length).toBeGreaterThan(0);
      }
    });

    it("has different bg and text from light theme", () => {
      expect(DARK_THEME.bg).not.toBe(LIGHT_THEME.bg);
      expect(DARK_THEME.text).not.toBe(LIGHT_THEME.text);
    });
  });

  describe("applyTheme", () => {
    it("sets all CSS custom properties on the element", () => {
      applyTheme(el, LIGHT_THEME);

      expect(el.style.getPropertyValue("--pages-font")).toBe(LIGHT_THEME.font);
      expect(el.style.getPropertyValue("--pages-text")).toBe(LIGHT_THEME.text);
      expect(el.style.getPropertyValue("--pages-bg")).toBe(LIGHT_THEME.bg);
      expect(el.style.getPropertyValue("--pages-border")).toBe(LIGHT_THEME.border);
      expect(el.style.getPropertyValue("--pages-accent")).toBe(LIGHT_THEME.accent);
      expect(el.style.getPropertyValue("--pages-accent-hover")).toBe(LIGHT_THEME.accentHover);
      expect(el.style.getPropertyValue("--pages-accent-subtle")).toBe(LIGHT_THEME.accentSubtle);
    });

    it("sets data-pages-theme attribute for preset themes", () => {
      applyTheme(el, DARK_THEME);
      expect(el.dataset.pagesTheme).toBe("dark");

      applyTheme(el, LIGHT_THEME);
      expect(el.dataset.pagesTheme).toBe("light");
    });

    it("sets data-pages-theme to custom for non-preset themes", () => {
      const custom: PagesTheme = { ...LIGHT_THEME, bg: "#ff0000" };
      applyTheme(el, custom);
      expect(el.dataset.pagesTheme).toBe("custom");
    });

    it("accepts string shorthand for preset themes", () => {
      applyTheme(el, "dark");
      expect(el.style.getPropertyValue("--pages-bg")).toBe(DARK_THEME.bg);
      expect(el.dataset.pagesTheme).toBe("dark");

      applyTheme(el, "light");
      expect(el.style.getPropertyValue("--pages-bg")).toBe(LIGHT_THEME.bg);
      expect(el.dataset.pagesTheme).toBe("light");
    });
  });

  describe("clearTheme", () => {
    it("removes all CSS custom properties", () => {
      applyTheme(el, DARK_THEME);
      clearTheme(el);

      expect(el.style.getPropertyValue("--pages-font")).toBe("");
      expect(el.style.getPropertyValue("--pages-text")).toBe("");
      expect(el.style.getPropertyValue("--pages-bg")).toBe("");
      expect(el.style.getPropertyValue("--pages-border")).toBe("");
      expect(el.style.getPropertyValue("--pages-accent")).toBe("");
    });

    it("removes data-pages-theme attribute", () => {
      applyTheme(el, DARK_THEME);
      clearTheme(el);
      expect(el.dataset.pagesTheme).toBeUndefined();
    });
  });
});
