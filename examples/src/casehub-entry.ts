import { loadSite } from "@casehubio/pages-runtime";
import "@casehubio/pages-primitives";
import "@casehubio/pages-ui-components/input";
import "@casehubio/pages-ui-components/select";
import "@casehubio/pages-ui-components/textarea";
import "@casehubio/pages-ui-components/checkbox";
import "@casehubio/pages-ui-components/button";
import "@casehubio/pages-ui-components/badge";
import "@casehubio/pages-ui-components/status-dot";
import "@casehubio/pages-viz";
import "@casehubio/pages-aria/dist/controller";
import "@casehubio/graph-renderer";
import "@casehubio/graph-renderer/dist/bridge/PagesGraphCanvas.js";
import "@casehubio/pages-code-editor";
import { createSchemaCompletion } from "@casehubio/pages-code-editor";
import { dashboardSchema } from "@casehubio/pages-schema";
import "@casehubio/pages-property-palette";
import "@casehubio/pages-diagram-palette";
// pages-builder loaded on demand — static import crashes UMD bundle (decorator compat)
import { createBasicPipelineModel, PIPELINE_SCHEMAS } from "./pipeline-stencils";
import type { LiveSite, SiteOptions } from "@casehubio/pages-runtime";
import { applyTheme, getTheme } from "@casehubio/pages-ui-tokens";

applyTheme('casehub-dark');

export { loadSite, applyTheme, getTheme };
export type { LiveSite, SiteOptions };

export { createBasicPipelineModel, PIPELINE_SCHEMAS };
export const yamlCompletion = createSchemaCompletion(dashboardSchema);
export { dashboardSchema };
export { defaultEditPolicy, applyGraphEdit, getAllStencils } from "@casehubio/graph-renderer";
export { createZoneLayoutEngine } from "@casehubio/pages-runtime";
export { dockWorkbench, html, rows, split, columns, withId, dockBar, deferred, withStyle, hostPanel } from "@casehubio/pages-ui/dist/dsl/builders.js";
export type { DockWorkbenchConfig, DockPanelConfig, DockSideConfig } from "@casehubio/pages-ui/dist/dsl/builders.js";
export { createScheduler, parseScenario } from "@casehubio/pages-aria/scenario";
export type { ScenarioRunner, SchedulerOptions } from "@casehubio/pages-aria/scenario";
export { StepWalker, stepSuccess, stepFailure } from "@casehubio/yaml-core/step";
export { StructuralStepEvaluator } from "@casehubio/yaml-core/step";
export { StepPluginRegistry } from "@casehubio/yaml-core/step";
export { CompositeStepCatalog } from "@casehubio/yaml-core/step";
export type { StepResult, ResolvedStep } from "@casehubio/yaml-core/step";
export { matches, valuePattern, structuralPattern, anyOfPattern, defaultPattern } from "@casehubio/yaml-core";
export { isTruthy } from "@casehubio/yaml-core";
export { DefaultScenarioScope } from "@casehubio/yaml-core/orchestration";
export { DefaultCorrelationScope } from "@casehubio/yaml-core/orchestration";

import { StepPluginRegistry } from "@casehubio/yaml-core/step";
import { CompositeStepCatalog } from "@casehubio/yaml-core/step";
import { StepWalker } from "@casehubio/yaml-core/step";
import { StructuralStepEvaluator } from "@casehubio/yaml-core/step";
import { DefaultScenarioScope } from "@casehubio/yaml-core/orchestration";
import { stepSuccess, stepFailure } from "@casehubio/yaml-core/step";
import type { StepAction } from "@casehubio/yaml-core/step";
import { parseStepParameterType } from "@casehubio/yaml-core";

export function createStepRunner(plugins: Array<{ name: string; inputs?: Record<string, { type: string; required: boolean }>; outputs?: Record<string, { type: string; required: boolean }>; execute: StepAction['execute'] }>) {
  const registry = new StepPluginRegistry();
  for (const p of plugins) {
    const toParameters = (params: Record<string, { type: string; required: boolean }> | undefined) =>
      Object.fromEntries(Object.entries(params ?? {}).map(([name, param]) => [
        name, { ...param, type: parseStepParameterType(param.type) },
      ]));
    registry.register({ name: p.name, inputs: toParameters(p.inputs), outputs: toParameters(p.outputs), execute: p.execute });
  }
  const catalog = new CompositeStepCatalog([registry.createSource()]);
  const evaluator = new StructuralStepEvaluator();
  const scope = new DefaultScenarioScope();

  return {
    resolve(steps: Record<string, unknown>[]) { return StepWalker.resolve(steps, catalog); },
    async run(steps: Record<string, unknown>[]) {
      const resolved = StepWalker.resolve(steps, catalog);
      const results = [];
      for (const step of resolved) {
        const result = await evaluator.evaluate(step, { scope } as never);
        results.push(result);
      }
      return results;
    },
    stepSuccess,
    stepFailure,
    scope,
  };
}
