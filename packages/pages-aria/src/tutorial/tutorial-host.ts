import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { TutorialDescriptor, LearningPath } from './types.js';
import type { SectionedScenario } from '../scenario/types.js';
import { parseScenario, isSectioned } from '../scenario/types.js';
import { parseScenario as parse } from '../scenario/parser.js';
import { runSectionedScenario, type TutorialRunner } from '../scenario/sectioned-runner.js';
import './tutorial-catalog.js';
import '../controller/scenario-controller.js';
import '../controller/scenario-narrative.js';

export class PagesTutorialHost extends LitElement {
  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui, sans-serif); }
    .back-btn {
      background: none; border: 1px solid var(--pages-neutral-5, #d4d4d4);
      border-radius: var(--pages-radius-sm, 4px); padding: 6px 14px;
      cursor: pointer; color: var(--pages-neutral-9, #737373); font-size: 13px;
      margin-bottom: 16px;
    }
    .back-btn:hover { background: var(--pages-neutral-3, #f5f5f5); }
    .tutorial-layout {
      display: flex; gap: 20px;
    }
    .tutorial-main { flex: 1; min-width: 0; }
    .tutorial-sidebar { width: 280px; flex-shrink: 0; }
    .tutorial-header {
      margin-bottom: 16px;
    }
    .tutorial-header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #1a1a1a); }
    .tutorial-header p { margin: 0; font-size: 13px; color: var(--pages-neutral-8, #999); }
    .error {
      padding: var(--pages-space-4, 16px);
      color: var(--pages-danger-9, #dc2626);
      background: rgba(239, 68, 68, 0.1);
      border-radius: var(--pages-radius-sm, 4px);
    }
  `;

  @property({ attribute: false }) registry: TutorialDescriptor[] = [];
  @property({ attribute: false }) paths: LearningPath[] = [];
  @property() contentBase?: string;

  @state() private _view: 'catalog' | 'tutorial' = 'catalog';
  @state() private _activeTutorial: TutorialDescriptor | null = null;
  @state() private _error: string | null = null;

  private _runner: TutorialRunner | null = null;
  private _eventTarget: EventTarget | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._disposeRunner();
  }

  private _disposeRunner(): void {
    if (this._runner) {
      this._runner.dispose();
      this._runner = null;
    }
    this._eventTarget = null;
  }

  private async _onTutorialSelect(e: CustomEvent): Promise<void> {
    const scenario = e.detail.scenario as string;
    const desc = this.registry.find(r => r.scenario === scenario);
    if (!desc) return;

    this._activeTutorial = desc;
    this._error = null;

    try {
      const basePath = this.contentBase
        ? `${this.contentBase}/${desc.path}`
        : desc.path;
      const yamlUrl = basePath;
      const resp = await fetch(yamlUrl);
      if (!resp.ok) throw new Error(`Failed to load tutorial: ${resp.status}`);

      const yamlText = await resp.text();
      const parsed = parse(yamlText);

      if (!isSectioned(parsed)) {
        throw new Error('Tutorial must use sectioned format');
      }

      this._disposeRunner();
      this._eventTarget = new EventTarget();
      this._view = 'tutorial';

      await this.updateComplete;
      await new Promise(r => setTimeout(r, 50));

      const tutorialDir = basePath.replace(/\/[^/]+$/, '');
      this._runner = runSectionedScenario(parsed, {
        eventTarget: this._eventTarget,
        contentBase: tutorialDir,
        startPaused: true,
        onComplete: (name) => {
          try { localStorage.setItem(`tutorial:completed:${name}`, 'true'); }
          catch { /* graceful degradation */ }
        },
      });
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      this._view = 'tutorial';
    }
  }

  private _onBack(): void {
    this._disposeRunner();
    this._activeTutorial = null;
    this._error = null;
    this._view = 'catalog';
  }

  override render(): TemplateResult {
    if (this._view === 'catalog') {
      return this._renderCatalog();
    }
    return this._renderTutorial();
  }

  private _renderCatalog(): TemplateResult {
    return html`
      <pages-tutorial-catalog
        .registry=${this.registry}
        .paths=${this.paths}
        @tutorial-select=${(e: CustomEvent) => void this._onTutorialSelect(e)}
      ></pages-tutorial-catalog>
    `;
  }

  private _renderTutorial(): TemplateResult {
    if (this._error) {
      return html`
        <button class="back-btn" @click=${() => this._onBack()}>← Back to Tutorials</button>
        <div class="error">${this._error}</div>
      `;
    }

    const desc = this._activeTutorial;
    return html`
      <button class="back-btn" @click=${() => this._onBack()}>← Back to Tutorials</button>
      ${desc ? html`
        <div class="tutorial-header">
          <h2>${desc.hero?.icon ?? ''} ${desc.title}</h2>
          <p>${desc.description}</p>
        </div>
      ` : nothing}
      <div class="tutorial-layout">
        <div class="tutorial-main">
          <pages-scenario-narrative
            .eventTarget=${this._eventTarget}
            htmlMode="sanitized"
          ></pages-scenario-narrative>
        </div>
        <div class="tutorial-sidebar">
          <pages-scenario-controller
            .eventTarget=${this._eventTarget}
          ></pages-scenario-controller>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('pages-tutorial-host')) {
  customElements.define('pages-tutorial-host', PagesTutorialHost);
}
