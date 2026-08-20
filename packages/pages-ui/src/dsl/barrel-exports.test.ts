import { describe, it, expect } from "vitest";
import * as dsl from "./index.js";

describe("dsl barrel exports", () => {
  it("exports all #317 builders", () => {
    expect(typeof dsl.heatmapChart).toBe("function");
    expect(typeof dsl.treemapChart).toBe("function");
    expect(typeof dsl.densityHeatmap).toBe("function");
    expect(typeof dsl.badge).toBe("function");
    expect(typeof dsl.countdown).toBe("function");
    expect(typeof dsl.timeline).toBe("function");
    expect(typeof dsl.graph).toBe("function");
    expect(typeof dsl.eventTimeline).toBe("function");
    expect(typeof dsl.masterDetail).toBe("function");
  });
});
