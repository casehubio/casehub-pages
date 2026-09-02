// Validates the component bundle is loadable ESM by stubbing browser globals
// that Lit requires at module init time (createTreeWalker, adoptedStyleSheets, etc.)

const noop = () => {};

class FakeElement {
  constructor() { this.childNodes = []; this.style = {}; }
  setAttribute() {}
  removeAttribute() {}
  append() {}
  replaceWith() {}
  get content() { return this; }
  get firstChild() { return new FakeElement(); }
}

globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define: () => {} };
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.document = {
  createElement: () => new FakeElement(),
  createComment: () => new FakeElement(),
  createTreeWalker: () => ({ nextNode: () => null, currentNode: null }),
  adoptedStyleSheets: [],
  head: { prepend: noop },
  addEventListener: noop,
  removeEventListener: noop,
  hidden: false,
};
globalThis.window = globalThis;
globalThis.MutationObserver = class { observe() {} disconnect() {} };

const bundlePath = process.argv[2];
if (!bundlePath) { console.error('Usage: validate-bundle.mjs <path>'); process.exit(1); }

await import(new URL('file://' + bundlePath));
console.log('  ✓ Bundle is valid ESM');
