import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createContainer } from "./container";
import type { Container } from "./container";
import type { ContentFactory } from "./types.js";

function groupFactory(childGroup: Container): ContentFactory {
  return (entry) => {
    const el = document.createElement("div");
    el.dataset.testKey = entry.key;
    childGroup.mount(el);
    return {
      element: el,
      dispose: () => childGroup.dispose(),
    };
  };
}

function simpleFactory(): ContentFactory {
  return (entry) => {
    const el = document.createElement("div");
    el.textContent = `Leaf: ${entry.key}`;
    el.dataset.testKey = entry.key;
    return { element: el };
  };
}

describe("Recursive nesting", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("2-level nesting: tab inside tab", () => {
    const innerGroup = createContainer({
      entries: [
        { key: "inner-a", label: "Inner A" },
        { key: "inner-b", label: "Inner B" },
      ],
      layout: "tabbed",
      contentFactory: simpleFactory(),
      depth: 2,
    });

    const outerGroup = createContainer({
      entries: [{ key: "outer", label: "Outer" }],
      layout: "tabbed",
      contentFactory: groupFactory(innerGroup),
      depth: 1,
    });

    outerGroup.mount(container);

    const innerStrips = container.querySelectorAll("[data-tab-strip]");
    expect(innerStrips.length).toBeGreaterThanOrEqual(2);
  });

  it("3-level nesting works", () => {
    const level3 = createContainer({
      entries: [{ key: "leaf", label: "Leaf" }],
      layout: "accordion",
      contentFactory: simpleFactory(),
      depth: 3,
    });

    const level2 = createContainer({
      entries: [{ key: "mid", label: "Mid" }],
      layout: "tabbed",
      contentFactory: groupFactory(level3),
      depth: 2,
    });

    const level1 = createContainer({
      entries: [{ key: "top", label: "Top" }],
      layout: "tabbed",
      contentFactory: groupFactory(level2),
      depth: 1,
    });

    level1.mount(container);

    const leaf = container.querySelector("[data-test-key='leaf']");
    expect(leaf).not.toBeNull();
    expect(leaf!.textContent).toBe("Leaf: leaf");
  });

  it("rejects nesting beyond maxDepth", () => {
    expect(() => {
      createContainer({
        entries: [{ key: "x", label: "X" }],
        layout: "tabbed",
        contentFactory: simpleFactory(),
        depth: 4,
        policy: {
          allowedLayouts: ["tabbed", "accordion"],
          maxDepth: 3,
        },
      });
    }).toThrow(/maximum nesting depth/);
  });

  it("toggle at nested level preserves content", () => {
    const innerGroup = createContainer({
      entries: [
        { key: "inner-a", label: "A" },
        { key: "inner-b", label: "B" },
      ],
      layout: "tabbed",
      contentFactory: simpleFactory(),
      depth: 2,
    });

    const outerGroup = createContainer({
      entries: [{ key: "host", label: "Host" }],
      layout: "tabbed",
      contentFactory: groupFactory(innerGroup),
      depth: 1,
    });

    outerGroup.mount(container);

    const innerContent = container.querySelector(
      "[data-test-key='inner-a']",
    )!;

    innerGroup.setLayout("accordion");

    const afterToggle = container.querySelector(
      "[data-test-key='inner-a']",
    )!;
    expect(afterToggle).toBe(innerContent);
  });

  it("full toggle matrix: free-layout↔tab↔accordion", () => {
    const group = createContainer({
      entries: [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
      layout: "tabbed",
      contentFactory: simpleFactory(),
    });
    group.mount(container);

    const contentA = container.querySelector("[data-test-key='a']")!;

    // tab → accordion
    group.setLayout("accordion");
    expect(container.querySelector("[data-test-key='a']")).toBe(contentA);

    // accordion → free-layout
    group.setLayout("free");
    expect(container.querySelector("[data-test-key='a']")).toBe(contentA);

    // free-layout → tab
    group.setLayout("tabbed");
    expect(container.querySelector("[data-test-key='a']")).toBe(contentA);

    // tab → free-layout
    group.setLayout("free");
    expect(container.querySelector("[data-test-key='a']")).toBe(contentA);

    // free-layout → accordion
    group.setLayout("accordion");
    expect(container.querySelector("[data-test-key='a']")).toBe(contentA);
  });
});
