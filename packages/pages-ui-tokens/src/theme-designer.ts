import { LitElement, html, css, nothing } from 'lit';
import { registerTheme } from './runtime.js';
import { generateScale } from './colours.js';
import { initPresets } from './transforms/index.js';
import { runPipeline } from './pipeline.js';
import { generateCSS, generateDensityCSS } from './output.js';
import type { ThemeStorage } from './theme-storage.js';
import { detectStorage } from './theme-storage.js';
import type { PresetConfig, TransformDef } from './types.js';
import { DESIGNER_PRESETS, type DesignerPreset } from './designer-presets.js';
import { getBuiltinPreset, listBuiltinPresets } from './preset-loader.js';
import { listThemes, applyTheme, getTheme } from './runtime.js';

const SEMANTIC_GROUPS: { name: string; hueFn: (a: number, n: number) => number; chromaScale: number }[] = [
  { name: 'accent', hueFn: (a) => a, chromaScale: 1 },
  { name: 'neutral', hueFn: (_, n) => n, chromaScale: 0.15 },
  { name: 'success', hueFn: () => 145, chromaScale: 1 },
  { name: 'warning', hueFn: () => 55, chromaScale: 1 },
  { name: 'danger', hueFn: () => 25, chromaScale: 1 },
  { name: 'info', hueFn: () => 210, chromaScale: 1 },
];

