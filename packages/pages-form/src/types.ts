export interface FieldSchema {
  readonly type?: string;
  readonly format?: string;
  readonly enum?: readonly string[];
  readonly maxLength?: number;
  readonly properties?: Readonly<Record<string, FieldSchema>>;
  readonly items?: FieldSchema;
  readonly required?: readonly string[];
}

export interface FieldRendererElement extends HTMLElement {
  value: unknown;
  schema: FieldSchema;
  mode: 'display' | 'edit';
}
