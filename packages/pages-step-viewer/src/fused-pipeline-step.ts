import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { FusedPipelineStep as FusedPipelineStepType } from '@casehubio/yaml-core/step';
import { getActionIcon } from './icons.js';
import { renderDecorators } from './decorator-config.js';

@customElement('fused-pipeline-step')
export class FusedPipelineStepComponent extends LitElement {
  @property({ attribute: false }) step!: FusedPipelineStepType;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid rgba(148, 226, 213, 0.15);
      border-radius: 6px;
      padding: 8px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #cdd6f4;
    }
    .pipeline-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 4px 8px;
      font-size: 12px;
      font-weight: 600;
      color: #94e2d5;
    }
    .pipeline-header .decorators {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-left: auto;
      justify-content: flex-end;
    }
    .stage {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 4px;
      font-size: 12px;
    }
    .stage:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .stage-icon {
      width: 18px;
      height: 18px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      flex-shrink: 0;
      font-weight: 600;
      background: rgba(205, 214, 244, 0.1);
      color: #cdd6f4;
    }
    .stage-name {
      font-weight: 500;
      color: #cdd6f4;
    }
    .stage-input {
      color: #7f849c;
      font-size: 11px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
    .connector {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 0;
      color: rgba(148, 226, 213, 0.5);
      font-size: 10px;
    }
  `;

  override render() {
    if (!this.step?.stages?.length) return nothing;

    return html`
      <div class="pipeline-header">
        ⟿ pipeline ${this.step.name ? html`<span>${this.step.name}</span>` : nothing}
        ${renderDecorators(this.step.decorators)}
      </div>
      ${this.step.stages.map((stage, i) => html`
        ${i > 0 ? html`<div class="connector">↓</div>` : nothing}
        <div class="stage">
          <div class="stage-icon">${getActionIcon(stage.actionName).symbol}</div>
          <span class="stage-name">${stage.stepName ?? stage.actionName}</span>
          ${stage.inputKey ? html`<span class="stage-input">← ${stage.inputKey}</span>` : nothing}
        </div>
      `)}
    `;
  }
}