export class PagesThemeDesignerElement extends LitElement {
  static override styles = css`
    :host { display: contents; }

    .designer-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: oklch(0% 0 0 / 0.6);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--pages-font-family, 'Inter', system-ui, sans-serif);
    }

    .designer-panel {
      background: var(--pages-neutral-2, #1a1a2e);
      color: var(--pages-neutral-12, #eee);
      border: 1px solid var(--pages-neutral-6, #444);
      border-radius: 12px;
      width: min(960px, 95vw); height: min(700px, 90vh);
      display: flex; flex-direction: column;
      box-shadow: 0 8px 32px oklch(0% 0 0 / 0.5);
    }

    .designer-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px; border-bottom: 1px solid var(--pages-neutral-4, #333);
    }

    .designer-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
    .header-spacer { flex: 1; }
    .header-theme-select {
      background: var(--pages-neutral-3, #222);
      color: var(--pages-neutral-12, #eee);
      border: 1px solid var(--pages-neutral-6, #444);
      border-radius: 4px; padding: 4px 8px; font: inherit; font-size: 12px;
    }

    .name-input {
      background: var(--pages-neutral-3, #222);
      color: var(--pages-neutral-12, #eee);
      border: 1px solid var(--pages-neutral-6, #444);
      border-radius: 4px; padding: 4px 8px; font: inherit; font-size: 13px;
      width: 160px;
    }

    .designer-body {
      display: flex; flex: 1; overflow: hidden;
    }

    .controls-panel {
      width: 320px; min-width: 280px;
      padding: 16px; overflow-y: auto;
      border-right: 1px solid var(--pages-neutral-4, #333);
      display: flex; flex-direction: column; gap: 16px;
    }

    .preview-panel {
      flex: 1; overflow-y: auto; padding: 20px;
    }

    .control-group { display: flex; flex-direction: column; gap: 6px; }
    .control-label {
      font-size: 11px; font-weight: 500; text-transform: uppercase;
      color: var(--pages-neutral-9, #888); letter-spacing: 0.5px;
    }
    .control-row { display: flex; align-items: center; gap: 8px; }
    .control-row input[type="range"] { flex: 1; accent-color: var(--pages-accent-9, #4a9eff); }
    .control-value { font-size: 12px; min-width: 40px; text-align: right; color: var(--pages-neutral-10, #aaa); }

    .hue-slider { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 4px; outline: none; }
    .hue-slider::-webkit-slider-thumb {
      -webkit-appearance: none; width: 16px; height: 16px;
      border-radius: 50%; border: 2px solid white; cursor: pointer;
    }

    .swatch-section { margin-bottom: 12px; }
    .swatch-label { font-size: 11px; font-weight: 500; color: var(--pages-neutral-9, #888); margin-bottom: 4px; text-transform: capitalize; }
    .swatch-row { display: flex; gap: 2px; }
    .swatch {
      width: 100%; aspect-ratio: 1; border-radius: 3px;
      display: flex; align-items: center; justify-content: center;
      font-size: 8px; color: white; text-shadow: 0 0 2px black;
    }

    .toolbar {
      display: flex; gap: 8px; padding: 12px 20px;
      border-top: 1px solid var(--pages-neutral-4, #333);
      align-items: center;
    }
    .toolbar-spacer { flex: 1; }

    button {
      background: var(--pages-neutral-4, #333);
      color: var(--pages-neutral-12, #eee);
      border: 1px solid var(--pages-neutral-6, #444);
      border-radius: 4px; padding: 6px 14px;
      cursor: pointer; font: inherit; font-size: 13px;
    }
    button:hover { background: var(--pages-neutral-5, #444); }
    button.primary {
      background: var(--pages-accent-9, #4a9eff);
      color: var(--pages-neutral-1, #111);
      border-color: var(--pages-accent-9, #4a9eff);
      font-weight: 500;
    }
    button.primary:hover { background: var(--pages-accent-10, #3a8eef); }

    .advanced-toggle {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; cursor: pointer; color: var(--pages-neutral-10, #aaa);
    }
    .advanced-toggle input { accent-color: var(--pages-accent-9, #4a9eff); }

    .theme-list { display: flex; flex-direction: column; gap: 2px; }
    .theme-list-item {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 8px; border-radius: 4px;
      font-size: 12px; color: var(--pages-neutral-11, #aaa);
    }
    .theme-list-item:hover { background: var(--pages-neutral-4, #333); }
    .theme-list-item .theme-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .theme-list-item .theme-tag {
      font-size: 9px; padding: 1px 4px; border-radius: 3px;
      background: var(--pages-neutral-5, #444); color: var(--pages-neutral-9, #888);
    }
    .theme-list-actions { display: flex; gap: 2px; margin-left: auto; }
    .theme-list-actions button {
      background: none; border: none; cursor: pointer;
      font-size: 11px; padding: 2px 6px; border-radius: 3px;
      color: var(--pages-neutral-10, #aaa);
    }
    .theme-list-actions button:hover { background: var(--pages-neutral-5, #444); color: var(--pages-neutral-12, #eee); }
    .theme-list-actions .delete-btn:hover { color: var(--pages-danger-9, #e44); }

    .preview-widgets { display: flex; flex-direction: column; gap: 16px; }

    .widget-section { display: flex; flex-direction: column; gap: 8px; }
    .widget-section-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      color: var(--pages-neutral-9, #888); letter-spacing: 0.5px;
    }

    .preview-card {
      background: var(--pages-neutral-2, #1a1a2e);
      border: 1px solid var(--pages-neutral-5, #444);
      border-radius: 8px; padding: 16px;
    }

    .preview-btn {
      padding: 6px 14px; border-radius: 4px;
      font-size: 13px; cursor: pointer; border: none;
    }
    .preview-btn-primary { background: var(--pages-accent-9); color: var(--pages-neutral-1); }
    .preview-btn-secondary { background: var(--pages-neutral-4); color: var(--pages-neutral-12); border: 1px solid var(--pages-neutral-6); }
    .preview-btn-danger { background: var(--pages-danger-9); color: white; }
    .preview-btn-success { background: var(--pages-success-9); color: white; }

    .preview-input {
      background: var(--pages-neutral-3); color: var(--pages-neutral-12);
      border: 1px solid var(--pages-neutral-6); border-radius: 4px;
      padding: 6px 10px; font: inherit; font-size: 13px; width: 200px;
    }
    .preview-input:focus { border-color: var(--pages-accent-8); outline: none; box-shadow: 0 0 0 2px var(--pages-accent-8 / 0.3); }

    .preview-badge {
      display: inline-flex; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 500;
    }
    .badge-success { background: var(--pages-success-3); color: var(--pages-success-11); }
    .badge-warning { background: var(--pages-warning-3); color: var(--pages-warning-11); }
    .badge-danger { background: var(--pages-danger-3); color: var(--pages-danger-11); }
    .badge-info { background: var(--pages-info-3); color: var(--pages-info-11); }

    .preview-text-primary { color: var(--pages-neutral-12); }
    .preview-text-secondary { color: var(--pages-neutral-11); }
    .preview-text-muted { color: var(--pages-neutral-8); }

    .preview-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .preview-table th {
      text-align: left; padding: 6px 10px; font-weight: 500;
      border-bottom: 1px solid var(--pages-neutral-6);
      color: var(--pages-neutral-11);
    }
    .preview-table td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--pages-neutral-4);
      color: var(--pages-neutral-12);
    }
    .preview-table tr:hover td { background: var(--pages-neutral-3); }

    .preview-progress {
      width: 100%; height: 6px; border-radius: 3px;
      background: var(--pages-neutral-4); overflow: hidden;
    }
    .preview-progress-fill {
      height: 100%; border-radius: 3px; transition: width 0.3s;
    }

    .preview-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

    .pipeline-editor { display: flex; flex-direction: column; gap: 8px; }
    .pipeline-stage {
      background: var(--pages-neutral-3, #222);
      border: 1px solid var(--pages-neutral-5, #444);
      border-radius: 8px; padding: 12px;
    }
    .pipeline-stage-header {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 600;
    }
    .pipeline-stage-name {
      flex: 1; color: var(--pages-accent-10, #8ec8ff);
    }
    .pipeline-stage-header button {
      padding: 2px 8px; font-size: 11px;
      background: var(--pages-neutral-4, #333);
      border: 1px solid var(--pages-neutral-5, #444);
      border-radius: 3px; color: var(--pages-neutral-10, #aaa);
      cursor: pointer;
    }
    .pipeline-stage-header button:hover {
      background: var(--pages-neutral-5, #444);
      color: var(--pages-neutral-12, #eee);
    }
    .pipeline-stage-params { margin-top: 8px; position: relative; }
    .code-editor-wrap {
      position: relative;
      border: 1px solid var(--pages-neutral-5, #444);
      border-radius: 6px;
      overflow: hidden;
      background: var(--pages-neutral-2, #181825);
    }
    .code-editor-wrap:focus-within {
      border-color: var(--pages-accent-8, #4a9eff);
      box-shadow: 0 0 0 2px oklch(60% 0.15 245 / 0.2);
    }
    .code-highlight, .code-textarea {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 12px; line-height: 1.5;
      padding: 10px 12px;
      white-space: pre-wrap;
      word-wrap: break-word;
      tab-size: 2;
    }
    .code-highlight {
      position: absolute; inset: 0;
      pointer-events: none;
      overflow: hidden;
      color: transparent;
    }
    .code-textarea {
      position: relative;
      width: 100%; min-height: 140px;
      background: transparent;
      color: oklch(85% 0 0 / 0.5);
      caret-color: var(--pages-accent-9, #4a9eff);
      border: none; outline: none;
      resize: vertical;
    }
    .json-key { color: oklch(75% 0.12 210); }
    .json-string { color: oklch(70% 0.14 145); }
    .json-number { color: oklch(75% 0.14 55); }
    .json-bool { color: oklch(70% 0.12 310); }
    .json-null { color: oklch(60% 0.08 260); }
    .json-bracket { color: oklch(65% 0 0); }
    .json-colon { color: oklch(55% 0 0); }
    .json-comma { color: oklch(55% 0 0); }
    .add-stage-btn { align-self: flex-start; }

    input[type="file"] { display: none; }

    .collapsible-header {
      display: flex; align-items: center; gap: 4px; cursor: pointer;
      user-select: none;
    }
    .collapsible-header .toggle-arrow {
      font-size: 10px; transition: transform 0.15s; color: var(--pages-neutral-8, #666);
    }
    .collapsible-header .toggle-arrow.open { transform: rotate(90deg); }

    .preset-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
    }
    .preset-chip {
      background: var(--pages-neutral-3, #222);
      border: 1px solid var(--pages-neutral-5, #444);
      border-radius: 4px; padding: 4px 6px;
      cursor: pointer; font-size: 10px; text-align: center;
      color: var(--pages-neutral-11, #aaa);
      display: flex; align-items: center; gap: 4px;
      white-space: nowrap; overflow: hidden;
    }
    .preset-chip:hover { background: var(--pages-neutral-4, #333); border-color: var(--pages-neutral-7, #666); }
    .preset-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    }
  `;

