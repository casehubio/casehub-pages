import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { EventConnection } from '@casehubio/pages-data';
import { ScenarioConnectionController } from './scenario-connection-controller.js';

export class PagesScenarioNarrative extends LitElement {
  static override styles = css`
    :host { display: block; }
    .narrative-content {
      padding: var(--pages-space-4, 16px);
      max-width: 680px;
      line-height: 1.6;
      font-size: var(--pages-font-size-base, 14px);
      font-family: var(--pages-font-family, system-ui, sans-serif);
      color: var(--pages-neutral-12, #1a1a1a);
    }
    .narrative-content h1 { font-size: 1.5em; margin: 0.5em 0; font-weight: 600; }
    .narrative-content h2 { font-size: 1.25em; margin: 0.5em 0; font-weight: 600; }
    .narrative-content h3 { font-size: 1.1em; margin: 0.5em 0; font-weight: 600; }
    .narrative-content p { margin: 0.5em 0; }
    .narrative-content strong { font-weight: 600; }
    .narrative-content em { font-style: italic; }
    .narrative-content code {
      background: var(--pages-neutral-3, #f5f5f5);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .narrative-content ul { margin: 0.5em 0; padding-left: 1.5em; }
    .narrative-content li { margin: 0.25em 0; }
    .slide-ref {
      padding: var(--pages-space-4, 16px);
      color: var(--pages-neutral-8, #999);
      font-style: italic;
    }
  `;

  @property({ attribute: false }) connection?: EventConnection;
  @property({ attribute: false }) eventTarget?: EventTarget;
  @property() baseUrl?: string;

  private _conn!: ScenarioConnectionController;
  private _templateCache = new Map<string, string>();
  @state() private _templateContent: string | null = null;
  private _lastTemplatePath: string | null = null;

  override connectedCallback(): void {
    this._conn = new ScenarioConnectionController(this, {
      connection: this.connection,
      eventTarget: this.eventTarget,
      baseUrl: this.baseUrl,
      onState: () => this._onContentChange(),
    });
    super.connectedCallback();
  }

  private _onContentChange(): void {
    const content = this._conn?.state?.content;
    if (content?.type === 'template' && content.path) {
      const cacheKey = content.path;
      if (cacheKey !== this._lastTemplatePath) {
        this._lastTemplatePath = cacheKey;
        if (this._templateCache.has(cacheKey)) {
          this._templateContent = this._extractSection(this._templateCache.get(cacheKey)!, content.section);
        } else {
          this._templateContent = null;
          void this._fetchTemplate(content.path, content.section);
        }
      }
    } else {
      this._lastTemplatePath = null;
      this._templateContent = null;
    }
  }

  private async _fetchTemplate(path: string, section?: string): Promise<void> {
    try {
      const resp = await fetch(`${this._conn.restBase}/scenario/content?path=${encodeURIComponent(path)}`);
      if (resp.ok) {
        const text = await resp.text();
        this._templateCache.set(path, text);
        this._templateContent = this._extractSection(text, section);
      }
    } catch {
      // Ignore — show loading state
    }
  }

  private _extractSection(markdown: string, section?: string): string {
    if (!section) return markdown;
    const lines = markdown.split('\n');
    let capturing = false;
    let level = 0;
    const result: string[] = [];
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const headingLevel = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        if (capturing && headingLevel <= level) break;
        if (headingText.toLowerCase() === section.toLowerCase()) {
          capturing = true;
          level = headingLevel;
          continue;
        }
      }
      if (capturing) result.push(line);
    }
    return result.join('\n').trim();
  }

  override render(): TemplateResult | typeof nothing {
    const content = this._conn?.state?.content;
    if (!content) return nothing;

    switch (content.type) {
      case 'inline':
        return this._renderMarkdown(content.markdown ?? '');
      case 'template':
        if (this._templateContent !== null) {
          return this._renderMarkdown(this._templateContent);
        }
        return html`<div class="narrative-content"><em>Loading...</em></div>`;
      case 'slide':
        return html`<div class="slide-ref">Slide: ${String(content.ref)}</div>`;
      default:
        return nothing;
    }
  }

  private _renderMarkdown(md: string): TemplateResult {
    const escaped = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const rendered = escaped
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>');

    const container = document.createElement('div');
    container.className = 'narrative-content';
    container.innerHTML = rendered;
    return html`${container}`;
  }
}

if (!customElements.get('pages-scenario-narrative')) {
  customElements.define('pages-scenario-narrative', PagesScenarioNarrative);
}
