import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ResolvedStep } from '@casehubio/yaml-core/step';
import { Walker } from '@casehubio/yaml-core/step';
import { StepPositionScanner, type StepLineInfo } from '@casehubio/yaml-core';
import { parse } from 'yaml';
import './pages-step-viewer.js';
import { demoCatalog } from './demo-catalog.js';
import '@casehubio/pages-three-way-viewer';

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
  @property() value = '';
  @property({ type: Number }) splitRatio = 0.5;

  @state() private _steps: ResolvedStep[] = [];
  @state() private _positionInfos: StepLineInfo[] = [];
  @state() private _parseError: string | null = null;

  static override styles = css`
    :host {
      display: block;
      height: 100%;
    }
    pages-three-way-viewer {
      height: 100%;
    }
  `;

  updateYaml(yaml: string): void {
    this.value = yaml;
    const result = parseAndResolve(yaml);
    this._steps = result.steps;
    this._positionInfos = result.positionInfos;
    this._parseError = result.error;
  }

  syncCursorLine(line: number): void {
    const viewer = this.renderRoot.querySelector('pages-step-viewer');
    if (viewer) {
      (viewer as import('./pages-step-viewer.js').PagesStepViewer).syncLine(line);
    }
  }

  private _onValueChange(e: Event): void {
    const { value } = (e as CustomEvent<{ value: string }>).detail;
    this.value = value;
    const result = parseAndResolve(value);
    this._steps = result.steps;
    this._positionInfos = result.positionInfos;
    this._parseError = result.error;
  }

  override render() {
    return html`
      <pages-three-way-viewer
        language="yaml"
        .value=${this.value}
        split-ratio=${this.splitRatio}
        @value-change=${this._onValueChange}>
        <pages-step-viewer slot="visual-pane"
          .steps=${this._steps}
          .positionInfos=${this._positionInfos}
          .error=${this._parseError}>
        </pages-step-viewer>
      </pages-three-way-viewer>
    `;
  }
}
