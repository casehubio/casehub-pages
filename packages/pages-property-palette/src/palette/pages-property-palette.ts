import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { FieldSchema } from '@casehubio/pages-ui-components/types';
import { validateField } from '@casehubio/pages-ui-components/validation';
import { resolveEditor } from '../resolver.js';
import type { PropertyPaletteSource, EditorDescriptor, EditorResolver, FieldRenderContext } from '../types.js';

interface FieldEntry {
  key: string;
  schema: FieldSchema;
  order: number;
  group: string | undefined;
  advanced: boolean;
}

const MAX_NESTING_DEPTH = 5;

export class PagesPropertyPalette extends LitElement {
  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui, sans-serif); }
    .palette { display: flex; flex-direction: column; gap: var(--pages-space-2, 8px); }
    .advanced-toggle {
      display: flex; align-items: center; gap: var(--pages-space-1, 4px);
      font-size: var(--pages-font-size-xs, 11px);
      color: var(--pages-neutral-8, #9ca3af);
      cursor: pointer;
      user-select: none;
    }
    .advanced-toggle input { accent-color: var(--pages-accent-9, #5470c6); }
    details.group {
      border: 1px solid var(--pages-neutral-4, #e5e7eb);
      border-radius: var(--pages-radius-sm, 4px);
    }
    details.group summary {
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      font-size: var(--pages-font-size-base, 14px);
      font-weight: var(--pages-font-weight-semibold, 600);
      color: var(--pages-neutral-11, #374151);
      cursor: pointer;
      user-select: none;
    }
    .group-fields, .ungrouped-fields {
      display: flex; flex-direction: column;
      gap: var(--pages-space-2, 8px);
      padding: var(--pages-space-2, 8px);
    }
    .nested-group {
      padding-left: var(--pages-space-3, 12px);
      border-left: 2px solid var(--pages-neutral-4, #e5e7eb);
      margin: var(--pages-space-1, 4px) 0;
    }
    .field-wrapper { position: relative; }
    .field-label {
      display: flex; align-items: center; gap: var(--pages-space-1, 4px);
      font-size: var(--pages-font-size-base, 14px);
      font-weight: var(--pages-font-weight-medium, 500);
      color: var(--pages-neutral-12, #333);
      margin-bottom: var(--pages-space-1, 4px);
    }
    .required-indicator { color: var(--pages-danger-9, #dc2626); }
    .help-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--pages-neutral-4, #e5e7eb);
      color: var(--pages-neutral-9, #6b7280);
      font-size: 10px; font-weight: 700;
      cursor: help;
    }
  `;

  @property({ attribute: false }) source: PropertyPaletteSource | undefined;
  @property({ attribute: false }) resolver: EditorResolver | undefined;
  @property() paletteId: string | undefined;

  @state() private _showAdvanced = false;
  @state() private _errors: Map<string, string> = new Map();

  override render(): TemplateResult {
    if (!this.source?.schema?.properties) {
      return html`<div class="palette"></div>`;
    }

    const fields = this._buildFieldEntries(this.source.schema);
    const hasAdvanced = fields.some(f => f.advanced);
    const visibleFields = this._showAdvanced ? fields : fields.filter(f => !f.advanced);

    const grouped = new Map<string, FieldEntry[]>();
    const ungrouped: FieldEntry[] = [];
    const groupOrder: string[] = [];

    for (const field of visibleFields) {
      if (field.group) {
        if (!grouped.has(field.group)) {
          grouped.set(field.group, []);
          groupOrder.push(field.group);
        }
        grouped.get(field.group)!.push(field);
      } else {
        ungrouped.push(field);
      }
    }

    return html`
      <div class="palette">
        ${hasAdvanced ? html`
          <label class="advanced-toggle">
            <input type="checkbox" .checked=${this._showAdvanced}
              @change=${(e: Event) => { this._showAdvanced = (e.target as HTMLInputElement).checked; }}
            />
            Show advanced
          </label>
        ` : nothing}
        ${ungrouped.length > 0 ? html`
          <div class="ungrouped-fields">
            ${ungrouped.map(f => this._renderField(f.key, f.schema, this._getValueAtPath([], f.key), [], this.source!.schema.required ?? []))}
          </div>
        ` : nothing}
        ${groupOrder.map(groupName => {
          const groupFields = grouped.get(groupName)!;
          const isOpen = this._isGroupOpen(groupName);
          return html`
            <details class="group" ?open=${isOpen}
              @toggle=${(e: Event) => this._onGroupToggle(groupName, (e.target as HTMLDetailsElement).open)}
            >
              <summary>${groupName}</summary>
              <div class="group-fields">
                ${groupFields.map(f => this._renderField(f.key, f.schema, this._getValueAtPath([], f.key), [], this.source!.schema.required ?? []))}
              </div>
            </details>
          `;
        })}
      </div>
    `;
  }

  private _buildFieldEntries(schema: FieldSchema): FieldEntry[] {
    const props = schema.properties ?? {};
    const entries: FieldEntry[] = [];

    for (const [key, fieldSchema] of Object.entries(props)) {
      entries.push({
        key,
        schema: fieldSchema,
        order: typeof fieldSchema['x-order'] === 'number' ? fieldSchema['x-order'] as number : Infinity,
        group: typeof fieldSchema['x-group'] === 'string' ? fieldSchema['x-group'] as string : undefined,
        advanced: fieldSchema['x-visibility'] === 'advanced',
      });
    }

    entries.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return 0;
    });

    return entries;
  }

  private _renderField(
    key: string,
    schema: FieldSchema,
    value: unknown,
    path: string[],
    requiredFields: readonly string[],
    depth = 0,
  ): TemplateResult {
    const isRequired = requiredFields.includes(key);
    const isReadonly = this.source?.readonly === true || schema.readOnly === true;
    const fieldPath = [...path, key].join('.');
    const error = this._errors.get(fieldPath);

    const descriptor = this._resolveField(schema);

    if (descriptor.kind === 'render' && schema.type === 'object' && schema.properties && depth < MAX_NESTING_DEPTH) {
      return this._renderNestedObject(key, schema, value as Record<string, unknown> | undefined, path, depth);
    }

    if (descriptor.kind === 'render' && schema.type === 'object' && depth >= MAX_NESTING_DEPTH) {
      return this._renderJsonFallback(key, schema, value);
    }

    if (descriptor.kind === 'render') {
      const ctx: FieldRenderContext = {
        key, schema, value, required: isRequired, readonly: isReadonly, error,
        onChange: (v) => this._handleChange([...path, key], v, schema, isRequired),
      };
      const label = schema.title ?? this._humanize(key);
      const helpText = schema['x-help'] as string | undefined;
      return html`
        <div class="field-wrapper">
          <div class="field-label">
            ${label}${isRequired ? html`<span class="required-indicator">*</span>` : nothing}
            ${helpText ? html`<span class="help-icon" title=${helpText}>?</span>` : nothing}
          </div>
          ${descriptor.render(ctx)}
        </div>
      `;
    }

    return this._renderTagEditor(key, schema, value, path, descriptor, isRequired, isReadonly, error);
  }

  private _renderTagEditor(
    key: string,
    schema: FieldSchema,
    value: unknown,
    path: string[],
    descriptor: { kind: 'tag'; tag: string; config?: Record<string, unknown> },
    required: boolean,
    readonly: boolean,
    error: string | undefined,
  ): TemplateResult {
    const tag = descriptor.tag;
    const label = schema.title ?? this._humanize(key);
    const placeholder = (schema['x-placeholder'] as string | undefined) ?? schema.placeholder;
    const helpText = schema['x-help'] as string | undefined;
    const isCheckbox = tag === 'pages-checkbox';

    const el = document.createElement(tag) as any;

    if (isCheckbox) {
      el.checked = Boolean(value);
      el.label = label;
    } else {
      el.value = value ?? (tag === 'pages-number-input' ? null : '');
    }

    el.readonly = readonly;
    el.error = error;

    if (required && !isCheckbox) el.required = required;
    if (placeholder) el.placeholder = placeholder;

    if (tag === 'pages-select' && schema.enum) {
      el.options = schema.enum.map((v: string) => ({ value: v, label: v }));
    }
    if (tag === 'pages-number-input' || tag === 'pages-slider') {
      if (schema.minimum != null) el.min = schema.minimum;
      if (schema.maximum != null) el.max = schema.maximum;
      if (schema.multipleOf != null) el.step = schema.multipleOf;
      else if (schema.type === 'integer') el.step = 1;
    }
    if (tag === 'pages-slider') {
      if (schema.minimum != null) el.min = schema.minimum;
      if (schema.maximum != null) el.max = schema.maximum;
    }
    if (tag === 'pages-date-input' || tag === 'pages-datetime-input') {
      if (schema.minimum != null) el.min = String(schema.minimum);
      if (schema.maximum != null) el.max = String(schema.maximum);
    }
    if (tag === 'pages-tag-editor') {
      if (schema.maxItems != null) el.maxItems = schema.maxItems;
      if (schema.uniqueItems) el.uniqueItems = true;
      el.value = Array.isArray(value) ? value : [];
    }
    if (descriptor.config) {
      for (const [k, v] of Object.entries(descriptor.config)) {
        el[k] = v;
      }
    }

    const fieldPath = [...path, key];
    el.addEventListener('change', () => {
      const newValue = isCheckbox ? el.checked : el.value;
      this._handleChange(fieldPath, newValue, schema, required);
    });

    return html`
      <div class="field-wrapper">
        ${!isCheckbox ? html`
          <div class="field-label">
            ${label}${required ? html`<span class="required-indicator">*</span>` : nothing}
            ${helpText ? html`<span class="help-icon" title=${helpText}>?</span>` : nothing}
          </div>
        ` : nothing}
        ${el}
      </div>
    `;
  }

  private _renderNestedObject(
    key: string,
    schema: FieldSchema,
    value: Record<string, unknown> | undefined,
    parentPath: string[],
    depth: number,
  ): TemplateResult {
    const nested = value ?? {};
    const nestedPath = [...parentPath, key];
    const label = schema.title ?? this._humanize(key);
    const nestedEntries = this._buildFieldEntries(schema);
    const visibleEntries = this._showAdvanced ? nestedEntries : nestedEntries.filter(f => !f.advanced);

    return html`
      <details class="group" open>
        <summary>${label}</summary>
        <div class="nested-group">
          ${visibleEntries.map(f =>
            this._renderField(f.key, f.schema, nested[f.key], nestedPath, schema.required ?? [], depth + 1)
          )}
        </div>
      </details>
    `;
  }

  private _renderJsonFallback(key: string, schema: FieldSchema, value: unknown): TemplateResult {
    const label = schema.title ?? this._humanize(key);
    return html`
      <div class="field-wrapper">
        <div class="field-label">${label}</div>
        <pre style="font-size: 11px; margin: 0; white-space: pre-wrap; color: var(--pages-neutral-11, #374151);">${JSON.stringify(value, null, 2) ?? '—'}</pre>
      </div>
    `;
  }

  private _resolveField(schema: FieldSchema): EditorDescriptor {
    if (this.resolver) {
      const custom = this.resolver(schema);
      if (custom) return custom;
    }
    return resolveEditor(schema);
  }

  private _handleChange(
    fieldPath: (string | number)[],
    value: unknown,
    schema: FieldSchema,
    required: boolean,
  ): void {
    const pathKey = fieldPath.join('.');
    const error = validateField(schema, value, required);
    if (error) {
      this._errors = new Map(this._errors).set(pathKey, error);
    } else {
      const next = new Map(this._errors);
      next.delete(pathKey);
      this._errors = next;
    }
    this.source?.onChange(fieldPath, value);
    this.requestUpdate();
  }

  private _getValueAtPath(path: string[], key: string): unknown {
    let obj: unknown = this.source?.data;
    for (const segment of path) {
      if (obj == null || typeof obj !== 'object') return undefined;
      obj = (obj as Record<string, unknown>)[segment];
    }
    if (obj == null || typeof obj !== 'object') return undefined;
    return (obj as Record<string, unknown>)[key];
  }

  private _isGroupOpen(groupName: string): boolean {
    if (!this.paletteId) return true;
    const stored = localStorage.getItem(`pages-palette-${this.paletteId}-${groupName}`);
    return stored !== 'closed';
  }

  private _onGroupToggle(groupName: string, open: boolean): void {
    if (!this.paletteId) return;
    localStorage.setItem(`pages-palette-${this.paletteId}-${groupName}`, open ? 'open' : 'closed');
  }

  private _humanize(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }
}

if (!customElements.get('pages-property-palette')) {
  customElements.define('pages-property-palette', PagesPropertyPalette);
}
