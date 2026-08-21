import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
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

  override connectedCallback(): void {
    this._conn = new ScenarioConnectionController(this, {
      connection: this.connection,
      eventTarget: this.eventTarget,
      baseUrl: this.baseUrl,
    });
    super.connectedCallback();
  }

  override render(): TemplateResult | typeof nothing {
    const content = this._conn?.state?.content;
    if (!content) return nothing;

    switch (content.type) {
      case 'inline':
        return this._renderMarkdown(content.markdown ?? '');
      case 'template':
        return html`<div class="narrative-content"><em>Loading template...</em></div>`;
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
