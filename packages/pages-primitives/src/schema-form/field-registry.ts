type FieldRenderer = typeof HTMLElement;
const registry = new Map<string, FieldRenderer>();

export function registerFieldRenderer(format: string, component: FieldRenderer): void {
  registry.set(format, component);
}

export function getFieldRenderer(format: string): FieldRenderer | undefined {
  return registry.get(format);
}

export function hasFieldRenderer(format: string): boolean {
  return registry.has(format);
}
