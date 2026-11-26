import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ResolvedStep } from '@casehubio/yaml-core/step';
import { diffSteps, type DiffResult } from '@casehubio/yaml-core/step/diff';
import { StepPositionScanner, type StepLineInfo } from '@casehubio/yaml-core';
import type { ViewerSelectDetail } from '@casehubio/pages-three-way-viewer';
import { renderStepContent, renderStepContentWithAddress } from './step-dispatch.js';
import { assignStepAddresses } from './step-click.js';
import { renderDiffContent } from './diff-dispatch.js';
import './diff-summary.js';

@customElement('pages-step-viewer')
export class PagesStepViewer extends LitElement {
  @property({ attribute: false }) steps?: ResolvedStep[];
  @property({ attribute: false }) oldSteps?: ResolvedStep[];
  @property({ attribute: false }) newSteps?: ResolvedStep[];
  @property({ attribute: false }) diffResult?: DiffResult;
  @state() private _activeAddress: string | null = null;
  @property({ attribute: false }) positionInfos: StepLineInfo[] = [];
  @property({ attribute: false }) error: string | null = null;

  static override styles = css`
    :host { display: block; }
    .steps { display: flex; flex-direction: column; gap: 2px; }
    .step-clickable { cursor: pointer; border-radius: 4px; transition: outline 0.15s; }
    .step-clickable:hover { outline: 1px solid var(--pages-border, #475569); outline-offset: 2px; }
    .step-clickable.step-active {
      outline: 2px solid var(--pages-primary, #3b82f6);
      outline-offset: 2px;
      border-radius: 4px;
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
      margin: 16px;
    }
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--pages-text-secondary, #94a3b8);
      font-size: 14px;
    }
  `;

  setActiveStep(address: string | null): void {
    this._activeAddress = address;
    if (address) {
      requestAnimationFrame(() => {
        const el = this.renderRoot.querySelector(`[data-step-address="${address}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  syncLine(line: number): void {
    const info = StepPositionScanner.findByLine(this.positionInfos, line);
    this.setActiveStep(info?.address ?? null);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('step-click', this._onStepClickSync as EventListener);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('step-click', this._onStepClickSync as EventListener);
  }

  private _onStepClickSync = (e: Event): void => {
    if (this.positionInfos.length === 0) return;
    const { address } = (e as CustomEvent<{ address: string }>).detail;
    const info = StepPositionScanner.findByAddress(this.positionInfos, address);
    if (info) {
      this.dispatchEvent(new CustomEvent<ViewerSelectDetail>('viewer-select', {
        bubbles: true,
        composed: true,
        detail: { line: info.line, endLine: info.endLine },
      }));
    }
  };

  private get computedDiff(): DiffResult | undefined {
    if (this.diffResult) return this.diffResult;
    if (this.oldSteps && this.newSteps) return diffSteps(this.oldSteps, this.newSteps);
    return undefined;
  }

  override render() {
    if (this.error) {
      return html`<div class="error-banner">${this.error}</div>`;
    }

    const diff = this.computedDiff;
    if (diff) {
      return html`
        <diff-summary .stats=${diff.summary}></diff-summary>
        <div class="steps">
          ${diff.root.map(node => renderDiffContent(node))}
        </div>
      `;
    }

    const steps = this.steps ?? this.newSteps ?? [];
    if (steps.length === 0) {
      return html`<div class="empty-state">Enter playbook YAML to see the visualization</div>`;
    }

    const addressMap = assignStepAddresses(steps);
    return html`
      <div class="steps">
        ${steps.map(s => {
          const addr = addressMap.get(s);
          return addr !== undefined
            ? renderStepContentWithAddress(s, addr, this._activeAddress)
            : renderStepContent(s);
        })}
      </div>
    `;
  }
}