  static override properties = {
    open: { type: Boolean, reflect: true },
    target: { attribute: false },
    storage: { attribute: false },
    preset: { attribute: false },
    _accentHue: { state: true },
    _neutralHue: { state: true },
    _chroma: { state: true },
    _contrast: { state: true },
    _themeName: { state: true },
    _advancedMode: { state: true },
    _pipeline: { state: true },
    _savedThemes: { state: true },
    _previewMode: { state: true },
    _presetsOpen: { state: true },
    _controlsOpen: { state: true },
    _swatchesOpen: { state: true },
    _existingOpen: { state: true },
  };

  declare open: boolean;
  declare target: HTMLElement;
  declare storage: ThemeStorage | undefined;
  declare preset: PresetConfig | undefined;
  declare _accentHue: number;
  declare _neutralHue: number;
  declare _chroma: number;
  declare _contrast: number;
  declare _themeName: string;
  declare _advancedMode: boolean;
  declare _pipeline: TransformDef[];
  declare _savedThemes: string[];
  declare _previewMode: 'light' | 'dark';
  declare _presetsOpen: boolean;
  declare _controlsOpen: boolean;
  declare _swatchesOpen: boolean;
  declare _existingOpen: boolean;

  private _resolvedStorage: ThemeStorage | undefined;
  private _previewStyleEl: HTMLStyleElement | null = null;

