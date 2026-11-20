import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ResolvedStep } from '@casehubio/yaml-core/step';
import { Walker } from '@casehubio/yaml-core/step';
import { StepPositionScanner, type StepLineInfo } from '@casehubio/yaml-core';
import { parse } from 'yaml';
import './pages-step-viewer.js';
import { demoCatalog } from './demo-catalog.js';

export interface StepSelectDetail {
  line: number;
  endLine: number;
  address: string;
}

export interface SplitViewState {
  steps: ResolvedStep[];
  positionInfos: StepLineInfo[];
  error: string | null;
}

export function parseAndResolve(yaml: string): SplitViewState {
  if (!yaml.trim()) {
    return { steps: [], positionInfos: [], error: null };
  }
  try {
    const doc = parse(yaml) as unknown;
    if (!doc) return { steps: [], positionInfos: [], error: null };
    if (!Array.isArray(doc) && typeof doc === 'object' && doc !== null && 'steps' in (doc as Record<string, unknown>)) {
      return { steps: [], positionInfos: [], error: "'steps' wrapper is not valid — use a bare list of steps" };
    }
    if (!Array.isArray(doc)) {
      return { steps: [], positionInfos: [], error: 'YAML must be a list of steps' };
    }
    const steps = Walker.resolve(doc as Record<string, unknown>[], demoCatalog);
    const positionInfos = StepPositionScanner.scan(yaml);
    return { steps, positionInfos, error: null };
  } catch (e) {
    return { steps: [], positionInfos: [], error: e instanceof Error ? e.message : String(e) };
  }
}

@customElement('playbook-split-view')
export class PlaybookSplitView extends LitElement {
  @property({ type: Number }) splitRatio = 0.5;
  @state() private _steps: ResolvedStep[] = [];
  @state() private _parseError: string | null = null;

  private _positionInfos: StepLineInfo[] = [];
  private _debounceTimer?: ReturnType<typeof setTimeout>;

  static override styles = css`
    :host {
      display: flex;
      height: 100%;
      overflow: hidden;
    }
    .left-panel {
      overflow: auto;
      border-right: 1px solid var(--pages-border, #334155);
    }
    .right-panel {
      overflow: auto;
      padding: 16px;
      background: var(--pages-surface-0, #0f172a);
    }
    .splitter {
      width: 4px;
      cursor: col-resize;
      background: var(--pages-border, #334155);
      flex-shrink: 0;
    }
    .splitter:hover {
      background: var(--pages-primary, #3b82f6);
    }
    .error-banner {
      padding: 12px 16px;
      background: rgba(248, 113, 113, 0.1);
      border: 1px solid rgba(248, 113, 113, 0.3);
      border-radius: 6px;
      color: #f87171;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
      margin-bottom: 16px;
    }
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--pages-text-secondary, #94a3b8);
      font-size: 14px;
    }
    ::slotted(*) {
      width: 100%;
      height: 100%;
    }
  `;

  updateYaml(yaml: string): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      const result = parseAndResolve(yaml);
      this._steps = result.steps;
      this._positionInfos = result.positionInfos;
      this._parseError = result.error;
    }, 300);
  }

  syncCursorLine(line: number): void {
    const info = StepPositionScanner.findByLine(this._positionInfos, line);
    const viewer = this.renderRoot.querySelector('pages-step-viewer');
    if (viewer && info) {
      (viewer as import('./pages-step-viewer.js').PagesStepViewer).setActiveStep(info.address);
    } else if (viewer) {
      (viewer as import('./pages-step-viewer.js').PagesStepViewer).setActiveStep(null);
    }
  }

  private _onStepClick(e: Event): void {
    const detail = (e as CustomEvent).detail as { address: string };
    const info = StepPositionScanner.findByAddress(this._positionInfos, detail.address);
    if (info) {
      this.dispatchEvent(new CustomEvent<StepSelectDetail>('step-select', {
        bubbles: true,
        composed: true,
        detail: { line: info.line, endLine: info.endLine, address: detail.address },
      }));
    }
  }

  private _onSplitterPointerDown(e: PointerEvent): void {
    const splitter = e.currentTarget as HTMLElement;
    splitter.setPointerCapture(e.pointerId);
    const host = this.renderRoot.querySelector('.left-panel') as HTMLElement;
    const container = this as HTMLElement;

    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0.15, Math.min(0.85, (ev.clientX - rect.left) / rect.width));
      this.splitRatio = ratio;
      host.style.flex = `0 0 ${String(ratio * 100)}%`;
      const right = this.renderRoot.querySelector('.right-panel') as HTMLElement;
      if (right) right.style.flex = `1 1 0`;
    };

    const onUp = () => {
      splitter.removeEventListener('pointermove', onMove);
      splitter.removeEventListener('pointerup', onUp);
    };

    splitter.addEventListener('pointermove', onMove);
    splitter.addEventListener('pointerup', onUp);
  }

  override render() {
    const leftFlex = `0 0 ${String(this.splitRatio * 100)}%`;
    return html`
      <div class="left-panel" style="flex: ${leftFlex}">
        <slot></slot>
      </div>
      <div class="splitter" @pointerdown=${this._onSplitterPointerDown}></div>
      <div class="right-panel" style="flex: 1 1 0" @step-click=${this._onStepClick}>
        ${this._parseError
          ? html`<div class="error-banner">${this._parseError}</div>`
          : this._steps.length === 0
            ? html`<div class="empty-state">Enter playbook YAML to see the visualization</div>`
            : html`<pages-step-viewer .steps=${this._steps}></pages-step-viewer>`
        }
      </div>
    `;
  }
}
