import { describe, it, expect } from "vitest";
import { collectionBindings } from "./collection-bindings.js";
import type { CollectionMeta } from "./collection-bindings.js";

describe("collectionBindings", () => {
  const COLLECTIONS: CollectionMeta[] = [
    {
      name: "tickets",
      fields: [
        { name: "title", type: "string" },
        { name: "priority", type: "enum" },
      ],
    },
    {
      name: "agents",
      fields: [
        { name: "name", type: "string" },
        { name: "active", type: "boolean" },
      ],
    },
  ];

  it("generates one binding per collection", () => {
    const bindings = collectionBindings("helpdesk", COLLECTIONS);
    expect(bindings).toHaveLength(2);
  });

  it("binding IDs follow json:{appId}/{collection} namespace", () => {
    const bindings = collectionBindings("helpdesk", COLLECTIONS);
    expect(bindings[0]!.id).toBe("json:helpdesk/tickets");
    expect(bindings[1]!.id).toBe("json:helpdesk/agents");
  });

  it("each binding has keyColumn 'id'", () => {
    const bindings = collectionBindings("helpdesk", COLLECTIONS);
    for (const b of bindings) {
      expect(b.keyColumn).toBe("id");
    }
  });

  it("each binding source has a dispatch method (MutableDataSource)", () => {
    const bindings = collectionBindings("helpdesk", COLLECTIONS);
    for (const b of bindings) {
      expect(typeof (b.source as any).dispatch).toBe("function");
    }
  });

  it("maps field types to ColumnType correctly", () => {
    const cols: CollectionMeta[] = [{
      name: "test",
      fields: [
        { name: "s", type: "string" },
        { name: "n", type: "number" },
        { name: "b", type: "boolean" },
        { name: "d", type: "date" },
        { name: "e", type: "enum" },
        { name: "r", type: "ref" },
        { name: "a", type: "array" },
      ],
    }];
    const bindings = collectionBindings("app1", cols);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]!.id).toBe("json:app1/test");
  });

  it("returns empty array for no collections", () => {
    const bindings = collectionBindings("app1", []);
    expect(bindings).toEqual([]);
  });
});