  constructor() {
    super();
    this.open = false;
    this.target = document.documentElement;
    this._accentHue = 245;
    this._neutralHue = 220;
    this._chroma = 0.12;
    this._contrast = 0.5;
    this._themeName = 'custom';
    this._advancedMode = false;
    this._pipeline = [];
    this._savedThemes = [];
    this._previewMode = 'dark';
    this._presetsOpen = true;
    this._controlsOpen = true;
    this._swatchesOpen = true;
    this._existingOpen = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._initStorage();
    document.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
    this._removePreviewStyle();
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) this._onClose();
  };

  private async _initStorage(): Promise<void> {
    this._resolvedStorage = this.storage ?? await detectStorage();
    await this._loadSavedList();
  }

  private async _loadSavedList(): Promise<void> {
    if (!this._resolvedStorage) return;
    this._savedThemes = await this._resolvedStorage.list();
  }

  private _buildPresetConfig(mode: 'light' | 'dark'): PresetConfig {
    if (this._advancedMode && this._pipeline.length > 0) {
      return {
        $name: `${this._themeName}-${mode}`,
        pipeline: [
          { transform: mode === 'dark' ? 'dark-mode' : 'light-mode' },
          ...this._pipeline,
        ],
      };
    }
    return {
      $name: `${this._themeName}-${mode}`,
      pipeline: [
        { transform: mode === 'dark' ? 'dark-mode' : 'light-mode' },
        { transform: 'oklch-scale', params: {
          hues: { accent: this._accentHue, neutral: this._neutralHue },
          chroma: this._chroma, contrast: this._contrast,
        }},
        { transform: 'semantic-map' },
        { transform: 'gamut-clamp' },
      ],
    };
  }

  private _generatePreviewCSS(): string {
    initPresets();
    const config = this._buildPresetConfig(this._previewMode);
    try {
      const tokens = runPipeline(config);
      return generateCSS(tokens, config.$name) + '\n\n' + generateDensityCSS();
    } catch {
      return '';
    }
  }

  private _applyPreview(): void {
    const css = this._generatePreviewCSS();
    if (!css) return;
    const themeName = `${this._themeName}-${this._previewMode}`;
    const previewPanel = this.shadowRoot?.querySelector('.preview-panel') as HTMLElement | null;
    if (!previewPanel) return;

    if (!this._previewStyleEl) {
      this._previewStyleEl = document.createElement('style');
      this.shadowRoot?.prepend(this._previewStyleEl);
    }
    this._previewStyleEl.textContent = css;
    previewPanel.className = `preview-panel pages-theme-${themeName}`;
  }

  private _removePreviewStyle(): void {
    this._previewStyleEl?.remove();
    this._previewStyleEl = null;
  }

  override updated(changed: Map<string, unknown>): void {
    const sliderProps = ['_accentHue', '_neutralHue', '_chroma', '_contrast', '_previewMode', '_pipeline'];
    if (sliderProps.some(p => changed.has(p)) && this.open) {
      this._applyPreview();
    }
    if (changed.has('open') && this.open) {
      this._syncPipelineFromSimple();
      requestAnimationFrame(() => this._applyPreview());
    }
  }

  private _syncPipelineFromSimple(): void {
    if (!this._advancedMode) {
      this._pipeline = [
        { transform: 'oklch-scale', params: {
          hues: { accent: this._accentHue, neutral: this._neutralHue },
          chroma: this._chroma, contrast: this._contrast,
        }},
        { transform: 'semantic-map' },
        { transform: 'gamut-clamp' },
      ];
    }
  }

  private _applyDesignerPreset(preset: DesignerPreset): void {
    this._accentHue = preset.accentHue;
    this._neutralHue = preset.neutralHue;
    this._chroma = preset.chroma;
    this._contrast = preset.contrast;
  }

  private _generateSwatches(isDark: boolean): { name: string; colors: string[] }[] {
    return SEMANTIC_GROUPS.map(g => {
      const hue = g.hueFn(this._accentHue, this._neutralHue);
      const chromaVal = this._chroma * g.chromaScale;
      const scale = generateScale(hue, chromaVal, this._contrast, isDark);
      return { name: g.name, colors: Object.values(scale) };
    });
  }

  async _onSave(): Promise<void> {
    if (!this._themeName.trim()) return;
    initPresets();
    const isNew = !this._savedThemes.includes(this._themeName);

    for (const mode of ['light', 'dark'] as const) {
      const config = this._buildPresetConfig(mode);
      try {
        const tokens = runPipeline(config);
        const themeCss = generateCSS(tokens, config.$name) + '\n\n' + generateDensityCSS();
        registerTheme(config.$name, themeCss);
        await this._resolvedStorage?.save(config.$name, config);
      } catch { /* invalid pipeline */ }
    }

    await this._loadSavedList();
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent(isNew ? 'pages-theme-created' : 'pages-theme-updated', {
      bubbles: true,
      detail: { name: this._themeName, config: this._buildPresetConfig(this._previewMode) },
    }));
  }

  async _onLoad(name: string): Promise<void> {
    if (!this._resolvedStorage) return;
    const baseName = name.replace(/-(?:light|dark)$/, '');
    const darkName = `${baseName}-dark`;
    const lightName = `${baseName}-light`;
    const config = await this._resolvedStorage.load(darkName) ?? await this._resolvedStorage.load(lightName);
    if (!config) return;

    this._themeName = baseName;
    const modeTransforms = config.pipeline.filter(t => t.transform !== 'dark-mode' && t.transform !== 'light-mode');
    this._pipeline = [...modeTransforms];

    const oklchStage = config.pipeline.find(t => t.transform === 'oklch-scale');
    if (oklchStage?.params) {
      const hues = oklchStage.params['hues'] as Record<string, number> | undefined;
      if (hues) {
        this._accentHue = hues['accent'] ?? this._accentHue;
        this._neutralHue = hues['neutral'] ?? this._neutralHue;
      }
      this._chroma = (oklchStage.params['chroma'] as number) ?? this._chroma;
      this._contrast = (oklchStage.params['contrast'] as number) ?? this._contrast;
    }
  }

  async _onDelete(name: string): Promise<void> {
    if (!this._resolvedStorage) return;
    await this._resolvedStorage.remove(name);
    await this._loadSavedList();
    this.dispatchEvent(new CustomEvent('pages-theme-deleted', { bubbles: true, detail: { name } }));
  }

  _onImport(): void {
    const input = this.shadowRoot?.querySelector('#import-file') as HTMLInputElement;
    input?.click();
  }

  _onImportFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const config = JSON.parse(reader.result as string) as PresetConfig;
        this._themeName = config.$name.replace(/-(?:light|dark)$/, '');
        const modeTransforms = config.pipeline.filter(t => t.transform !== 'dark-mode' && t.transform !== 'light-mode');
        this._pipeline = [...modeTransforms];
        const oklchStage = config.pipeline.find(t => t.transform === 'oklch-scale');
        if (oklchStage?.params) {
          const hues = oklchStage.params['hues'] as Record<string, number> | undefined;
          if (hues) {
            this._accentHue = hues['accent'] ?? this._accentHue;
            this._neutralHue = hues['neutral'] ?? this._neutralHue;
          }
          this._chroma = (oklchStage.params['chroma'] as number) ?? this._chroma;
          this._contrast = (oklchStage.params['contrast'] as number) ?? this._contrast;
        }
      } catch { /* invalid JSON */ }
    };
    reader.readAsText(file);
  }

  _onExport(): void {
    const config = this._buildPresetConfig(this._previewMode);
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this._themeName}.theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _onClose(): void {
    this.open = false;
    this._removePreviewStyle();
    this.dispatchEvent(new CustomEvent('pages-designer-closed', { bubbles: true }));
  }

  override render() {
    if (!this.open) return nothing;
    const swatches = this._generateSwatches(this._previewMode === 'dark');
    return html`
      <div class="designer-overlay" @click=${(e: Event) => { if ((e.target as HTMLElement).classList.contains('designer-overlay')) this._onClose(); }}>
        <div class="designer-panel">
          <div class="designer-header">
            <h2>Theme Designer</h2>
            <select class="header-theme-select" @change=${(e: Event) => {
              const name = (e.target as HTMLSelectElement).value;
              if (name) applyTheme(name, this.target);
            }}>
              ${this._deduplicateFamilies(listThemes()).map(fam => html`
                <option value="${fam}-${this._previewMode}"
                  ?selected=${getTheme(this.target)?.replace(/-(?:light|dark)$/, '') === fam}>${fam}</option>
              `)}
            </select>
            <div class="header-spacer"></div>
            <input class="name-input" type="text" placeholder="Theme name"
              .value=${this._themeName}
              @input=${(e: Event) => { this._themeName = (e.target as HTMLInputElement).value; }} />
            <div class="preview-row">
              <button ?disabled=${this._previewMode === 'light'} @click=${() => { this._previewMode = 'light'; }}>Light</button>
              <button ?disabled=${this._previewMode === 'dark'} @click=${() => { this._previewMode = 'dark'; }}>Dark</button>
            </div>
          </div>

          <div class="designer-body">
            <div class="controls-panel">
              ${this._advancedMode ? this._renderPipelineEditor() : this._renderSimpleControls(swatches)}

              ${this._renderThemeList()}

              <label class="advanced-toggle">
                <input type="checkbox" .checked=${this._advancedMode}
                  @change=${(e: Event) => { this._advancedMode = (e.target as HTMLInputElement).checked; }} />
                Advanced (pipeline editor)
              </label>
            </div>

            <div class="preview-panel">
              ${this._renderWidgetPreview()}
            </div>
          </div>

          <div class="toolbar">
            <button @click=${() => { this._onImport(); }}>Import</button>
            <input id="import-file" type="file" accept=".json" @change=${(e: Event) => { this._onImportFile(e); }} />
            <button @click=${() => { this._onExport(); }}>Export</button>
            <div class="toolbar-spacer"></div>
            <button @click=${() => { this._onClose(); }}>Close</button>
            <button class="primary" @click=${() => { this._onSave(); }}>Save</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderSimpleControls(swatches: { name: string; colors: string[] }[]) {
    return html`
      <div class="simple-controls">
        <div class="control-group">
          <div class="collapsible-header control-label" @click=${() => { this._presetsOpen = !this._presetsOpen; }}>
            <span class="toggle-arrow ${this._presetsOpen ? 'open' : ''}">▶</span>
            Starting Point
          </div>
          ${this._presetsOpen ? html`
            <div class="preset-grid">
              ${DESIGNER_PRESETS.map(p => html`
                <button class="preset-chip" @click=${() => { this._applyDesignerPreset(p); }}
                  title="${p.name}: hue ${p.accentHue}°, chroma ${p.chroma}">
                  <span class="preset-dot" style="background: oklch(55% ${Math.max(p.chroma, 0.02)} ${p.accentHue})"></span>
                  ${p.name}
                </button>
              `)}
            </div>
          ` : nothing}
        </div>

        <div class="control-group">
          <div class="collapsible-header control-label" @click=${() => { this._controlsOpen = !this._controlsOpen; }}>
            <span class="toggle-arrow ${this._controlsOpen ? 'open' : ''}">▶</span>
            Controls
          </div>
          ${this._controlsOpen ? html`
            <div class="control-group">
              <div class="control-label" style="font-size:10px">Accent Hue</div>
              <div class="control-row">
                <input type="range" min="0" max="360" step="1" .value=${String(this._accentHue)}
                  style="background: linear-gradient(to right, hsl(0,80%,50%),hsl(60,80%,50%),hsl(120,80%,50%),hsl(180,80%,50%),hsl(240,80%,50%),hsl(300,80%,50%),hsl(360,80%,50%))"
                  class="hue-slider"
                  @input=${(e: Event) => { this._accentHue = Number((e.target as HTMLInputElement).value); }} />
                <span class="control-value">${this._accentHue}°</span>
              </div>
            </div>

            <div class="control-group">
              <div class="control-label" style="font-size:10px">Neutral Hue</div>
              <div class="control-row">
                <input type="range" min="0" max="360" step="1" .value=${String(this._neutralHue)}
                  style="background: linear-gradient(to right, hsl(0,20%,50%),hsl(60,20%,50%),hsl(120,20%,50%),hsl(180,20%,50%),hsl(240,20%,50%),hsl(300,20%,50%),hsl(360,20%,50%))"
                  class="hue-slider"
                  @input=${(e: Event) => { this._neutralHue = Number((e.target as HTMLInputElement).value); }} />
                <span class="control-value">${this._neutralHue}°</span>
              </div>
            </div>

            <div class="control-group">
              <div class="control-label" style="font-size:10px">Chroma</div>
              <div class="control-row">
                <input type="range" min="0" max="0.4" step="0.01" .value=${String(this._chroma)}
                  @input=${(e: Event) => { this._chroma = Number((e.target as HTMLInputElement).value); }} />
                <span class="control-value">${this._chroma.toFixed(2)}</span>
              </div>
            </div>

            <div class="control-group">
              <div class="control-label" style="font-size:10px">Contrast</div>
              <div class="control-row">
                <input type="range" min="0" max="1" step="0.01" .value=${String(this._contrast)}
                  @input=${(e: Event) => { this._contrast = Number((e.target as HTMLInputElement).value); }} />
                <span class="control-value">${this._contrast.toFixed(2)}</span>
              </div>
            </div>
          ` : nothing}
        </div>

        <div class="control-group">
          <div class="collapsible-header control-label" @click=${() => { this._swatchesOpen = !this._swatchesOpen; }}>
            <span class="toggle-arrow ${this._swatchesOpen ? 'open' : ''}">▶</span>
            Colour Scales
          </div>
          ${this._swatchesOpen ? html`
            ${swatches.map(s => html`
              <div class="swatch-section">
                <div class="swatch-label">${s.name}</div>
                <div class="swatch-row">
                  ${s.colors.map((c, i) => html`
                    <div class="swatch" style="background:${c}" title="${s.name}-${i + 1}">${i + 1}</div>
                  `)}
                </div>
              </div>
            `)}
          ` : nothing}
        </div>
      </div>
    `;
  }

  private _renderPipelineEditor() {
    return html`
      <div class="pipeline-editor">
        <div class="control-label">Pipeline Stages</div>
        ${this._pipeline.map((stage, i) => {
          const json = stage.params ? JSON.stringify(stage.params, null, 2) : '';
          return html`
            <div class="pipeline-stage">
              <div class="pipeline-stage-header">
                <span class="pipeline-stage-name">${stage.transform}</span>
                <button @click=${() => { this._movePipelineStage(i, -1); }} ?disabled=${i === 0} title="Move up">↑</button>
                <button @click=${() => { this._movePipelineStage(i, 1); }} ?disabled=${i === this._pipeline.length - 1} title="Move down">↓</button>
                <button @click=${() => { this._removePipelineStage(i); }} title="Remove">✕</button>
              </div>
              ${json ? html`
                <div class="pipeline-stage-params">
                  <div class="code-editor-wrap">
                    <div class="code-highlight" .innerHTML=${this._highlightJSON(json) + '\n'}></div>
                    <textarea class="code-textarea" .value=${json}
                      @input=${(e: Event) => {
                        const ta = e.target as HTMLTextAreaElement;
                        const highlight = ta.previousElementSibling as HTMLElement;
                        if (highlight) highlight.innerHTML = this._highlightJSON(ta.value) + '\n';
                      }}
                      @change=${(e: Event) => { this._updateStageParams(i, (e.target as HTMLTextAreaElement).value); }}
                      @scroll=${(e: Event) => {
                        const ta = e.target as HTMLTextAreaElement;
                        const highlight = ta.previousElementSibling as HTMLElement;
                        if (highlight) { highlight.scrollTop = ta.scrollTop; highlight.scrollLeft = ta.scrollLeft; }
                      }}></textarea>
                  </div>
                </div>
              ` : nothing}
            </div>
          `;
        })}
        <button class="add-stage-btn" @click=${() => { this._addPipelineStage(); }}>+ Add Stage</button>
      </div>
    `;
  }

  private _renderWidgetPreview() {
    return html`
      <div class="preview-widgets">
        <div class="widget-section">
          <div class="widget-section-title">Typography</div>
          <p class="preview-text-primary" style="font-size:16px;margin:0">Primary text — the main content colour</p>
          <p class="preview-text-secondary" style="font-size:14px;margin:0">Secondary text — supporting information</p>
          <p class="preview-text-muted" style="font-size:12px;margin:0">Muted text — hints and placeholders</p>
        </div>

        <div class="widget-section">
          <div class="widget-section-title">Buttons</div>
          <div class="preview-row">
            <button class="preview-btn preview-btn-primary">Primary</button>
            <button class="preview-btn preview-btn-secondary">Secondary</button>
            <button class="preview-btn preview-btn-danger">Danger</button>
            <button class="preview-btn preview-btn-success">Success</button>
          </div>
        </div>

        <div class="widget-section">
          <div class="widget-section-title">Inputs</div>
          <div class="preview-row">
            <input class="preview-input" type="text" placeholder="Text input..." />
          </div>
        </div>

        <div class="widget-section">
          <div class="widget-section-title">Badges</div>
          <div class="preview-row">
            <span class="preview-badge badge-success">Success</span>
            <span class="preview-badge badge-warning">Warning</span>
            <span class="preview-badge badge-danger">Error</span>
            <span class="preview-badge badge-info">Info</span>
          </div>
        </div>

        <div class="widget-section">
          <div class="widget-section-title">Cards</div>
          <div class="preview-card">
            <p style="margin:0 0 8px;font-weight:500;color:var(--pages-neutral-12)">Card Title</p>
            <p style="margin:0 0 12px;font-size:13px;color:var(--pages-neutral-11)">Card content with secondary text showing how surfaces and borders look together.</p>
            <div class="preview-row">
              <button class="preview-btn preview-btn-primary" style="font-size:12px;padding:4px 10px">Action</button>
              <button class="preview-btn preview-btn-secondary" style="font-size:12px;padding:4px 10px">Cancel</button>
            </div>
          </div>
        </div>

        <div class="widget-section">
          <div class="widget-section-title">Progress</div>
          <div class="preview-progress">
            <div class="preview-progress-fill" style="width:65%;background:var(--pages-accent-9)"></div>
          </div>
          <div class="preview-row" style="margin-top:4px">
            <div class="preview-progress" style="flex:1">
              <div class="preview-progress-fill" style="width:100%;background:var(--pages-success-9)"></div>
            </div>
            <div class="preview-progress" style="flex:1">
              <div class="preview-progress-fill" style="width:40%;background:var(--pages-warning-9)"></div>
            </div>
            <div class="preview-progress" style="flex:1">
              <div class="preview-progress-fill" style="width:20%;background:var(--pages-danger-9)"></div>
            </div>
          </div>
        </div>

        <div class="widget-section">
          <div class="widget-section-title">Table</div>
          <table class="preview-table">
            <thead><tr><th>Name</th><th>Status</th><th>Score</th></tr></thead>
            <tbody>
              <tr><td>Alpha</td><td><span class="preview-badge badge-success">Active</span></td><td>92</td></tr>
              <tr><td>Beta</td><td><span class="preview-badge badge-warning">Pending</span></td><td>67</td></tr>
              <tr><td>Gamma</td><td><span class="preview-badge badge-danger">Failed</span></td><td>23</td></tr>
              <tr><td>Delta</td><td><span class="preview-badge badge-info">Review</span></td><td>85</td></tr>
            </tbody>
          </table>
        </div>

        <div class="widget-section">
          <div class="widget-section-title">Surfaces & Borders</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
            <div style="background:var(--pages-neutral-1);border:1px solid var(--pages-neutral-4);border-radius:6px;padding:12px;text-align:center;font-size:11px;color:var(--pages-neutral-11)">Surface 1</div>
            <div style="background:var(--pages-neutral-2);border:1px solid var(--pages-neutral-5);border-radius:6px;padding:12px;text-align:center;font-size:11px;color:var(--pages-neutral-11)">Surface 2</div>
            <div style="background:var(--pages-neutral-3);border:1px solid var(--pages-neutral-6);border-radius:6px;padding:12px;text-align:center;font-size:11px;color:var(--pages-neutral-11)">Surface 3</div>
            <div style="background:var(--pages-neutral-4);border:1px solid var(--pages-neutral-7);border-radius:6px;padding:12px;text-align:center;font-size:11px;color:var(--pages-neutral-11)">Surface 4</div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderThemeList() {
    const builtinFamilies = this._deduplicateFamilies(listBuiltinPresets());
    const customFamilies = this._deduplicateFamilies(this._savedThemes);
    const allFamilies = [...new Set([...builtinFamilies, ...customFamilies])].sort();
    if (allFamilies.length === 0) return nothing;

    return html`
      <div class="control-group">
        <div class="collapsible-header control-label" @click=${() => { this._existingOpen = !this._existingOpen; }}>
          <span class="toggle-arrow ${this._existingOpen ? 'open' : ''}">▶</span>
          Existing Themes
        </div>
        ${this._existingOpen ? html`<div class="theme-list">
          ${allFamilies.map(name => {
            const isBuiltin = builtinFamilies.includes(name);
            const isCustom = customFamilies.includes(name);
            return html`
              <div class="theme-list-item">
                <span class="theme-name">${name}</span>
                ${isBuiltin ? html`<span class="theme-tag">builtin</span>` : nothing}
                <div class="theme-list-actions">
                  <button title="Edit" @click=${() => { this._onEditTheme(name, isBuiltin); }}>✎</button>
                  <button title="Duplicate as new" @click=${() => { this._onDuplicateTheme(name, isBuiltin); }}>⧉</button>
                  ${isCustom ? html`<button class="delete-btn" title="Delete" @click=${() => { this._onDelete(name); }}>✕</button>` : nothing}
                </div>
              </div>
            `;
          })}
        </div>` : nothing}
      </div>
    `;
  }

  private async _onEditTheme(name: string, isBuiltin: boolean): Promise<void> {
    if (isBuiltin) {
      const config = getBuiltinPreset(`${name}-dark`) ?? getBuiltinPreset(`${name}-light`) ?? getBuiltinPreset(name);
      if (!config) return;
      this._loadFromPresetConfig(config, name);
    } else {
      await this._onLoad(name);
    }
  }

  private async _onDuplicateTheme(name: string, isBuiltin: boolean): Promise<void> {
    if (isBuiltin) {
      const config = getBuiltinPreset(`${name}-dark`) ?? getBuiltinPreset(`${name}-light`) ?? getBuiltinPreset(name);
      if (!config) return;
      this._loadFromPresetConfig(config, `${name}-copy`);
    } else {
      await this._onLoad(name);
      this._themeName = `${name}-copy`;
    }
  }

  private _loadFromPresetConfig(config: PresetConfig, themeName: string): void {
    this._themeName = themeName;
    const modeTransforms = config.pipeline.filter(t => t.transform !== 'dark-mode' && t.transform !== 'light-mode');
    this._pipeline = [...modeTransforms];

    const oklchStage = config.pipeline.find(t => t.transform === 'oklch-scale');
    if (oklchStage?.params) {
      const hues = oklchStage.params['hues'] as Record<string, number | number[]> | undefined;
      if (hues) {
        const accent = hues['accent'];
        this._accentHue = Array.isArray(accent) ? accent[0]! : (accent ?? this._accentHue);
        const neutral = hues['neutral'];
        this._neutralHue = Array.isArray(neutral) ? neutral[0]! : (neutral ?? this._neutralHue);
      }
      this._chroma = (oklchStage.params['chroma'] as number) ?? this._chroma;
      this._contrast = (oklchStage.params['contrast'] as number) ?? this._contrast;
    }
  }

  private _deduplicateFamilies(names: string[]): string[] {
    const families = new Set<string>();
    for (const name of names) {
      families.add(name.replace(/-(?:light|dark)$/, ''));
    }
    return [...families].sort();
  }

  private _movePipelineStage(index: number, direction: number): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this._pipeline.length) return;
    const pipeline = [...this._pipeline];
    [pipeline[index], pipeline[newIndex]] = [pipeline[newIndex]!, pipeline[index]!];
    this._pipeline = pipeline;
  }

  private _removePipelineStage(index: number): void {
    this._pipeline = this._pipeline.filter((_, i) => i !== index);
  }

  private _addPipelineStage(): void {
    this._pipeline = [...this._pipeline, { transform: 'oklch-scale', params: { hues: { accent: this._accentHue }, chroma: 0.12 } }];
  }

  private _updateStageParams(index: number, json: string): void {
    try {
      const params = JSON.parse(json);
      const pipeline = [...this._pipeline];
      pipeline[index] = { ...pipeline[index]!, params };
      this._pipeline = pipeline;
    } catch { /* invalid JSON, ignore */ }
  }

  private _highlightJSON(json: string): string {
    return json.replace(
      /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\]])|([,])|(:)/g,
      (_match, key, colonAfterKey, str, num, bool, nul, bracket, comma, colon) => {
        if (key) return `<span class="json-key">${key}</span><span class="json-colon">${colonAfterKey}</span>`;
        if (str) return `<span class="json-string">${str}</span>`;
        if (num) return `<span class="json-number">${num}</span>`;
        if (bool) return `<span class="json-bool">${bool}</span>`;
        if (nul) return `<span class="json-null">${nul}</span>`;
        if (bracket) return `<span class="json-bracket">${bracket}</span>`;
        if (comma) return `<span class="json-comma">${comma}</span>`;
        if (colon) return `<span class="json-colon">${colon}</span>`;
        return _match;
      }
    );
  }
}

customElements.define('pages-theme-designer', PagesThemeDesignerElement);
