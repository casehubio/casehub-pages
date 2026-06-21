import type { CasehubTable } from "./components/CasehubTable.js";
import type { CasehubMetric } from "./components/CasehubMetric.js";
import type { CasehubSelector } from "./components/CasehubSelector.js";
import type { CasehubIframePlugin } from "./components/CasehubIframePlugin.js";
import type { CasehubBarChart } from "./charts/CasehubBarChart.js";
import type { CasehubAreaChart } from "./charts/CasehubAreaChart.js";
import type { CasehubBubbleChart } from "./charts/CasehubBubbleChart.js";
import type { CasehubLineChart } from "./charts/CasehubLineChart.js";
import type { CasehubMap } from "./charts/CasehubMap.js";
import type { CasehubMeter } from "./charts/CasehubMeter.js";
import type { CasehubPieChart } from "./charts/CasehubPieChart.js";
import type { CasehubScatterChart } from "./charts/CasehubScatterChart.js";
import type { CasehubTimeseries } from "./charts/CasehubTimeseries.js";
import type { CasehubCheckbox } from "./form-inputs/CasehubCheckbox.js";
import type { CasehubDatePicker } from "./form-inputs/CasehubDatePicker.js";
import type { CasehubDropdown } from "./form-inputs/CasehubDropdown.js";
import type { CasehubNumberInput } from "./form-inputs/CasehubNumberInput.js";
import type { CasehubTextInput } from "./form-inputs/CasehubTextInput.js";
import type { CasehubTextarea } from "./form-inputs/CasehubTextarea.js";

declare global {
  interface HTMLElementTagNameMap {
    "casehub-table": CasehubTable;
    "casehub-metric": CasehubMetric;
    "casehub-selector": CasehubSelector;
    "casehub-iframe-plugin": CasehubIframePlugin;
    "casehub-bar-chart": CasehubBarChart;
    "casehub-area-chart": CasehubAreaChart;
    "casehub-bubble-chart": CasehubBubbleChart;
    "casehub-line-chart": CasehubLineChart;
    "casehub-map": CasehubMap;
    "casehub-meter": CasehubMeter;
    "casehub-pie-chart": CasehubPieChart;
    "casehub-scatter-chart": CasehubScatterChart;
    "casehub-timeseries": CasehubTimeseries;
    "casehub-checkbox": CasehubCheckbox;
    "casehub-date-picker": CasehubDatePicker;
    "casehub-dropdown": CasehubDropdown;
    "casehub-number-input": CasehubNumberInput;
    "casehub-text-input": CasehubTextInput;
    "casehub-textarea": CasehubTextarea;
  }
}
