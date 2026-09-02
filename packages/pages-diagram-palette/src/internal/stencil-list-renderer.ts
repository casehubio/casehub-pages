import { html, nothing, type TemplateResult } from 'lit';
import type { PaletteItem, IconRenderer, PaletteMode } from '../types.js';
import { filterItems, groupItems } from './search-filter.js';

export interface RenderOptions {
  collapsible: boolean;
  isGroupOpen?: (name: string) => boolean;
  onGroupToggle?: (name: string, open: boolean) => void;
  onSelect: (item: PaletteItem) => void;
  searchQuery: string;
  itemRole: 'button' | 'option';
  iconRenderer?: IconRenderer | undefined;
  mode?: PaletteMode | undefined;
}

function renderIcon(icon: string, renderer?: IconRenderer): TemplateResult {
  if (renderer) return renderer(icon);
  return html`<span class="palette-item-icon">${icon}</span>`;
}

function renderItem(
  item: PaletteItem,
  role: 'button' | 'option',
  onSelect: (item: PaletteItem) => void,
  iconRenderer?: IconRenderer,
  compact = false,
): TemplateResult {
  const handleClick = () => { onSelect(item); };
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(item);
    }
  };
  return compact
    ? html`
      <div class="palette-item compact"
        role=${role}
        aria-label=${item.label}
        title=${item.label}
        tabindex="-1"
        @click=${handleClick}
        @keydown=${handleKeydown}>
        ${renderIcon(item.icon, iconRenderer)}
      </div>`
    : html`
      <div class="palette-item"
        role=${role}
        aria-label=${item.label}
        tabindex="-1"
        @click=${handleClick}
        @keydown=${handleKeydown}>
        ${renderIcon(item.icon, iconRenderer)}
        <span class="palette-item-label">${item.label}</span>
      </div>`;
}

export function renderStencilList(
  items: readonly PaletteItem[],
  options: RenderOptions,
): TemplateResult {
  const filtered = filterItems(items, options.searchQuery);
  const compact = options.mode === 'compact';

  if (compact) {
    return html`
      <div class="compact-column">
        ${filtered.map(item => renderItem(item, options.itemRole, options.onSelect, options.iconRenderer, true))}
      </div>`;
  }

  const groups = groupItems(filtered);
  const searchActive = options.searchQuery.length > 0;

  const ungrouped = groups.get('');
  groups.delete('');

  const groupEntries = Array.from(groups.entries());

  return html`
    ${ungrouped && ungrouped.length > 0
      ? html`<div class="ungrouped-items">
          ${ungrouped.map(item => renderItem(item, options.itemRole, options.onSelect, options.iconRenderer))}
        </div>`
      : nothing}
    ${groupEntries.map(([name, items]) =>
      options.collapsible && !searchActive
        ? html`
            <details class="palette-group"
              ?open=${options.isGroupOpen?.(name) ?? true}
              @toggle=${(e: Event) => options.onGroupToggle?.(name, (e.target as HTMLDetailsElement).open)}>
              <summary>${name}</summary>
              <div class="palette-group-items">
                ${items.map(item => renderItem(item, options.itemRole, options.onSelect, options.iconRenderer))}
              </div>
            </details>`
        : html`
            <div class="palette-group" role="group" aria-label=${name}>
              <div class="palette-group-header">${name}</div>
              <div class="palette-group-items">
                ${items.map(item => renderItem(item, options.itemRole, options.onSelect, options.iconRenderer))}
              </div>
            </div>`,
    )}`;
}
