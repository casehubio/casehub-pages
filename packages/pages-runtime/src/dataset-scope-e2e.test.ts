import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { parsePage } from "@casehubio/pages-ui/dist/parser/index.js";
import { dataSetId } from "@casehubio/pages-data";
import { buildDataSetScope, resolveDataSetEntry } from "./dataset-scope.js";
import { buildPagePathMap } from "./page-paths.js";

const samplePath = resolve(
  import.meta.dirname ?? __dirname,
  "../../../examples/samples/Live Data/Polling.page.yaml",
);

describe("YAML → parsePage → dataset scope for targetPage tabs", () => {
  const yaml = readFileSync(samplePath, "utf-8");
  const root = parsePage(load(yaml));
  const paths = buildPagePathMap(root);
  const scope = buildDataSetScope(root, paths);

  it("root page contains both datasets", () => {
    const rootScope = scope.get("");
    expect(rootScope).toBeDefined();
    expect(rootScope!.has(dataSetId("live-metrics"))).toBe(true);
    expect(rootScope!.has(dataSetId("multi-metrics"))).toBe(true);
  });

  it("each tab virtual page has its own page path", () => {
    const allPaths = new Set(scope.keys());
    expect(allPaths.has("content/Single Metric")).toBe(true);
    expect(allPaths.has("content/Multi-Series")).toBe(true);
    expect(allPaths.has("content/Raw Data")).toBe(true);
  });

  it("root datasets resolve from each tab's virtual page path", () => {
    for (const tabPath of ["content/Single Metric", "content/Multi-Series", "content/Raw Data"]) {
      expect(resolveDataSetEntry(dataSetId("live-metrics"), tabPath, scope)).toBeDefined();
      expect(resolveDataSetEntry(dataSetId("multi-metrics"), tabPath, scope)).toBeDefined();
    }
  });

  it("tab components are mapped to their virtual page path", () => {
    const componentPaths = [...paths.values()];
    expect(componentPaths).toContain("content/Single Metric");
    expect(componentPaths).toContain("content/Multi-Series");
    expect(componentPaths).toContain("content/Raw Data");
  });
});
