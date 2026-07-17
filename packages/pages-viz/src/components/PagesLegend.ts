import { PagesContentElement } from "../base/PagesContentElement.js";

interface LegendEntry {
  readonly label: string;
  readonly color: string;
}

export interface LegendProps {
  readonly entries: readonly LegendEntry[];
  readonly layout?: "linear" | "horizontal" | "vertical" | "grid";
  readonly swatchShape?: "square" | "circle";
}

export class PagesLegend extends PagesContentElement<LegendProps> {
  protected override render(container: HTMLDivElement, props: LegendProps): void {
    container.textContent = "";

    const style = document.createElement("style");
    style.textContent = `
      .pages-legend { display: flex; flex-wrap: wrap; gap: var(--pages-space-3, 12px); list-style: none; margin: 0; padding: 0; font-size: var(--pages-font-size-sm, 12px); color: var(--pages-neutral-11, #404040); }
      .pages-legend.horizontal { flex-wrap: nowrap; overflow-x: auto; }
      .pages-legend.vertical { flex-direction: column; flex-wrap: nowrap; }
      .pages-legend.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
      .legend-entry { display: flex; align-items: center; gap: var(--pages-space-1, 4px); }
      .legend-swatch { width: 12px; height: 12px; border-radius: var(--pages-radius-sm, 4px); flex-shrink: 0; }
      .legend-swatch.circle { border-radius: 50%; }
    `;
    container.appendChild(style);

    const layout = props.layout ?? "linear";
    const shape = props.swatchShape ?? "square";

    const ul = document.createElement("ul");
    const layoutClass = layout === "horizontal" ? " horizontal" : layout === "vertical" ? " vertical" : layout === "grid" ? " grid" : "";
    ul.className = `pages-legend${layoutClass}`;

    for (const entry of props.entries) {
      const li = document.createElement("li");
      li.className = "legend-entry";

      const swatch = document.createElement("span");
      swatch.className = `legend-swatch${shape === "circle" ? " circle" : ""}`;
      swatch.style.background = entry.color;
      swatch.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = entry.label;

      li.appendChild(swatch);
      li.appendChild(label);
      ul.appendChild(li);
    }

    container.appendChild(ul);
  }
}

customElements.define("pages-legend", PagesLegend);
