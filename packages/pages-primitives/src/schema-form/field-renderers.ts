import { html, type TemplateResult } from 'lit';

interface FieldSchema {
  readonly type?: string;
  readonly format?: string;
  readonly enum?: readonly string[];
  readonly maxLength?: number;
  readonly properties?: Readonly<Record<string, FieldSchema>>;
  readonly items?: FieldSchema;
}

export function renderDisplayField(
  key: string,
  schema: FieldSchema,
  value: unknown,
): TemplateResult {
  if (value === null || value === undefined) {
    return html`<div class="field"><span class="label">${key}</span><span class="value muted">—</span></div>`;
  }

  if (schema.type === 'boolean') {
    return html`<div class="field"><span class="label">${key}</span><span class="value">${value ? 'Yes' : 'No'}</span></div>`;
  }

  if (schema.type === 'object' && schema.properties) {
    const obj = value as Record<string, unknown>;
    return html`
      <div class="field nested">
        <span class="label">${key}</span>
        <div class="nested-content">
          ${Object.entries(schema.properties).map(([k, s]) =>
            renderDisplayField(k, s, obj[k])
          )}
        </div>
      </div>`;
  }

  if (schema.type === 'array' && Array.isArray(value)) {
    return html`<div class="field"><span class="label">${key}</span><span class="value">${(value as unknown[]).join(', ')}</span></div>`;
  }

  return html`<div class="field"><span class="label">${key}</span><span class="value">${String(value)}</span></div>`;
}

export function renderEditField(
  key: string,
  schema: FieldSchema,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
): TemplateResult {
  if (schema.enum) {
    return html`
      <div class="field">
        <label for="${key}">${key}</label>
        <select id="${key}" @change=${(e: Event) => onChange(key, (e.target as HTMLSelectElement).value)}>
          ${schema.enum.map(opt => html`<option value=${opt} ?selected=${value === opt}>${opt}</option>`)}
        </select>
      </div>`;
  }

  if (schema.type === 'boolean') {
    return html`
      <div class="field">
        <label>
          <input type="checkbox" ?checked=${Boolean(value)} @change=${(e: Event) => onChange(key, (e.target as HTMLInputElement).checked)} />
          ${key}
        </label>
      </div>`;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return html`
      <div class="field">
        <label for="${key}">${key}</label>
        <input id="${key}" type="number" .value=${String(value ?? '')} @input=${(e: Event) => onChange(key, Number((e.target as HTMLInputElement).value))} />
      </div>`;
  }

  if (schema.type === 'string' && (schema.maxLength ?? 0) > 200) {
    return html`
      <div class="field">
        <label for="${key}">${key}</label>
        <textarea id="${key}" .value=${String(value ?? '')} @input=${(e: Event) => onChange(key, (e.target as HTMLTextAreaElement).value)}></textarea>
      </div>`;
  }

  // Default: text input
  return html`
    <div class="field">
      <label for="${key}">${key}</label>
      <input id="${key}" type="text" .value=${String(value ?? '')} @input=${(e: Event) => onChange(key, (e.target as HTMLInputElement).value)} />
    </div>`;
}
