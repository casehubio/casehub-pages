import type { ServiceRegistry } from './walker.js';

export interface StreamingTypeInfo {
  inputType: string;
  outputType: string;
  inputKey: string;
  factory: StreamingStepFactory;
}

export type StreamingStepFactory = (
  params: Record<string, unknown>,
  input: AsyncIterable<unknown>,
  services: ServiceRegistry,
) => AsyncIterable<unknown>;

export interface FusedStageDescriptor {
  stepName: string | null;
  actionName: string;
  params: Record<string, unknown>;
  decorators: Record<string, unknown>;
  inputKey: string;
  factory: StreamingStepFactory;
}
