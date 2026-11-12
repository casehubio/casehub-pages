import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ControlStep as ControlStepType } from '@casehubio/yaml-core/step';
import { renderDecorators } from './decorator-config.js';

@customElement('control-step')
export class ControlStepComponent extends LitElement {
  @property({ attribute: false }) step!: ControlStepType;

  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #cdd6f4;
      transition: background 0.15s;
      cursor: default;
    }
    :host(:hover) {
      background: rgba(255, 255, 255, 0.07);
    }
    .control-icon {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
      font-weight: 600;
    }
    .control-icon.pause {
      background: rgba(249, 226, 175, 0.15);
      color: #f9e2af;
    }
    .control-icon.resume {
      background: rgba(166, 227, 161, 0.15);
      color: #a6e3a1;
    }
    .control-action {
      font-weight: 500;
    }
    .control-target {
      color: #7f849c;
      font-size: 12px;
    }
    .decorators {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-left: auto;
      justify-content: flex-end;
    }
  `;

  override render() {
    const isPause = this.step.control === 'pause';
    const icon = isPause ? '⏸' : '▶';
    const colorClass = isPause ? 'pause' : 'resume';

    return html`
      <div class="control-icon ${colorClass}">${icon}</div>
      <span class="control-action">${this.step.control}</span>
      <span class="control-target">${this.step.target}</span>
      ${renderDecorators(this.step.decorators)}
    `;
  }
}
