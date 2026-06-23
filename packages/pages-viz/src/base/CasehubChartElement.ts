import { init, use, type ECharts } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { TitleComponent } from "echarts/components";
import { CasehubElement } from "./CasehubElement.js";
import type { VizComponentProps } from "./types.js";
import type { TypedDataSet } from "@casehubio/pages-data/dist/dataset/types.js";
import type { ChartSettings } from "@casehubio/pages-component";

// Register the Canvas renderer and TitleComponent once at module load
use([CanvasRenderer, TitleComponent]);

export interface CasehubFilterDetail {
  readonly columnId: string;
  readonly rowIndex: number;
  readonly reset: boolean;
  readonly group: string | undefined;
}

export abstract class CasehubChartElement<
  P extends VizComponentProps & ChartSettings,
> extends CasehubElement<P> {
  private _chart: ECharts | undefined;
  private _currentTheme = "";

  constructor() {
    super();
    this.container.style.minHeight = "300px";
  }

  override set props(value: P) {
    this.applySizing(value);
    super.props = value;
  }

  override get props(): P {
    return super.props as P;
  }

  private applySizing(props: P): void {
    const raw = props as Readonly<Record<string, unknown>>;
    const h = raw.height;
    if (typeof h === "number") {
      const css = `${String(h)}px`;
      this.container.style.minHeight = css;
      this.container.style.height = css;
    } else if (typeof h === "string") {
      this.container.style.minHeight = h;
      this.container.style.height = h;
    }
    const w = raw.width;
    if (typeof w === "number") {
      this.container.style.width = `${String(w)}px`;
    } else if (typeof w === "string") {
      this.container.style.width = w;
    }
  }

  // ── Abstract — subclasses implement ─────────────────────────────────

  abstract buildOption(
    props: P,
    dataset: TypedDataSet,
  ): Record<string, unknown>;

  // ── Render pipeline ─────────────────────────────────────────────────

  protected override render(
    container: HTMLDivElement,
    props: P,
    dataset: TypedDataSet,
  ): void {
    const chart = this.ensureChart(container);
    const option = this.buildOption(props, dataset);
    chart.setOption(option, true);
  }

  // ── ECharts instance management ─────────────────────────────────────

  private ensureChart(container: HTMLDivElement): ECharts {
    // Re-init if theme changed
    if (this._chart && this._currentTheme !== this.theme) {
      this._chart.dispose();
      this._chart = undefined;
    }

    if (!this._chart) {
      this._currentTheme = this.theme;
      this._chart = init(container, this.theme || "", undefined);
      this.registerClickHandler(this._chart);
    }

    return this._chart;
  }

  // ── Click handler ───────────────────────────────────────────────────

  private registerClickHandler(chart: ECharts): void {
    chart.on("click", (params: { dataIndex: number }) => {
      const filter = this.props.filter;
      if (!filter?.enabled) return;

      const ds = this.dataSet;
      const firstColumn = ds?.columns[0];
      if (!firstColumn) return;

      this.dispatchEvent(
        new CustomEvent<CasehubFilterDetail>("casehub-filter", {
          bubbles: true,
          composed: true,
          detail: {
            columnId: firstColumn.id,
            rowIndex: params.dataIndex,
            reset: false,
            group: filter.group,
          },
        }),
      );
    });
  }

  // ── Resize ──────────────────────────────────────────────────────────

  override onResize(): void {
    this._chart?.resize();
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._chart) {
      this._chart.dispose();
      this._chart = undefined;
    }
  }
}
