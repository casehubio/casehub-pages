import { describe, it, expect, afterEach } from "vitest";
import type { LegendProps } from "./PagesLegend.js";
import "./PagesLegend.js";

type LegendEl = HTMLElement & { props: LegendProps };

function createLegend(props: LegendProps): LegendEl {
  const el = document.createElement("pages-legend") as LegendEl;
  el.props = props;
  document.body.appendChild(el);
  return el;
}

describe("PagesLegend", () => {
  let el: LegendEl | undefined;

  afterEach(() => {
    if (el) {
      document.body.removeChild(el);
      el = undefined;
    }
  });

  it("renders entries as list items with swatches", () => {
    el = createLegend({
      entries: [
        { label: "Alpha", color: "#ff0000" },
        { label: "Beta", color: "#00ff00" },
      ],
    });

    const items = el.shadowRoot!.querySelectorAll(".legend-entry");
    expect(items.length).toBe(2);

    const firstSwatch = items[0]!.querySelector(".legend-swatch") as HTMLElement;
    expect(firstSwatch.getAttribute("aria-hidden")).toBe("true");

    const firstLabel = items[0]!.querySelector("span:not(.legend-swatch)");
    expect(firstLabel!.textContent).toBe("Alpha");

    const secondLabel = items[1]!.querySelector("span:not(.legend-swatch)");
    expect(secondLabel!.textContent).toBe("Beta");
  });

  it("uses semantic ul/li structure", () => {
    el = createLegend({ entries: [{ label: "A", color: "#000" }] });

    expect(el.shadowRoot!.querySelector("ul")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("li")).toBeTruthy();
  });

  it("defaults to linear layout (no extra class)", () => {
    el = createLegend({ entries: [{ label: "A", color: "#000" }] });

    const ul = el.shadowRoot!.querySelector("ul")!;
    expect(ul.classList.contains("pages-legend")).toBe(true);
    expect(ul.classList.contains("horizontal")).toBe(false);
    expect(ul.classList.contains("grid")).toBe(false);
  });

  it("applies horizontal layout class", () => {
    el = createLegend({
      entries: [{ label: "A", color: "#000" }],
      layout: "horizontal",
    });

    const ul = el.shadowRoot!.querySelector("ul")!;
    expect(ul.classList.contains("horizontal")).toBe(true);
  });

  it("applies grid layout class", () => {
    el = createLegend({
      entries: [{ label: "A", color: "#000" }],
      layout: "grid",
    });

    const ul = el.shadowRoot!.querySelector("ul")!;
    expect(ul.classList.contains("grid")).toBe(true);
  });

  it("applies circle swatch shape", () => {
    el = createLegend({
      entries: [{ label: "A", color: "#000" }],
      swatchShape: "circle",
    });

    const swatch = el.shadowRoot!.querySelector(".legend-swatch")!;
    expect(swatch.classList.contains("circle")).toBe(true);
  });

  it("defaults to square swatch shape (no circle class)", () => {
    el = createLegend({
      entries: [{ label: "A", color: "#000" }],
    });

    const swatch = el.shadowRoot!.querySelector(".legend-swatch")!;
    expect(swatch.classList.contains("circle")).toBe(false);
  });

  it("renders empty entries array without error", () => {
    el = createLegend({ entries: [] });
    const items = el.shadowRoot!.querySelectorAll(".legend-entry");
    expect(items.length).toBe(0);
  });
});
