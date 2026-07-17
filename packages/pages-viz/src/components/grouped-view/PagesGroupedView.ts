import type { TypedDataSet, ColumnId, SortColumn } from "@casehubio/pages-data";
import type {
  GroupedViewProps,
  TableColumnConfig,
  ColumnRenderer,
  RowStyleRule,
  SelectionMode,
} from "@casehubio/pages-component";
import { PagesElement } from "../../base/PagesElement.js";
import { resolvePreset } from "./presets.js";
import { extractGroupBoundaries, extractGroupTree } from "./group-extraction.js";
import type { GroupBoundary } from "./group-extraction.js";
import type { GroupNode, AggregationBinding } from "@casehubio/pages-component";
import { computeColumnWidths } from "./column-widths.js";
import { renderGroupTableRowHeader } from "./render-group-table-row.js";
import { renderGroupSectionHeader } from "./render-group-section.js";
import { renderContentList } from "./render-content-list.js";
import { GROUPED_VIEW_CSS } from "./group-view-styles.js";

interface PagesTableHost extends HTMLElement {
  dataSet?: TypedDataSet | undefined;
  columnConfig?: readonly TableColumnConfig[] | undefined;
  columnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer> | undefined;
  rowStyle?: readonly RowStyleRule[] | undefined;
  selection?: SelectionMode | undefined;
  getRowKey?: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined;
  getRowDetail?: ((row: import("@casehubio/pages-data").TypedRow) => unknown) | undefined;
  getRowClass?: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined;
  mode?: string | undefined;
  loading?: boolean | undefined;
  error?: string | undefined;
  sortable?: boolean | undefined;
  clientSort?: boolean | undefined;
  embedded?: boolean | undefined;
  headerVisible?: boolean | undefined;
  activeSort?: SortColumn | undefined;
  getRowAccent?: ((row: import("@casehubio/pages-data").TypedRow) => string | undefined) | undefined;
}

export class PagesGroupedView extends PagesElement<GroupedViewProps> {
  private _expandState = new Map<string, boolean>();
  private _instanceId = "";
  private _styleEl: HTMLStyleElement;
  private _groupTables = new Map<string, PagesTableHost>();
  private _lastBoundaries: readonly GroupBoundary[] = [];
  private _hiddenColumnIds = new Set<string>();
  private _pickerOpen = false;
  private _selectedKeys = new Set<string>();
  private _selectionListeners = new Map<PagesTableHost, (e: Event) => void>();

  private _columnRenderers: ReadonlyMap<ColumnId, ColumnRenderer> | undefined = undefined;
  private _getRowKey: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined = undefined;
  private _getRowDetail: ((row: import("@casehubio/pages-data").TypedRow) => unknown) | undefined = undefined;
  private _getRowClass: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined = undefined;
  private _getRowAccent: ((row: import("@casehubio/pages-data").TypedRow) => string | undefined) | undefined = undefined;

  setColumnRenderers(value: ReadonlyMap<ColumnId, ColumnRenderer> | undefined): void {
    this._columnRenderers = value;
    this._forwardToTables("columnRenderers", value);
  }

  setGetRowKey(value: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined): void {
    this._getRowKey = value;
    this._forwardToTables("getRowKey", value);
  }

  setGetRowDetail(value: ((row: import("@casehubio/pages-data").TypedRow) => unknown) | undefined): void {
    this._getRowDetail = value;
    this._forwardToTables("getRowDetail", value);
  }

  setGetRowClass(value: ((row: import("@casehubio/pages-data").TypedRow) => string) | undefined): void {
    this._getRowClass = value;
    this._forwardToTables("getRowClass", value);
  }

  private _forwardToTables(prop: string, value: unknown): void {
    for (const table of this._groupTables.values()) {
      (table as unknown as Record<string, unknown>)[prop] = value;
    }
  }

