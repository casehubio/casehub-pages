import { LitElement, html, css } from 'lit';
import { applyTheme, getTheme, listThemes } from './runtime.js';

interface ThemeFamily {
  readonly name: string;
  readonly displayName: string;
  readonly hasLight: boolean;
  readonly hasDark: boolean;
}

function extractFamilies(themes: string[]): ThemeFamily[] {
  const familyMap = new Map<string, { hasLight: boolean; hasDark: boolean }>();
  for (const theme of themes) {
    const lightMatch = theme.match(/^(.+)-light$/);
    const darkMatch = theme.match(/^(.+)-dark$/);
    const family = lightMatch?.[1] ?? darkMatch?.[1] ?? theme;
    const entry = familyMap.get(family) ?? { hasLight: false, hasDark: false };
    if (lightMatch) entry.hasLight = true;
    if (darkMatch) entry.hasDark = true;
    if (!lightMatch && !darkMatch) { entry.hasLight = true; entry.hasDark = true; }
    familyMap.set(family, entry);
  }
  return [...familyMap.entries()].map(([name, v]) => ({
    name,
    displayName: name.split('-').map(w => w[0]!.toUpperCase() + w.slice(1)).join(' '),
    ...v,
  }));
}

function parseCurrentTheme(current: string): { family: string; mode: 'light' | 'dark' } {
  const lightMatch = current.match(/^(.+)-light$/);
  const darkMatch = current.match(/^(.+)-dark$/);
  return {
    family: lightMatch?.[1] ?? darkMatch?.[1] ?? current,
    mode: darkMatch ? 'dark' : 'light',
  };
}

export class PagesThemePickerElement extends LitElement {
  static override styles = css`
    :host { display: inline-flex; align-items: center; gap: 8px; }
    select {
      background: var(--pages-surface-secondary, #222);
      color: var(--pages-text-secondary, #ccc);
      border: 1px solid var(--pages-border-default, #444);
      border-radius: var(--pages-radius-sm, 4px);
      padding: 4px 8px;
      font: inherit;
    }
    .mode-toggle { display: inline-flex; gap: 0; }
    .mode-toggle button {
      background: var(--pages-surface-secondary, #222);
      color: var(--pages-text-secondary, #ccc);
      border: 1px solid var(--pages-border-default, #444);
      padding: 4px 12px;
      cursor: pointer;
      font: inherit;
    }
    .mode-toggle button:first-child { border-radius: var(--pages-radius-sm, 4px) 0 0 var(--pages-radius-sm, 4px); }
    .mode-toggle button:last-child { border-radius: 0 var(--pages-radius-sm, 4px) var(--pages-radius-sm, 4px) 0; border-left: none; }
    .mode-toggle button[aria-pressed="true"] {
      background: var(--pages-interactive, #4a9eff);
      color: var(--pages-surface-primary, #111);
    }
  `;

  static override properties = {
    target: { attribute: false },
    compact: { type: Boolean },
    _family: { state: true },
    _mode: { state: true },
    _families: { state: true },
  };

  declare target: HTMLElement;
  declare compact: boolean;
  declare _family: string;
  declare _mode: 'light' | 'dark';
  declare _families: ThemeFamily[];

  constructor() {
    super();
    this.target = document.documentElement;
    this.compact = false;
    this._family = '';
    this._mode = 'dark';
    this._families = [];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._families = extractFamilies(listThemes());
    const current = getTheme(this.target);
    if (current) {
      const parsed = parseCurrentTheme(current);
      this._family = parsed.family;
      this._mode = parsed.mode;
    } else if (this._families.length > 0) {
      this._family = this._families[0]!.name;
    }
  }

  override render() {
    if (this.compact) return this._renderCompact();
    return html`
      <select @change=${this._onFamilyChange}>
        ${this._families.map(f => html`
          <option value=${f.name} ?selected=${f.name === this._family}>${f.displayName}</option>
        `)}
      </select>
      <div class="mode-toggle">
        <button aria-pressed=${String(this._mode === 'light')} @click=${() => this._setMode('light')}>Light</button>
        <button aria-pressed=${String(this._mode === 'dark')} @click=${() => this._setMode('dark')}>Dark</button>
      </div>
    `;
  }

  private _renderCompact() {
    return html`
      <div class="mode-toggle">
        <button aria-pressed=${String(this._mode === 'light')} @click=${() => this._setMode('light')} title="Light mode">☀</button>
        <button aria-pressed=${String(this._mode === 'dark')} @click=${() => this._setMode('dark')} title="Dark mode">☾</button>
      </div>
    `;
  }

  private _onFamilyChange(e: Event): void {
    this._family = (e.target as HTMLSelectElement).value;
    this._apply();
  }

  private _setMode(mode: 'light' | 'dark'): void {
    this._mode = mode;
    this._apply();
  }

  private _apply(): void {
    const themeName = `${this._family}-${this._mode}`;
    const available = listThemes();
    if (available.includes(themeName)) {
      applyTheme(themeName, this.target);
    }
  }
}

customElements.define('pages-theme-picker', PagesThemePickerElement);
