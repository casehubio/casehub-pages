export interface ContainerChildDescriptor {
  type: string;
  slots: SlotDescriptor[];
}

export type SlotDescriptor =
  | { kind: 'named-record'; yamlKey: string; childKey: 'components' }
  | { kind: 'array'; yamlKey: string }
  | { kind: 'nested-array'; yamlKey: string; childKey: string };

export const CONTAINER_DESCRIPTORS: ContainerChildDescriptor[] = [
  { type: 'tabs', slots: [{ kind: 'named-record', yamlKey: 'tabs', childKey: 'components' }] },
  { type: 'pills', slots: [{ kind: 'named-record', yamlKey: 'tabs', childKey: 'components' }] },
  { type: 'accordion', slots: [{ kind: 'named-record', yamlKey: 'tabs', childKey: 'components' }] },
  { type: 'sidebar', slots: [
    { kind: 'array', yamlKey: 'sidebar' },
    { kind: 'array', yamlKey: 'content' },
  ]},
  { type: 'split', slots: [{ kind: 'nested-array', yamlKey: 'split', childKey: 'children' }] },
  { type: 'form-scope', slots: [{ kind: 'nested-array', yamlKey: 'form-scope', childKey: 'components' }] },
  { type: 'carousel', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
  { type: 'stack', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
  { type: 'menu', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
  { type: 'tree', slots: [{ kind: 'named-record', yamlKey: 'sections', childKey: 'components' }] },
];

const descriptorMap = new Map(CONTAINER_DESCRIPTORS.map(d => [d.type, d]));

export function getContainerDescriptor(type: string): ContainerChildDescriptor | undefined {
  return descriptorMap.get(type);
}