  private _toggleColumnVisibility(columnId: string, contentColumnIds: readonly ColumnId[]): void {
    const visibleCount = contentColumnIds.filter((id) => !this._hiddenColumnIds.has(String(id))).length;
    const isHidden = this._hiddenColumnIds.has(columnId);

    if (!isHidden && visibleCount <= 1) return;

    const newHidden = new Set(this._hiddenColumnIds);
    if (isHidden) {
      newHidden.delete(columnId);
    } else {
      newHidden.add(columnId);
    }
    this._hiddenColumnIds = newHidden;

    const hiddenArray = Array.from(newHidden);
    for (const table of this._groupTables.values()) {
      (table as unknown as Record<string, unknown>).hiddenColumns = hiddenArray;
    }

    const visibleColumns = contentColumnIds
      .filter((id) => !newHidden.has(String(id)))
      .map(String);

    this.dispatchEvent(new CustomEvent("column-change", {
      detail: { visibleColumns },
      bubbles: true,
      composed: true,
    }));

    this._updateHeaderBarVisibility(contentColumnIds);
  }

  private _updateHeaderBarVisibility(contentColumnIds: readonly ColumnId[]): void {
    const bar = this.shadowRoot.querySelector(".column-header-bar");
    if (!bar) return;
    const headers = bar.querySelectorAll("[data-column]");
    for (const header of headers) {
      const colId = header.getAttribute("data-column")!;
      (header as HTMLElement).hidden = this._hiddenColumnIds.has(colId);
    }

    const prefix: string[] = [];
    if (this._getRowDetail) prefix.push("40px");
    if (bar.querySelector(".select-all-wrapper")) prefix.push("40px");

    const visibleCount = contentColumnIds.filter((id) => !this._hiddenColumnIds.has(String(id))).length;
    const widths = Array.from({ length: visibleCount }, () => "1fr");

    const pickerWidth = bar.querySelector(".column-picker-wrapper") ? ["auto"] : [];
    bar.setAttribute("style", `grid-template-columns: ${[...prefix, ...widths, ...pickerWidth].join(" ")}`);
  }

  private _handleChildSelectionChange(e: CustomEvent): void {
    e.stopPropagation();
    const childKeys: readonly string[] = e.detail.selectedKeys ?? [];
    const table = e.target as PagesTableHost;
    const tableRows = table.dataSet?.rows ?? [];
    const getRowKey = this._getRowKey;
    if (!getRowKey) return;

    const tableKeys = new Set(tableRows.map((row) => getRowKey(row)));
    const newSelected = new Set(this._selectedKeys);
    for (const key of tableKeys) {
      newSelected.delete(key);
    }
    for (const key of childKeys) {
      newSelected.add(key);
    }

    this._selectedKeys = newSelected;
    const selectedArray = Array.from(newSelected);

    for (const t of this._groupTables.values()) {
      (t as unknown as Record<string, unknown>).selectedKeys = selectedArray;
    }

    this.dispatchEvent(new CustomEvent("selection-change", {
      detail: { selectedKeys: selectedArray, selectedRows: [] },
      bubbles: true,
      composed: true,
    }));

    this._updateSelectAllCheckbox();
  }

  private _handleSelectAll(dataset: import("@casehubio/pages-data").TypedDataSet): void {
    const getRowKey = this._getRowKey;
    if (!getRowKey) return;

    const allKeys = dataset.rows.map((row) => getRowKey(row));
    const allSelected = allKeys.length > 0 && allKeys.every((k) => this._selectedKeys.has(k));

    if (allSelected) {
      this._selectedKeys = new Set();
    } else {
      this._selectedKeys = new Set(allKeys);
    }

    const selectedArray = Array.from(this._selectedKeys);
    for (const t of this._groupTables.values()) {
      (t as unknown as Record<string, unknown>).selectedKeys = selectedArray;
    }

    this.dispatchEvent(new CustomEvent("selection-change", {
      detail: { selectedKeys: selectedArray, selectedRows: [] },
      bubbles: true,
      composed: true,
    }));

    this._updateSelectAllCheckbox();
  }

  private _updateSelectAllCheckbox(): void {
    const cb = this.shadowRoot.querySelector(".select-all-checkbox") as HTMLInputElement | null;
    if (!cb) return;
    const totalRows = Array.from(this._groupTables.values())
      .reduce((sum, t) => sum + (t.dataSet?.rows.length ?? 0), 0);
    cb.checked = this._selectedKeys.size > 0 && this._selectedKeys.size >= totalRows;
    cb.indeterminate = this._selectedKeys.size > 0 && this._selectedKeys.size < totalRows;
  }

