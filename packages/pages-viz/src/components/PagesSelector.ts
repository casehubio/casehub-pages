import type { TypedDataSet, ColumnId } from "@casehubio/pages-data";
import type { SelectorProps } from "@casehubio/pages-component";
import { PagesElement } from "../base/PagesElement.js";
import { cellToRaw } from "../base/cell-extract.js";
import type { PagesFilterDetail, PagesFilterApply, PagesFilterReset } from "../base/filter-types.js";

const SELECTOR_CSS = `
:host {
  display: block;
  font-family: var(--pages-font-family, system-ui, sans-serif);
}
select {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--pages-neutral-6, #e0e0e0);
  border-radius: var(--pages-radius-sm, 4px);
  font-size: var(--pages-font-size-base, 14px);
  background: var(--pages-neutral-1, #fff);
  color: var(--pages-neutral-12, #333);
}
input[type="range"] {
  width: 100%;
}
.labels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.label-chip {
  padding: 4px 12px;
  border: 1px solid var(--pages-neutral-6, #e0e0e0);
  border-radius: 16px;
  cursor: pointer;
  font-size: 0.9em;
  background: var(--pages-neutral-1, #fff);
  color: var(--pages-neutral-12, #333);
}
.label-chip.selected {
  background: var(--pages-accent-9, #5470c6);
  color: #fff;
  border-color: var(--pages-accent-9, #5470c6);
}
`;

export class PagesSelector extends PagesElement<SelectorProps> {
  private _selectedValue: string | undefined;
  private _initialValues: Array<{ value: string | number | Date | null; rowIndex: number }> | undefined;
  private _initialColumnId: ColumnId | undefined;

  override set dataSet(value: TypedDataSet | undefined) {
    super.dataSet = value;
  }

  override get dataSet(): TypedDataSet | undefined {
    return super.dataSet;
  }

  protected override render(
    container: HTMLDivElement,
    props: SelectorProps,
    dataset: TypedDataSet,
  ): void {
    container.textContent = "";

    // Style
    const style = document.createElement("style");
    style.textContent = SELECTOR_CSS;
    container.appendChild(style);

    if (dataset.columns.length === 0) return;

    const firstColumn = dataset.columns[0];
    if (!firstColumn) return;

    this._initialValues = this.extractDistinctValues(dataset, firstColumn.id);
    this._initialColumnId = firstColumn.id;

    if (this._selectedValue !== undefined) {
      const stillPresent = this._initialValues.some(
        v => v.value !== null && String(v.value) === this._selectedValue,
      );
      if (!stillPresent) this._selectedValue = undefined;
    }

    const distinctValues = this._initialValues;
    const columnId = this._initialColumnId ?? firstColumn.id;

    const subtype = props.subtype ?? "dropdown";

    if (subtype === "dropdown") {
      this.renderDropdown(container, props, columnId, distinctValues);
    } else if (subtype === "slider") {
      this.renderSlider(container, props, columnId, distinctValues);
    } else {
      this.renderLabels(container, props, columnId, distinctValues);
    }
  }

  private extractDistinctValues(
    dataset: TypedDataSet,
    columnId: ColumnId,
  ): Array<{ value: string | number | Date | null; rowIndex: number }> {
    const seen = new Set<string | number | null>();
    const result: Array<{ value: string | number | Date | null; rowIndex: number }> = [];

    const colIdx = dataset.columns.findIndex((c) => c.id === columnId);
    if (colIdx < 0) return result;

    for (let rowIdx = 0; rowIdx < dataset.rows.length; rowIdx++) {
      const row = dataset.rows[rowIdx];
      const cell = row?.cells[colIdx];
      if (!row || !cell) continue;
      const raw = cellToRaw(cell);

      const key = raw instanceof Date ? raw.getTime() : raw;

      if (!seen.has(key)) {
        seen.add(key);
        result.push({ value: raw, rowIndex: rowIdx });
      }
    }

    return result;
  }

