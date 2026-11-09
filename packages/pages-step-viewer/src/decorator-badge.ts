import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getDecoratorConfig } from './decorator-config.js';

@customElement('decorator-badge')
export class DecoratorBadge extends LitElement {
  @property({ reflect: true }) kind!: string;
  @property() label = '';

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      flex-shrink: 0;
      background: var(--badge-bg);
      color: var(--badge-fg);
    }
  `;

  override render() {
    const cfg = getDecoratorConfig(this.kind);
    const icon = cfg?.icon ?? '▸';
    if (cfg) {
      this.style.setProperty('--badge-bg', `rgba(${cfg.bg}, 0.2)`);
      this.style.setProperty('--badge-fg', cfg.fg);
    }
    return html`${icon} ${this.label}`;
  }
}
