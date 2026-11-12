import { describe, it, expect } from "vitest";
import { migrateRowsToItems, needsMigration } from "./grid-migration.js";

describe("needsMigration", () => {
  it("returns true for rows-format YAML", () => {
    const yaml = `pages:\n  - name: Main\n    rows:\n      - columns:\n          - span: 6\n            components:\n              - type: html`;
    expect(needsMigration(yaml)).toBe(true);
  });

  it("returns true for components-shorthand YAML", () => {
    const yaml = `pages:\n  - name: Main\n    components:\n      - type: html`;
    expect(needsMigration(yaml)).toBe(true);
  });

  it("returns false for items-format YAML", () => {
    const yaml = `pages:\n  - name: Main\n    items:\n      - placement: { x: 0, y: 0, w: 6, h: 1 }\n        component: { type: html }`;
    expect(needsMigration(yaml)).toBe(false);
  });

  it("returns false for empty YAML", () => {
    expect(needsMigration("")).toBe(false);
  });
});

describe("migrateRowsToItems", () => {
  it("converts single row with two columns to items", () => {
    const input = `pages:
  - name: Main
    rows:
      - columns:
          - span: 6
            components:
              - type: html
                properties:
                  content: left
          - span: 6
            components:
              - type: html
                properties:
                  content: right`;

    const result = migrateRowsToItems(input);
    expect(result).toContain("items:");
    expect(result).not.toContain("rows:");
    expect(result).toContain("x: 0");
    expect(result).toContain("x: 6");
    expect(result).toContain("w: 6");
  });

  it("converts multiple rows preserving y offsets", () => {
    const input = `pages:
  - name: Main
    rows:
      - columns:
          - span: 12
            components:
              - type: html
      - columns:
          - span: 6
            components:
              - type: chart
          - span: 6
            components:
              - type: table`;

    const result = migrateRowsToItems(input);
    expect(result).toContain("items:");
    expect(result).not.toContain("rows:");
  });

  it("converts components shorthand to items", () => {
    const input = `pages:
  - name: Main
    components:
      - type: html
      - type: BARCHART`;

    const result = migrateRowsToItems(input);
    expect(result).toContain("items:");
    expect(result).not.toContain("components:");
  });

  it("leaves items-format YAML unchanged", () => {
    const input = `pages:
  - name: Main
    items:
      - placement: { x: 0, y: 0, w: 12, h: 1 }
        component: { type: html }`;

    expect(migrateRowsToItems(input)).toBe(input);
  });

  it("preserves component properties through migration", () => {
    const input = `pages:
  - name: Main
    rows:
      - columns:
          - span: 6
            components:
              - type: chart
                properties:
                  title: Revenue`;

    const result = migrateRowsToItems(input);
    expect(result).toContain("title: Revenue");
    expect(result).toContain("type: chart");
  });

  it("handles multiple components per column without overlap", () => {
    const input = `pages:\n  - name: Main\n    rows:\n      - columns:\n          - span: 6\n            components:\n              - type: chart\n              - type: table\n          - span: 6\n            components:\n              - type: metric\n      - columns:\n          - span: 12\n            components:\n              - type: summary`;
    const result = migrateRowsToItems(input);
    expect(result).toContain("y: 2");
    expect(result).toContain("y: 0");
    expect(result).toContain("y: 1");
  });
});