  private renderDropdown(
    container: HTMLDivElement,
    props: SelectorProps,
    columnId: ColumnId,
    values: Array<{ value: string | number | Date | null; rowIndex: number }>,
  ): void {
    const select = document.createElement("select");

    // "All" option
    const allOption = document.createElement("option");
    allOption.textContent = "All";
    allOption.value = "-1";
    select.appendChild(allOption);

    // Distinct values
    for (const { value, rowIndex } of values) {
      const option = document.createElement("option");
      option.textContent = value === null ? "" : String(value);
      option.value = String(rowIndex);
      select.appendChild(option);
    }

    if (this._selectedValue !== undefined) {
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i]!.textContent === this._selectedValue) {
          select.selectedIndex = i;
          break;
        }
      }
    }

    select.addEventListener("change", () => {
      const selectedOption = select.options[select.selectedIndex];
      if (!selectedOption) return;

      if (selectedOption.value === "-1") {
        this._selectedValue = undefined;
        this.dispatchEvent(
          new CustomEvent<PagesFilterDetail>("pages-filter", {
            bubbles: true,
            composed: true,
            detail: {
              columnId,
              reset: true,
              group: props.filter?.group,
            } satisfies PagesFilterReset,
          }),
        );
      } else {
        const displayValue = selectedOption.textContent ?? "";
        this._selectedValue = displayValue;

        const dataset = this.dataSet;
        if (!dataset) return;

        const row = dataset.rows.find(r => {
          const cell = r.cell(columnId);
          return cell.type !== "NULL" && String(cellToRaw(cell)) === displayValue;
        });
        if (!row) return;

        this.dispatchEvent(
          new CustomEvent<PagesFilterDetail>("pages-filter", {
            bubbles: true,
            composed: true,
            detail: {
              columnId,
              value: displayValue,
              row,
              reset: false,
              group: props.filter?.group,
            } satisfies PagesFilterApply,
          }),
        );
      }
    });

    container.appendChild(select);
  }

  private renderSlider(
    container: HTMLDivElement,
    props: SelectorProps,
    columnId: ColumnId,
    values: Array<{ value: string | number | Date | null; rowIndex: number }>,
  ): void {
    const numericValues = values
      .filter((v) => typeof v.value === "number")
      .map((v) => v.value as number);

    if (numericValues.length === 0) return;

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(min);

    slider.addEventListener("change", () => {
      const targetValue = parseFloat(slider.value);

      // Find the row index with the closest numeric value
      let closestIndex = 0;
      let closestDiff = Infinity;

      for (const { value, rowIndex } of values) {
        if (typeof value === "number") {
          const diff = Math.abs(value - targetValue);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestIndex = rowIndex;
          }
        }
      }

      // Get the row object and cell value from the dataset
      const dataset = this.dataSet;
      if (!dataset) return;

      const rowObj = dataset.rows[closestIndex];
      if (!rowObj) return;

      const cell = rowObj.cell(columnId);
      if (cell.type === "NULL") return;

      const value = String(cellToRaw(cell));

      this.dispatchEvent(
        new CustomEvent<PagesFilterDetail>("pages-filter", {
          bubbles: true,
          composed: true,
          detail: {
            columnId,
            value,
            row: rowObj,
            reset: false,
            group: props.filter?.group,
          } satisfies PagesFilterApply,
        }),
      );
    });

    container.appendChild(slider);
  }

  private renderLabels(
    container: HTMLDivElement,
    props: SelectorProps,
    columnId: ColumnId,
    values: Array<{ value: string | number | Date | null; rowIndex: number }>,
  ): void {
    const labelsDiv = document.createElement("div");
    labelsDiv.className = "labels";

    for (let i = 0; i < values.length; i++) {
      const entry = values[i];
      if (!entry) continue;
      const { value, rowIndex } = entry;
      const chip = document.createElement("button");
      chip.className = "label-chip";
      const chipText = value === null ? "" : String(value);
      chip.textContent = chipText;
      chip.type = "button";

      // Apply selected class if this chip's value matches _selectedValue
      if (this._selectedValue !== undefined && chipText === this._selectedValue) {
        chip.classList.add("selected");
      }

      chip.addEventListener("click", () => {
        const wasSelected = chip.classList.contains("selected");

        if (wasSelected) {
          // Deselect
          chip.classList.remove("selected");
          this._selectedValue = undefined;

          this.dispatchEvent(
            new CustomEvent<PagesFilterDetail>("pages-filter", {
              bubbles: true,
              composed: true,
              detail: {
                columnId,
                reset: true,
                group: props.filter?.group,
              } satisfies PagesFilterReset,
            }),
          );
        } else {
          // Select (and clear previous selection)
          const allChips = labelsDiv.querySelectorAll(".label-chip");
          allChips.forEach((c) => { c.classList.remove("selected"); });

          chip.classList.add("selected");
          this._selectedValue = chipText;

          // Get the row object from the dataset
          const dataset = this.dataSet;
          if (!dataset) return;

          const rowObj = dataset.rows[rowIndex];
          if (!rowObj) return;

          const cell = rowObj.cell(columnId);
          if (cell.type === "NULL") return;

          const cellValue = String(cellToRaw(cell));

          this.dispatchEvent(
            new CustomEvent<PagesFilterDetail>("pages-filter", {
              bubbles: true,
              composed: true,
              detail: {
                columnId,
                value: cellValue,
                row: rowObj,
                reset: false,
                group: props.filter?.group,
              } satisfies PagesFilterApply,
            }),
          );
        }
      });

      labelsDiv.appendChild(chip);
    }

    container.appendChild(labelsDiv);
  }
}

customElements.define("pages-selector", PagesSelector);
