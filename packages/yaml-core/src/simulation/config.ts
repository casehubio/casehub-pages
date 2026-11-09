import type { DataRealism, ExhaustionPolicy, MatchPolicy, CorpusSelectorConfig, TriggerConfig } from './types.js';

export interface SimulationConfig {
  strategyFor(qualifiedName: string): string | undefined;
  captureEnabled(qualifiedName: string): boolean;
  exhaustionPolicy(qualifiedName: string): ExhaustionPolicy | undefined;
  matchPolicy(qualifiedName: string): MatchPolicy | undefined;
  threshold(qualifiedName: string): number | undefined;
  speed(): number;
  fallthroughRealism(qualifiedName: string): DataRealism | undefined;
  corpusSelection(qualifiedName: string): CorpusSelectorConfig | undefined;
  corpusSelectionKeys(): string[];
  corpusSelectionGroup(qualifiedName: string): string | undefined;
  triggers(): TriggerConfig[];
}

export interface MapSimulationConfigInit {
  strategies?: Record<string, string>;
  capture?: string[];
  exhaustionPolicies?: Record<string, ExhaustionPolicy>;
  matchPolicies?: Record<string, MatchPolicy>;
  thresholds?: Record<string, number>;
  speed?: number;
  fallthroughRealism?: Record<string, DataRealism>;
  corpusSelections?: Record<string, CorpusSelectorConfig>;
  corpusSelectionGroups?: Record<string, string>;
  triggers?: TriggerConfig[];
}

export class MapSimulationConfig implements SimulationConfig {
  private readonly strategies: Record<string, string>;
  private readonly capture: Set<string>;
  private readonly exhaustionPolicies: Record<string, ExhaustionPolicy>;
  private readonly matchPolicies: Record<string, MatchPolicy>;
  private readonly thresholds: Record<string, number>;
  private readonly _speed: number;
  private readonly _fallthroughRealism: Record<string, DataRealism>;
  private readonly corpusSelections: Record<string, CorpusSelectorConfig>;
  private readonly _corpusSelectionGroups: Record<string, string>;
  private readonly _triggers: TriggerConfig[];

  constructor(init: MapSimulationConfigInit = {}) {
    this.strategies = init.strategies ?? {};
    this.capture = new Set(init.capture ?? []);
    this.exhaustionPolicies = init.exhaustionPolicies ?? {};
    this.matchPolicies = init.matchPolicies ?? {};
    this.thresholds = init.thresholds ?? {};
    this._speed = init.speed ?? 1.0;
    this._fallthroughRealism = init.fallthroughRealism ?? {};
    this.corpusSelections = init.corpusSelections ?? {};
    this._corpusSelectionGroups = init.corpusSelectionGroups ?? {};
    this._triggers = init.triggers ?? [];
  }

  strategyFor(qualifiedName: string): string | undefined {
    return this.strategies[qualifiedName];
  }

  captureEnabled(qualifiedName: string): boolean {
    return this.capture.has(qualifiedName);
  }

  exhaustionPolicy(qualifiedName: string): ExhaustionPolicy | undefined {
    return this.exhaustionPolicies[qualifiedName];
  }

  matchPolicy(qualifiedName: string): MatchPolicy | undefined {
    return this.matchPolicies[qualifiedName];
  }

  threshold(qualifiedName: string): number | undefined {
    return this.thresholds[qualifiedName];
  }

  speed(): number {
    return this._speed;
  }

  fallthroughRealism(qualifiedName: string): DataRealism | undefined {
    return this._fallthroughRealism[qualifiedName];
  }

  corpusSelection(qualifiedName: string): CorpusSelectorConfig | undefined {
    return this.corpusSelections[qualifiedName];
  }

  corpusSelectionKeys(): string[] {
    return Object.keys(this.corpusSelections);
  }

  corpusSelectionGroup(qualifiedName: string): string | undefined {
    return this._corpusSelectionGroups[qualifiedName];
  }

  triggers(): TriggerConfig[] {
    return this._triggers;
  }
}
