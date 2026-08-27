import { getRegisteredStyles } from '../registry/stencil-registry.js';
import reactFlowCSS from '@xyflow/react/dist/style.css?raw';

export const DIAGRAM_ROOT_CLASS = 'diagram-root';

export function getIsolationCSS(): string {
  const pluginStyles = getRegisteredStyles();

  return `
.${DIAGRAM_ROOT_CLASS} {
  all: initial;
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

${reactFlowCSS}

${pluginStyles}

.react-flow__controls {
  background: var(--pages-neutral-1, #fafafa);
  border: 1px solid var(--pages-neutral-4, #ccc);
  border-radius: var(--pages-radius-md, 8px);
}
.react-flow__controls-button {
  background: var(--pages-neutral-1, #fafafa);
  border-bottom: 1px solid var(--pages-neutral-3, #ddd);
  color: var(--pages-text-primary, #111);
  fill: var(--pages-text-primary, #111);
}
.react-flow__controls-button:hover {
  background: var(--pages-neutral-2, #f0f0f0);
}
.react-flow__handle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pages-neutral-6, #9ca3af);
  border: none;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}
.react-flow__node:hover .react-flow__handle,
.react-flow__node.selected .react-flow__handle {
  opacity: 0.7;
}
.react-flow__handle:hover {
  opacity: 1;
  background: var(--pages-accent-9, #5470c6);
}
.react-flow__handle-valid {
  opacity: 1;
  background: var(--pages-success-9, #16a34a);
}
.react-flow__handle-connecting {
  opacity: 1;
  background: var(--pages-accent-9, #5470c6);
}
.stencil-decoration-wrapper {
  position: relative;
  z-index: 1;
}
`.trim();
}

interface StyleEntry {
  count: number;
  style: HTMLStyleElement;
}

const styleRoots = new WeakMap<Document | ShadowRoot, StyleEntry>();

function getStyleRoot(host?: HTMLElement): Document | ShadowRoot {
  if (host) {
    const root = host.getRootNode();
    if (root instanceof ShadowRoot) return root;
  }
  return document;
}

export function injectIsolationStyles(host?: HTMLElement): HTMLStyleElement {
  const root = getStyleRoot(host);
  const target = root instanceof ShadowRoot ? root : document.head;
  const entry = styleRoots.get(root);

  if (entry) {
    entry.count++;
    entry.style.textContent = getIsolationCSS();
    return entry.style;
  }

  const style = document.createElement('style');
  style.setAttribute('data-graph-isolation', 'true');
  style.textContent = getIsolationCSS();
  target.appendChild(style);
  styleRoots.set(root, { count: 1, style });
  return style;
}

export function releaseIsolationStyles(host?: HTMLElement): void {
  const root = getStyleRoot(host);
  const entry = styleRoots.get(root);
  if (!entry) return;
  entry.count--;
  if (entry.count === 0) {
    entry.style.remove();
    styleRoots.delete(root);
  }
}

export function resetIsolationState(): void {
  const docEntry = styleRoots.get(document);
  if (docEntry) {
    docEntry.style.remove();
    styleRoots.delete(document);
  }
}
