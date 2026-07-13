import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@casehubio/pages-viz";
import type { PagesElement, PagesFormInput } from "@casehubio/pages-viz";
import type { PagesFilterApply } from "@casehubio/pages-viz/dist/base/filter-types.js";
import { cellToRaw } from "@casehubio/pages-viz/dist/base/cell-extract.js";
import { loadSite } from "./site.js";
import type { LiveSite } from "./site.js";
import { columnId } from "@casehubio/pages-data";
import type { FormInputCommon } from "@casehubio/pages-component";
import type { VizComponentProps } from "@casehubio/pages-viz/dist/base/types.js";

const CONTACT_MANAGER_YAML = `
datasets:
  - uuid: contacts
    content: >-
      [
        [1, "Alice", "alice@example.com", "Work", "true"],
        [2, "Bob", "bob@example.com", "Personal", "false"],
        [3, "Carol", "carol@example.com", "Work", "true"]
      ]
    columns:
      - id: id
        type: NUMBER
      - id: name
        type: TEXT
      - id: email
        type: TEXT
      - id: category
        type: LABEL
      - id: active
        type: LABEL

pages:
  - name: Contact List
    components:
      - displayer:
          type: METRIC
          filter:
            enabled: true
            notification: true
          lookup:
            uuid: contacts
      - page: Contact Form

  - name: Contact Form
    dataScope:
      dataset: contacts
      idColumn: id
    save:
      trigger: auto
      delay: 2000
      adapter: local
    components:
      - text-input:
          field: name
          label: Name
      - text-input:
          field: email
          label: Email
      - dropdown:
          field: category
          label: Category
          options:
            values: [Work, Personal, Family]
      - checkbox:
          field: active
          label: Active
`;

