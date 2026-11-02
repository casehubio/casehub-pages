import { describe, it, expect } from "vitest";
import { mapFieldToComponentType, isLabelRef, labelRefToPath } from "./schema-types.js";

describe("mapFieldToComponentType — composite types", () => {
  it("x-renderer takes highest priority", () => {
    expect(mapFieldToComponentType({ type: "string", "x-renderer": "my-widget" } as any)).toBe("my-widget");
  });

  it("oneOf maps to variant-group", () => {
    expect(mapFieldToComponentType({
      oneOf: [
        { properties: { method: { const: "email" } } },
        { properties: { method: { const: "phone" } } },
      ],
    })).toBe("variant-group");
  });

  it("type array maps to array-group", () => {
    expect(mapFieldToComponentType({ type: "array", items: { type: "string" } })).toBe("array-group");
  });

  it("items without type maps to array-group", () => {
    expect(mapFieldToComponentType({ items: { type: "string" } })).toBe("array-group");
  });

  it("type object maps to object-group", () => {
    expect(mapFieldToComponentType({
      type: "object",
      properties: { name: { type: "string" } },
    })).toBe("object-group");
  });

  it("properties without type maps to object-group", () => {
    expect(mapFieldToComponentType({
      properties: { name: { type: "string" } },
    })).toBe("object-group");
  });

  it("type array ['string', 'null'] normalizes to string", () => {
    expect(mapFieldToComponentType({ type: ["string", "null"] as any })).toBe("input");
  });

  it("type array ['object', 'null'] normalizes to object-group", () => {
    expect(mapFieldToComponentType({
      type: ["object", "null"] as any,
      properties: { a: { type: "string" } },
    })).toBe("object-group");
  });

});

describe("label ref utilities", () => {
  it("isLabelRef detects labels/ prefix", () => {
    expect(isLabelRef("labels/categories")).toBe(true);
    expect(isLabelRef("labels/priorities")).toBe(true);
    expect(isLabelRef("agents")).toBe(false);
    expect(isLabelRef(undefined)).toBe(false);
  });

  it("labelRefToPath extracts tree name", () => {
    expect(labelRefToPath("labels/categories")).toBe("categories");
    expect(labelRefToPath("labels/priorities")).toBe("priorities");
    expect(labelRefToPath("labels/a/b")).toBe("a/b");
  });
});

describe("mapFieldToComponentType — leaf types", () => {
  it("existing leaf mappings unchanged", () => {
    expect(mapFieldToComponentType({ type: "string" })).toBe("input");
    expect(mapFieldToComponentType({ type: "number" })).toBe("number-input");
    expect(mapFieldToComponentType({ type: "integer" })).toBe("number-input");
    expect(mapFieldToComponentType({ type: "boolean" })).toBe("checkbox");
    expect(mapFieldToComponentType({ type: "string", enum: ["a", "b"] })).toBe("select");
    expect(mapFieldToComponentType({ type: "string", format: "date" })).toBe("date-input");
    expect(mapFieldToComponentType({ type: "string", format: "datetime-local" })).toBe("datetime-input");
    expect(mapFieldToComponentType({ type: "string", format: "textarea" })).toBe("textarea");
  });
});
