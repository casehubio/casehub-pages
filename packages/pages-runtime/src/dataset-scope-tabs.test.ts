import { describe, it, expect } from "vitest";
import type { Component } from "@casehubio/pages-component";
import { dataSetId } from "@casehubio/pages-data";
import type { ExternalDataSetDef } from "@casehubio/pages-data";
import { buildDataSetScope, resolveDataSetDef, resolveDataSetEntry } from "./dataset-scope.js";
import { buildPagePathMap } from "./page-paths.js";

function makeDef(uuid: string): ExternalDataSetDef {
  return { uuid: dataSetId(uuid), content: "[]" };
}

describe("dataset scoping for tab content", () => {
  it("non-page components in tab slots resolve root datasets via parent page path", () => {
    const ds = makeDef("live-metrics");
    const timeseries: Component = { type: "timeseries" };
    const tabs: Component = {
      type: "tabs",
      slots: { "Single Metric": [timeseries] },
    };
    const childPage: Component = {
      type: "page",
      props: { name: "Live Polling" },
      slots: { default: [tabs] },
    };
    const root: Component = {
      type: "page",
      props: { name: "root", datasets: [ds] },
      slots: { content: [childPage] },
    };
    const paths = buildPagePathMap(root);
    const scope = buildDataSetScope(root, paths);

    const chartPath = paths.get(timeseries);
    expect(chartPath).toBe("content");
    expect(resolveDataSetDef(dataSetId("live-metrics"), "content", scope)).toBe(ds);
  });

  it("non-page components in tab grid resolve root datasets", () => {
    const ds = makeDef("sales");
    const table: Component = { type: "data-table" };
    const tabs: Component = {
      type: "tabs",
      slots: { "Tab A": [table] },
    };
    const childPage: Component = {
      type: "page",
      props: { name: "Content" },
      grid: [{ at: { mode: "positioned" as const, x: 0, y: 0, w: 12, h: 1 }, component: tabs }],
    };
    const root: Component = {
      type: "page",
      props: { name: "root", datasets: [ds] },
      slots: { content: [childPage] },
    };
    const paths = buildPagePathMap(root);
    const scope = buildDataSetScope(root, paths);

    const tablePath = paths.get(table);
    expect(tablePath).toBe("content");
    expect(resolveDataSetDef(dataSetId("sales"), tablePath!, scope)).toBe(ds);
  });

  it("virtual page wrappers give each tab its own page path with inherited datasets", () => {
    const ds = makeDef("metrics");
    const chart: Component = { type: "bar-chart" };
    const overviewPage: Component = {
      type: "page",
      props: { name: "Overview" },
      slots: { default: [chart] },
    };
    const detailTable: Component = { type: "data-table" };
    const detailPage: Component = {
      type: "page",
      props: { name: "Detail" },
      slots: { default: [detailTable] },
    };
    const tabs: Component = {
      type: "tabs",
      slots: {
        "Overview": [overviewPage],
        "Detail": [detailPage],
      },
    };
    const childPage: Component = {
      type: "page",
      props: { name: "Dashboard" },
      slots: { default: [tabs] },
    };
    const root: Component = {
      type: "page",
      props: { name: "root", datasets: [ds] },
      slots: { content: [childPage] },
    };
    const paths = buildPagePathMap(root);
    const scope = buildDataSetScope(root, paths);

    // Virtual page wrappers get their own page paths
    expect(paths.get(overviewPage)).toBe("content/Overview");
    expect(paths.get(detailPage)).toBe("content/Detail");

    // Components inside inherit the virtual page path
    expect(paths.get(chart)).toBe("content/Overview");
    expect(paths.get(detailTable)).toBe("content/Detail");

    // Root datasets are inherited by virtual pages
    expect(scope.get("content/Overview")?.get(dataSetId("metrics"))).toBe(ds);
    expect(scope.get("content/Detail")?.get(dataSetId("metrics"))).toBe(ds);

    // Resolution works from the component's page path
    expect(resolveDataSetEntry(dataSetId("metrics"), "content/Overview", scope)).toBe(ds);
    expect(resolveDataSetEntry(dataSetId("metrics"), "content/Detail", scope)).toBe(ds);
  });
});