describe("form integration — YAML end-to-end", () => {
  let target: HTMLDivElement;
  let site: LiveSite | null = null;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(() => {
    site?.dispose();
    site = null;
    document.body.removeChild(target);
  });

  async function waitFor(
    condition: () => boolean,
    msg: string,
    maxWait = 1000,
  ): Promise<void> {
    const start = Date.now();
    while (!condition() && Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (!condition()) throw new Error(`Timeout: ${msg}`);
  }

  function getFormInputs(): PagesFormInput<FormInputCommon>[] {
    return Array.from(
      target.querySelectorAll<PagesFormInput<FormInputCommon>>(
        "pages-text-input, pages-number-input, pages-dropdown, pages-checkbox, pages-date-picker, pages-textarea"
      ),
    );
  }

  function getMetric(): PagesElement<VizComponentProps> | null {
    return target.querySelector("pages-metric");
  }

  it("loadSite renders metric and form inputs from YAML", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const metric = getMetric();
    expect(metric).not.toBeNull();

    await waitFor(() => !!metric!.dataSet, "metric data");
    expect(metric!.dataSet!.rows.length).toBe(3);

    const inputs = getFormInputs();
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("form inputs receive dataset on initial load", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const inputs = getFormInputs();
    expect(inputs.length).toBeGreaterThan(0);

    await waitFor(() => inputs.every((i) => i.dataSet), "all form inputs have data");

    for (const input of inputs) {
      expect(input.dataSet!.rows.length).toBe(3);
    }
  });

  it("filter event filters form inputs to one record", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const metric = getMetric();
    await waitFor(() => !!metric!.dataSet, "metric data");

    const inputs = getFormInputs();
    await waitFor(() => inputs.every((i) => i.dataSet), "form input data");

    // Simulate filter event — emit pages-filter for id column, row 0
    const clickedRow = metric!.dataSet!.rows[0]!;
    const idValue = String(cellToRaw(clickedRow.cell(columnId("id"))));
    metric!.dispatchEvent(
      new CustomEvent("pages-filter", {
        bubbles: true,
        composed: true,
        detail: { columnId: columnId("id"), value: idValue, row: clickedRow, reset: false, group: undefined } satisfies PagesFilterApply,
      }),
    );

    await new Promise((r) => setTimeout(r, 100));

    for (const input of inputs) {
      expect(input.dataSet!.rows.length).toBe(1);
    }
  });

  it("selecting a different record updates form inputs to the new record", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const metric = getMetric();
    await waitFor(() => !!metric!.dataSet, "metric data");

    const inputs = getFormInputs();
    await waitFor(() => inputs.every((i) => i.dataSet), "form input data");

    // Select row 0 (Alice)
    const clickedRow0 = metric!.dataSet!.rows[0]!;
    const idValue0 = String(cellToRaw(clickedRow0.cell(columnId("id"))));
    metric!.dispatchEvent(
      new CustomEvent("pages-filter", {
        bubbles: true,
        composed: true,
        detail: { columnId: columnId("id"), value: idValue0, row: clickedRow0, reset: false, group: undefined } satisfies PagesFilterApply,
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    const nameInputs = inputs.filter((i) => i.tagName.toLowerCase() === "pages-text-input");
    expect(nameInputs.length).toBeGreaterThan(0);
    const nameInput = nameInputs[0]!;
    const aliceNameCell = nameInput.dataSet!.rows[0]!.cell(columnId("name"));
    expect(aliceNameCell.type !== "NULL" && aliceNameCell.value).toBe("Alice");

    // Select row 1 (Bob)
    const clickedRow1 = metric!.dataSet!.rows[1]!;
    const idValue1 = String(cellToRaw(clickedRow1.cell(columnId("id"))));
    metric!.dispatchEvent(
      new CustomEvent("pages-filter", {
        bubbles: true,
        composed: true,
        detail: { columnId: columnId("id"), value: idValue1, row: clickedRow1, reset: false, group: undefined } satisfies PagesFilterApply,
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    const bobNameCell = nameInput.dataSet!.rows[0]!.cell(columnId("name"));
    expect(bobNameCell.type !== "NULL" && bobNameCell.value).toBe("Bob");
  });

  it("form inputs are editable when page has save config", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const inputs = getFormInputs();
    await waitFor(() => inputs.some((i) => i.dataSet), "form input data");

    for (const input of inputs) {
      expect(input.editable).toBe(true);
    }
  });

  it("form inputs without save config are read-only", async () => {
    const yamlNoSave = `
datasets:
  - uuid: items
    content: >-
      [["A", 1]]
    columns:
      - id: name
        type: TEXT
      - id: qty
        type: NUMBER

pages:
  - name: ReadonlyForm
    dataScope:
      dataset: items
      idColumn: name
    components:
      - text-input:
          field: name
          label: Name
`;

    site = await loadSite(target, yamlNoSave);
    const inputs = getFormInputs();
    expect(inputs.length).toBeGreaterThan(0);

    await waitFor(() => inputs.some((i) => i.dataSet), "form input data");

    for (const input of inputs) {
      expect(input.editable).toBe(false);
    }
  });

  it("filtering by different columns always filters by idColumn", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const metric = getMetric();
    await waitFor(() => !!metric!.dataSet, "metric data");

    const inputs = getFormInputs();
    await waitFor(() => inputs.every((i) => i.dataSet), "form input data");

    // Filter by Alice's name cell (columnId: "name", rowIndex: 0)
    const clickedRow0 = metric!.dataSet!.rows[0]!;
    const nameValue0 = String(cellToRaw(clickedRow0.cell(columnId("name"))));
    metric!.dispatchEvent(
      new CustomEvent("pages-filter", {
        bubbles: true,
        composed: true,
        detail: { columnId: columnId("name"), value: nameValue0, row: clickedRow0, reset: false, group: undefined } satisfies PagesFilterApply,
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    const nameInput = inputs.find((i) => i.tagName.toLowerCase() === "pages-text-input")!;
    expect(nameInput.dataSet!.rows.length).toBe(1);
    const aliceCell = nameInput.dataSet!.rows[0]!.cell(columnId("name"));
    expect(aliceCell.type !== "NULL" && aliceCell.value).toBe("Alice");

    // Filter by Bob's email cell (different column! columnId: "email", rowIndex: 1)
    // Without the fix, this would compound: name="Alice" AND email="bob@..."
    // With the fix, it translates to idColumn filter: id=2 (Bob)
    const clickedRow1 = metric!.dataSet!.rows[1]!;
    const emailValue1 = String(cellToRaw(clickedRow1.cell(columnId("email"))));
    metric!.dispatchEvent(
      new CustomEvent("pages-filter", {
        bubbles: true,
        composed: true,
        detail: { columnId: columnId("email"), value: emailValue1, row: clickedRow1, reset: false, group: undefined } satisfies PagesFilterApply,
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(nameInput.dataSet!.rows.length).toBe(1);
    const bobCell = nameInput.dataSet!.rows[0]!.cell(columnId("name"));
    expect(bobCell.type !== "NULL" && bobCell.value).toBe("Bob");
  });

  it("selecting a different row after initial selection works correctly", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const metric = getMetric();
    await waitFor(() => !!metric!.dataSet, "metric data");

    const inputs = getFormInputs();
    await waitFor(() => inputs.every((i) => i.dataSet), "form input data");

    // Select Alice first (row 0)
    const clickedRow0 = metric!.dataSet!.rows[0]!;
    const idValue0 = String(cellToRaw(clickedRow0.cell(columnId("id"))));
    metric!.dispatchEvent(
      new CustomEvent("pages-filter", {
        bubbles: true,
        composed: true,
        detail: { columnId: columnId("id"), value: idValue0, row: clickedRow0, reset: false, group: undefined } satisfies PagesFilterApply,
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    const nameInput = inputs.find((i) => i.tagName.toLowerCase() === "pages-text-input")!;
    const aliceNameCell2 = nameInput.dataSet!.rows[0]!.cell(columnId("name"));
    expect(aliceNameCell2.type !== "NULL" && aliceNameCell2.value).toBe("Alice");

    // Now select Bob using the ROW OBJECT directly
    const bobRow = metric!.dataSet!.rows[1]!; // Bob is row 1 in the full dataset
    const bobNameValue = String(cellToRaw(bobRow.cell(columnId("name"))));
    metric!.dispatchEvent(
      new CustomEvent("pages-filter", {
        bubbles: true,
        composed: true,
        detail: { columnId: columnId("name"), value: bobNameValue, row: bobRow, reset: false, group: undefined } satisfies PagesFilterApply,
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(nameInput.dataSet!.rows.length).toBe(1);
    const bobNameCell2 = nameInput.dataSet!.rows[0]!.cell(columnId("name"));
    expect(bobNameCell2.type !== "NULL" && bobNameCell2.value).toBe("Bob");
  });

  it("pages-field-change events are handled without crash", async () => {
    site = await loadSite(target, CONTACT_MANAGER_YAML);

    const inputs = getFormInputs();
    await waitFor(() => inputs.every((i) => i.dataSet), "form input data");

    const nameInput = inputs.find((i) => i.tagName.toLowerCase() === "pages-text-input");
    expect(nameInput).toBeDefined();

    nameInput!.dispatchEvent(
      new CustomEvent("pages-field-change", {
        bubbles: true,
        composed: true,
        detail: { field: "name", value: "Updated", committed: true },
      }),
    );

    await new Promise((r) => setTimeout(r, 50));
  });
});
