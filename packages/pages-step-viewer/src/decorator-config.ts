import { html, nothing, type TemplateResult } from 'lit';
import './decorator-badge.js';

export interface DecoratorConfig {
  icon: string;
  bg: string;
  fg: string;
  label: (v: unknown) => string;
}

function sv(v: unknown): string { return String(v ?? ''); }

const MAUVE  = { bg: '203, 166, 247', fg: '#cba6f7' };
const TEAL   = { bg: '148, 226, 213', fg: '#94e2d5' };
const YELLOW = { bg: '249, 226, 175', fg: '#f9e2af' };
const RED    = { bg: '243, 139, 168', fg: '#f38ba8' };
const BLUE   = { bg: '137, 180, 250', fg: '#89b4fa' };
const PEACH  = { bg: '250, 179, 135', fg: '#fab387' };
const GREEN  = { bg: '166, 227, 161', fg: '#a6e3a1' };
const GREY   = { bg: '127, 132, 156', fg: '#7f849c' };

export const DECORATOR_CONFIG: Record<string, DecoratorConfig> = {
  'if':           { icon: '?',  ...MAUVE,  label: sv },
  'when':         { icon: '?',  ...MAUVE,  label: sv },
  'on-success':   { icon: '✓',  ...MAUVE,  label: sv },
  'on-failure':   { icon: '✗',  ...MAUVE,  label: sv },
  'on-error':     { icon: '⚠',  ...MAUVE,  label: sv },
  'on-complete':  { icon: '◉',  ...MAUVE,  label: sv },

  'loop':         { icon: '↻',  ...TEAL,   label: sv },
  'forEach':      { icon: '∀',  ...TEAL,   label: v => {
    if (typeof v === 'string') return v;
    const obj = v as Record<string, unknown>;
    return `${obj.item ?? ''} in ${obj.collection ?? ''}`;
  }},

  'timeout':      { icon: '⏱',  ...YELLOW, label: v => `${v}ms` },
  'delay':        { icon: '⏱',  ...YELLOW, label: sv },
  'wait':         { icon: '⏳',  ...YELLOW, label: sv },
  'speed':        { icon: '⚡',  ...YELLOW, label: sv },

  'mutex':        { icon: '🔒', ...RED,    label: sv },
  'semaphore':    { icon: '⊜',  ...RED,    label: sv },
  'barrier':      { icon: '‖',  ...RED,    label: sv },
  'quorum':       { icon: '⊞',  ...RED,    label: sv },
  'cancel':       { icon: '⏹',  ...RED,    label: v => `cancel: ${v}` },

  'publish':      { icon: '📡', ...BLUE,   label: v => `→ ${v}` },
  'from':         { icon: '📥', ...BLUE,   label: v => `← ${v}` },
  'transform':    { icon: '⇄',  ...BLUE,   label: sv },
  'capture':      { icon: '⊙',  ...BLUE,   label: sv },
  'content':      { icon: '≡',  ...BLUE,   label: sv },

  'retry':        { icon: '↻',  ...PEACH,  label: v => `retry: ${v}` },
  'trigger':      { icon: '⚡',  ...PEACH,  label: sv },
  'transition':   { icon: '⇢',  ...PEACH,  label: sv },
  'signal':       { icon: '◇',  ...PEACH,  label: sv },
  'at':           { icon: '@',  ...PEACH,  label: sv },
  'resource':     { icon: '⊟',  ...PEACH,  label: sv },
  'priority':     { icon: '↑',  ...PEACH,  label: sv },

  'background':   { icon: '⟳',  ...GREEN,  label: () => 'background' },
  'simulation':   { icon: '◈',  ...GREEN,  label: sv },
  'mode':         { icon: '⊕',  ...GREEN,  label: sv },

  'label':        { icon: '≋',  ...GREY,   label: sv },
  'target':       { icon: '⊚',  ...GREY,   label: sv },
  'actor':        { icon: '◇',  ...GREY,   label: sv },
  'await':        { icon: '◈',  ...GREY,   label: sv },
};

export function getDecoratorConfig(kind: string): DecoratorConfig | undefined {
  return DECORATOR_CONFIG[kind];
}

export function renderDecorators(decs: Record<string, unknown> | undefined): TemplateResult | typeof nothing {
  if (!decs || Object.keys(decs).length === 0) return nothing;

  const badges: TemplateResult[] = [];
  for (const [key, value] of Object.entries(decs)) {
    if (value == null) continue;
    const cfg = DECORATOR_CONFIG[key];
    if (!cfg) continue;
    badges.push(html`<decorator-badge kind="${key}" label="${cfg.label(value)}"></decorator-badge>`);
  }

  return badges.length > 0
    ? html`<div class="decorators">${badges}</div>`
    : nothing;
}