  override set activeSort(value: SortColumn | undefined) {
    super.activeSort = value;
    for (const table of this._groupTables.values()) {
      table.activeSort = value;
    }
    this._updateHeaderBarSort(value);
  }

  override get activeSort(): SortColumn | undefined {
    return super.activeSort;
  }

  constructor() {
    super();
    this._styleEl = document.createElement("style");
    this._styleEl.textContent = GROUPED_VIEW_CSS;
    this.shadowRoot.insertBefore(this._styleEl, this.container);
  }

  override connectedCallback(): void {
    this._instanceId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
    super.connectedCallback();
  }

  protected override render(
    container: HTMLDivElement,
    props: GroupedViewProps,
    dataset: TypedDataSet,
  ): void {
    if (props.rowAccent && !this._getRowAccent) {
      const ra = props.rowAccent as { column: string; colorMap: Record<string, string>; default?: string };
      const accentColId = ra.column as ColumnId;
      const colorLookup = new Map<string, string>(Object.entries(ra.colorMap));
      const defaultColor: string | undefined = ra.default;
      this._getRowAccent = (row: import("@casehubio/pages-data").TypedRow): string | undefined => {
        const cell = row.cell(accentColId);
        if (cell.type === "NULL") return defaultColor;
        return colorLookup.get(String(cell.value)) ?? defaultColor;
      };
    }

    const mode = resolvePreset(props);
    const groupByKeys: readonly import("@casehubio/pages-data").GroupingKey[] = Array.isArray(props.groupBy) ? props.groupBy as readonly import("@casehubio/pages-data").GroupingKey[] : [props.groupBy as import("@casehubio/pages-data").GroupingKey];
    const isMultiLevel = groupByKeys.length > 1;
    const primaryKey = groupByKeys[0]!;
    const keyColumnId = primaryKey.columnId;
    const aggColumnIds = (props.aggregations ?? []).map((a) => a.column);
    const aggBindings = (props.aggregations ?? []) as readonly AggregationBinding[];

    const allGroupColumnIds = groupByKeys.map((k) => k.columnId);
    const contentColumnIds = dataset.columns
      .filter((c) => !allGroupColumnIds.includes(c.id))
      .map((c) => c.id);

    const isListMode = mode.contentDisplay === "list";
    const isSpreadsheet = mode.groupDisplay === "table-row";
    const showSummary = props.showGroupSummary ?? false;

    if (isMultiLevel && !isListMode) {
      const tree = extractGroupTree(
        dataset,
        groupByKeys,
        aggBindings.map((a) => ({ column: a.column, fn: a.fn as { fn: string } })),
      );

      this._cleanupSelectionListeners();
      this._groupTables.clear();
      container.textContent = "";

      const wrapper = document.createElement("div");
      wrapper.className = "pages-grouped-view sectioned";

      const columnConfig = this._buildColumnConfig(dataset, contentColumnIds, props);
      const headerBar = this._buildHeaderBar(dataset, contentColumnIds, props, columnConfig);
      wrapper.appendChild(headerBar);

      for (const node of tree) {
        this._renderNode(node, wrapper, columnConfig, props, dataset, contentColumnIds, "", showSummary);
      }

      container.appendChild(wrapper);
      return;
    }

    const boundaries = extractGroupBoundaries(dataset, keyColumnId, aggColumnIds);

    const defaultExpanded = props.defaultExpanded ?? true;
    for (const b of boundaries) {
      if (!this._expandState.has(b.name)) {
        this._expandState.set(b.name, b.rowCount === 0 ? false : defaultExpanded);
      }
    }

    if (this._canReconcile(boundaries)) {
      this._updateExistingTables(dataset, boundaries, contentColumnIds, props);
      this._lastBoundaries = boundaries;
      return;
    }

    this._cleanupSelectionListeners();
    this._groupTables.clear();
    container.textContent = "";

    const wrapper = document.createElement("div");
    wrapper.className = `pages-grouped-view ${isSpreadsheet ? "spreadsheet" : isListMode ? "list-mode" : "sectioned"}`;

    const columnConfig = isListMode ? undefined : this._buildColumnConfig(dataset, contentColumnIds, props);

    if (!isListMode) {
      const headerBar = this._buildHeaderBar(dataset, contentColumnIds, props, columnConfig!);
      wrapper.appendChild(headerBar);
    } else {
      const colWidths = computeColumnWidths(dataset, contentColumnIds, "14px sans-serif");
      const colWidthsCss = colWidths.map((w) => `${w}px`).join(" ");
      const headerBar = document.createElement("div");
      headerBar.className = "column-header-bar";
      headerBar.style.gridTemplateColumns = colWidthsCss;
      for (const id of contentColumnIds) {
        const col = dataset.columns.find((c) => c.id === id);
        const label = document.createElement("span");
        label.className = "col-label";
        label.textContent = col?.name ?? String(id);
        headerBar.appendChild(label);
      }
      wrapper.appendChild(headerBar);
    }

    for (let gi = 0; gi < boundaries.length; gi++) {
      const b = boundaries[gi]!;
      const expanded = this._expandState.get(b.name) ?? true;

      const section = isSpreadsheet
        ? renderGroupTableRowHeader(b, expanded, this._instanceId, gi, showSummary)
        : renderGroupSectionHeader(b, expanded, this._instanceId, gi, showSummary);

      if (props.renderAfterHeader) {
        const node: GroupNode = {
          name: b.name,
          depth: 0,
          startRow: b.startRow,
          rowCount: b.rowCount,
          children: [],
          aggregates: b.aggregates,
        };
        const interstitial = props.renderAfterHeader(node);
        if (interstitial) {
          section.appendChild(interstitial);
        }
      }

      const contentWrapper = document.createElement("div");
      contentWrapper.className = "section-content";
      contentWrapper.id = `${this._instanceId}-group-${gi}`;
      if (!expanded) contentWrapper.hidden = true;

      if (isListMode) {
        const colWidths = computeColumnWidths(dataset, contentColumnIds, "14px sans-serif");
        const colWidthsCss = colWidths.map((w) => `${w}px`).join(" ");
        const listEl = renderContentList(dataset, b, contentColumnIds, colWidthsCss, this._columnRenderers);
        contentWrapper.appendChild(listEl);
      } else {
        const table = this._createGroupTable(dataset, b, columnConfig!, props);
        this._groupTables.set(b.name, table);
        contentWrapper.appendChild(table);
      }

      section.appendChild(contentWrapper);

      const toggleBtn = section.querySelector("[data-group]") as HTMLButtonElement;
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          this._handleToggle(toggleBtn, b.name, contentWrapper);
        });
      }

      wrapper.appendChild(section);
    }

    container.appendChild(wrapper);
    this._lastBoundaries = boundaries;
  }

  private _forwardPropsToTable(table: PagesTableHost, props: GroupedViewProps): void {
    if (this._columnRenderers) table.columnRenderers = this._columnRenderers;
    if (props.rowStyle) table.rowStyle = props.rowStyle;
    if (this._getRowAccent) table.getRowAccent = this._getRowAccent;
    if (props.selection) table.selection = props.selection;
    if (this._getRowKey) table.getRowKey = this._getRowKey;
    if (this._getRowDetail) table.getRowDetail = this._getRowDetail;
    if (this._getRowClass) table.getRowClass = this._getRowClass;
    table.sortable = props.sortable ?? false;
    table.clientSort = props.clientSort ?? false;
    table.activeSort = this.activeSort;
    if (this._hiddenColumnIds.size > 0) {
      (table as unknown as Record<string, unknown>).hiddenColumns = Array.from(this._hiddenColumnIds);
    }
    if (this._selectedKeys.size > 0) {
      (table as unknown as Record<string, unknown>).selectedKeys = Array.from(this._selectedKeys);
    }
  }

  private _createGroupTable(
    dataset: TypedDataSet,
    boundary: GroupBoundary,
    columnConfig: readonly TableColumnConfig[],
    props: GroupedViewProps,
  ): PagesTableHost {
    const table = document.createElement("pages-table") as PagesTableHost;
    table.embedded = true;
    table.headerVisible = false;
    table.dataSet = this._sliceDataset(dataset, boundary);
    table.columnConfig = columnConfig;
    this._forwardPropsToTable(table, props);
    this._wireSelectionListener(table, props);
    return table;
  }

  private _canReconcile(newBoundaries: readonly GroupBoundary[]): boolean {
    if (this._lastBoundaries.length === 0) return false;
    if (this._lastBoundaries.length !== newBoundaries.length) return false;
    const oldNames = this._lastBoundaries.map((b) => b.name);
    const newNames = newBoundaries.map((b) => b.name);
    return oldNames.every((name, i) => name === newNames[i]);
  }

  private _updateExistingTables(
    dataset: TypedDataSet,
    boundaries: readonly GroupBoundary[],
    contentColumnIds: readonly ColumnId[],
    props: GroupedViewProps,
  ): void {
    const columnConfig = this._buildColumnConfig(dataset, contentColumnIds, props);
    for (const b of boundaries) {
      const table = this._groupTables.get(b.name);
      if (table) {
        table.dataSet = this._sliceDataset(dataset, b);
        table.columnConfig = columnConfig;
      }
    }
  }

  private _handleToggle(
    btn: HTMLButtonElement,
    groupName: string,
    content: HTMLElement,
  ): void {
    const wasExpanded = this._expandState.get(groupName) ?? true;
    this._expandState.set(groupName, !wasExpanded);

    btn.setAttribute("aria-expanded", String(!wasExpanded));
    content.hidden = wasExpanded;

    const chevron = btn.querySelector(".section-chevron, .group-chevron");
    if (chevron) {
      if (chevron.classList.contains("group-chevron")) {
        chevron.textContent = wasExpanded ? "▶" : "▼";
      } else {
        if (!wasExpanded) {
          chevron.classList.add("expanded");
        } else {
          chevron.classList.remove("expanded");
        }
      }
    }

    this.dispatchEvent(new CustomEvent("pages-event", {
      bubbles: true,
      composed: true,
      detail: {
        topic: "group-toggle",
        payload: { group: groupName, expanded: !wasExpanded },
      },
    }));
  }

  private _buildHeaderBar(
    dataset: TypedDataSet,
    contentColumnIds: readonly ColumnId[],
    props: GroupedViewProps,
    columnConfig: readonly TableColumnConfig[],
  ): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "column-header-bar";

    const visibleColumnIds = contentColumnIds.filter((id) => !this._hiddenColumnIds.has(String(id)));

    const contentWidths = columnConfig
      .filter((c) => c.visible !== false && !this._hiddenColumnIds.has(String(c.id)))
      .map((c) => c.width ?? "1fr");

    const prefix: string[] = [];
    if (this._getRowDetail) prefix.push("40px");
    if (props.selection === "multi") prefix.push("40px");

    const gridCols = [...prefix, ...contentWidths].join(" ");
    bar.style.gridTemplateColumns = gridCols;

    if (this._getRowDetail) {
      const spacer = document.createElement("div");
      bar.appendChild(spacer);
    }
    if (props.selection === "multi") {
      const selectAllWrapper = document.createElement("div");
      selectAllWrapper.className = "select-all-wrapper";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "select-all-checkbox";
      cb.setAttribute("aria-label", "Select all rows");
      cb.addEventListener("click", () => this._handleSelectAll(dataset));
      selectAllWrapper.appendChild(cb);
      bar.appendChild(selectAllWrapper);
    }

    const sortable = props.sortable === true;
    for (let i = 0; i < visibleColumnIds.length; i++) {
      const id = visibleColumnIds[i]!;
      const col = dataset.columns.find((c) => c.id === id);
      const colConfig = props.columnConfig?.find((c) => c.id === id);
      const colSortable = sortable && colConfig?.sortable !== false;

      if (colSortable) {
        const btn = document.createElement("button");
        btn.className = "col-header";
        btn.setAttribute("data-column", String(id));
        btn.textContent = colConfig?.label ?? col?.name ?? String(id);
        btn.addEventListener("click", () => this._handleHeaderSort(id));
        bar.appendChild(btn);
      } else {
        const span = document.createElement("span");
        span.className = "col-label";
        span.setAttribute("data-column", String(id));
        span.textContent = colConfig?.label ?? col?.name ?? String(id);
        bar.appendChild(span);
      }
    }

    if (this.activeSort) {
      this._updateHeaderBarSortOnElement(bar, this.activeSort);
    }

    const pickerWrapper = document.createElement("div");
    pickerWrapper.className = "column-picker-wrapper";

    const trigger = document.createElement("button");
    trigger.className = "column-picker-trigger";
    trigger.setAttribute("aria-label", "Column options");
    trigger.textContent = "⋮";
    const dropdown = document.createElement("div");
    dropdown.className = "column-picker-dropdown";
    dropdown.hidden = true;

    const rebuildDropdown = (): void => {
      dropdown.textContent = "";
      const lbl = document.createElement("div");
      lbl.className = "picker-section-label";
      lbl.textContent = "Columns";
      dropdown.appendChild(lbl);

      const visibleCount = contentColumnIds.filter((cid) => !this._hiddenColumnIds.has(String(cid))).length;

      for (const id of contentColumnIds) {
        const col = dataset.columns.find((c) => c.id === id);
        const isHidden = this._hiddenColumnIds.has(String(id));
        const isLastVisible = !isHidden && visibleCount === 1;

        const item = document.createElement("label");
        item.className = "column-picker-item";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !isHidden;
        cb.disabled = isLastVisible;
        cb.addEventListener("change", () => {
          this._toggleColumnVisibility(String(id), contentColumnIds);
          rebuildDropdown();
        });
        const span = document.createElement("span");
        span.textContent = col?.name ?? String(id);
        item.append(cb, span);
        dropdown.appendChild(item);
      }
    };

    trigger.addEventListener("click", () => {
      this._pickerOpen = !this._pickerOpen;
      dropdown.hidden = !this._pickerOpen;
      if (this._pickerOpen) rebuildDropdown();
    });

    rebuildDropdown();
    pickerWrapper.append(trigger, dropdown);
    bar.appendChild(pickerWrapper);

    return bar;
  }

  private _handleHeaderSort(columnId: ColumnId): void {
    const current = this.activeSort;
    let order: "ASCENDING" | "DESCENDING";
    if (current && String(current.columnId) === String(columnId)) {
      order = current.order === "ASCENDING" ? "DESCENDING" : "ASCENDING";
    } else {
      order = "ASCENDING";
    }
    this.dispatchEvent(new CustomEvent("pages-sort", {
      detail: { columnId, order },
      bubbles: true,
      composed: true,
    }));
  }

  private _updateHeaderBarSort(sort: SortColumn | undefined): void {
    const bar = this.shadowRoot.querySelector(".column-header-bar");
    if (!bar) return;
    this._updateHeaderBarSortOnElement(bar, sort);
  }

  private _updateHeaderBarSortOnElement(bar: Element, sort: SortColumn | undefined): void {
    const buttons = bar.querySelectorAll(".col-header");
    for (const btn of buttons) {
      btn.removeAttribute("aria-sort");
      btn.classList.remove("sort-asc", "sort-desc");
    }
    if (!sort) return;
    const active = bar.querySelector(`.col-header[data-column="${String(sort.columnId)}"]`);
    if (!active) return;
    const dir = sort.order === "ASCENDING" ? "ascending" : "descending";
    active.setAttribute("aria-sort", dir);
    active.classList.add(sort.order === "ASCENDING" ? "sort-asc" : "sort-desc");
  }

  private _buildColumnConfig(
    dataset: TypedDataSet,
    contentColumnIds: readonly ColumnId[],
    props: GroupedViewProps,
  ): readonly TableColumnConfig[] {
    const rawWidths = computeColumnWidths(dataset, contentColumnIds, "14px sans-serif");
    const minWidth = Math.min(...rawWidths);
    const frWidths = rawWidths.map((w) => `${(w / minWidth).toFixed(2)}fr`);

    return dataset.columns.map((col) => {
      const contentIndex = contentColumnIds.indexOf(col.id);
      if (contentIndex === -1) {
        return { id: col.id, visible: false } as TableColumnConfig;
      }
      const userConfig = props.columnConfig?.find((c) => c.id === col.id);
      return {
        id: col.id,
        width: userConfig?.width ?? frWidths[contentIndex]!,
        ...userConfig,
      } as TableColumnConfig;
    });
  }

  private _sliceDataset(dataset: TypedDataSet, slice: { startRow: number; rowCount: number }): TypedDataSet {
    return {
      columns: dataset.columns,
      rows: dataset.rows.slice(slice.startRow, slice.startRow + slice.rowCount),
    };
  }

  private _nodeKey(parentPath: string, name: string): string {
    return parentPath ? `${parentPath}\x1F${name}` : name;
  }

  private _renderNode(
    node: GroupNode,
    wrapper: HTMLElement,
    columnConfig: readonly TableColumnConfig[],
    props: GroupedViewProps,
    dataset: TypedDataSet,
    contentColumnIds: readonly ColumnId[],
    parentPath: string,
    showSummary: boolean,
  ): void {
    const path = this._nodeKey(parentPath, node.name);
    const defaultExpanded = props.defaultExpanded ?? true;
    if (!this._expandState.has(path)) {
      this._expandState.set(path, node.rowCount === 0 ? false : defaultExpanded);
    }
    const expanded = this._expandState.get(path) ?? true;

    const section = document.createElement("div");
    section.className = "group-section";

    const isSubLevel = node.depth > 0;
    const btn = document.createElement("button");
    btn.className = isSubLevel ? "sub-section-toggle" : "section-toggle";
    btn.setAttribute("aria-expanded", String(expanded));
    btn.setAttribute("data-group", path);
    if (isSubLevel) {
      btn.style.paddingLeft = `${node.depth * 16}px`;
    }

    const chevron = document.createElement("span");
    chevron.className = expanded ? "section-chevron expanded" : "section-chevron";
    chevron.textContent = "▶";

    const title = document.createElement("span");
    title.className = "section-title";
    title.textContent = node.name;

    const summary = document.createElement("span");
    summary.className = "section-summary";
    let summaryText = `${node.rowCount} items`;
    if (showSummary && node.aggregates && node.aggregates.size > 0) {
      summaryText += " · " + Array.from(node.aggregates.values())
        .map((v) => String(v))
        .join(", ");
    }
    summary.textContent = summaryText;

    btn.append(chevron, title, summary);
    section.appendChild(btn);

    if (props.renderAfterHeader) {
      const interstitial = props.renderAfterHeader(node);
      if (interstitial) {
        section.appendChild(interstitial);
      }
    }

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "section-content";
    if (!expanded) contentWrapper.hidden = true;

    if (node.children.length > 0) {
      for (const child of node.children) {
        this._renderNode(child, contentWrapper, columnConfig, props, dataset, contentColumnIds, path, showSummary);
      }
    } else {
      const table = this._createGroupTableFromNode(dataset, node, columnConfig, props);
      this._groupTables.set(path, table);
      contentWrapper.appendChild(table);
    }

    section.appendChild(contentWrapper);

    btn.addEventListener("click", () => {
      this._handleToggle(btn, path, contentWrapper);
    });

    wrapper.appendChild(section);
  }

  private _createGroupTableFromNode(
    dataset: TypedDataSet,
    node: GroupNode,
    columnConfig: readonly TableColumnConfig[],
    props: GroupedViewProps,
  ): PagesTableHost {
    const table = document.createElement("pages-table") as PagesTableHost;
    table.embedded = true;
    table.headerVisible = false;
    table.dataSet = this._sliceDataset(dataset, node);
    table.columnConfig = columnConfig;
    this._forwardPropsToTable(table, props);
    this._wireSelectionListener(table, props);
    return table;
  }

  private _cleanupSelectionListeners(): void {
    for (const [table, listener] of this._selectionListeners) {
      table.removeEventListener("selection-change", listener);
    }
    this._selectionListeners.clear();
  }

  private _wireSelectionListener(table: PagesTableHost, props: GroupedViewProps): void {
    if (props.selection && props.selection !== "none") {
      const listener = (e: Event) => this._handleChildSelectionChange(e as CustomEvent);
      table.addEventListener("selection-change", listener);
      this._selectionListeners.set(table, listener);
    }
  }
}

customElements.define("pages-grouped-view", PagesGroupedView);
