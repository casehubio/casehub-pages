import type { NodeTypes } from '@xyflow/react';

type NodeComponent = NodeTypes[string];

export interface NodeTypeDescriptor {
  readonly type: string;
  readonly component: NodeComponent;
  readonly defaultStyle?: string;
}

const registry = new Map<string, NodeTypeDescriptor>();

export function registerNodeType(descriptor: NodeTypeDescriptor): void {
  if (registry.has(descriptor.type)) {
    throw new Error(`Node type "${descriptor.type}" already registered`);
  }
  registry.set(descriptor.type, descriptor);
}

export function getNodeTypes(): NodeTypes {
  const result: NodeTypes = {};
  for (const [type, desc] of registry) {
    result[type] = desc.component;
  }
  return result;
}

export function getRegisteredStyles(): string {
  const parts: string[] = [];
  for (const desc of registry.values()) {
    if (desc.defaultStyle) {
      parts.push(desc.defaultStyle);
    }
  }
  return parts.join('\n');
}

export function clearRegistry(): void {
  registry.clear();
}
