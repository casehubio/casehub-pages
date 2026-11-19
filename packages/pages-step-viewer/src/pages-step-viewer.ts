import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ResolvedStep } from '@casehubio/yaml-core/step';
import { diffSteps, type DiffResult } from '@casehubio/yaml-core/step/diff';
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

  private get computedDiff(): DiffResult | undefined {
    if (this.diffResult) return this.diffResult;
    if (this.oldSteps && this.newSteps) return diffSteps(this.oldSteps, this.newSteps);
    return undefined;
  }

  override render() {
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
