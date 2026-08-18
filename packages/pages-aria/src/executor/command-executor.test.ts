import { describe, it, expect, beforeEach, vi } from 'vitest';
import { click, fill, select, expand, collapse, assertState, resolveTarget } from './command-executor.js';

describe('ARIA command executor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('resolveTarget', () => {
    it('finds element by role + name', () => {
      document.body.innerHTML = '<button aria-label="Submit">Submit</button>';
      const el = resolveTarget({ role: 'button', name: 'Submit' });
      expect(el.tagName).toBe('BUTTON');
    });

    it('resolves with within scoping', () => {
      document.body.innerHTML = `
        <div role="row" aria-label="Row A"><button aria-label="Delete">Delete</button></div>
        <div role="row" aria-label="Row B"><button aria-label="Delete">Delete</button></div>
      `;
      const el = resolveTarget({
        role: 'button', name: 'Delete',
        within: { role: 'row', name: 'Row B' },
      });
      expect(el.closest('[aria-label="Row B"]')).not.toBeNull();
    });

    it('throws when element not found', () => {
      document.body.innerHTML = '<button aria-label="Submit">Submit</button>';
      expect(() => resolveTarget({ role: 'button', name: 'Cancel' }))
        .toThrow('No element found: button "Cancel"');
    });

    it('throws when multiple matches without scoping', () => {
      document.body.innerHTML = `
        <button aria-label="Delete">Delete</button>
        <button aria-label="Delete">Delete</button>
      `;
      expect(() => resolveTarget({ role: 'button', name: 'Delete' }))
        .toThrow('Multiple elements found: button "Delete" (2 matches)');
    });
  });

  describe('click', () => {
    it('dispatches click event', () => {
      document.body.innerHTML = '<button aria-label="Submit">Submit</button>';
      const handler = vi.fn();
      document.querySelector('button')!.addEventListener('click', handler);
      click({ role: 'button', name: 'Submit' });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('fill', () => {
    it('sets input value and dispatches events', () => {
      document.body.innerHTML = '<input aria-label="Name" />';
      const input = document.querySelector('input')!;
      const inputHandler = vi.fn();
      const changeHandler = vi.fn();
      input.addEventListener('input', inputHandler);
      input.addEventListener('change', changeHandler);
      fill({ role: 'textbox', name: 'Name' }, 'Alice');
      expect(input.value).toBe('Alice');
      expect(inputHandler).toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('select', () => {
    it('sets select value and dispatches change', () => {
      document.body.innerHTML = `
        <select aria-label="Priority">
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>
      `;
      const selectEl = document.querySelector('select')!;
      const changeHandler = vi.fn();
      selectEl.addEventListener('change', changeHandler);
      select({ role: 'listbox', name: 'Priority' }, 'high');
      expect(selectEl.value).toBe('high');
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('expand / collapse', () => {
    it('expand dispatches click', () => {
      document.body.innerHTML = '<div role="treeitem" aria-label="Case" aria-expanded="false">Case</div>';
      const handler = vi.fn();
      document.querySelector('[role="treeitem"]')!.addEventListener('click', handler);
      expand({ role: 'treeitem', name: 'Case' });
      expect(handler).toHaveBeenCalledOnce();
    });

    it('collapse dispatches click', () => {
      document.body.innerHTML = '<div role="treeitem" aria-label="Case" aria-expanded="true">Case</div>';
      const handler = vi.fn();
      document.querySelector('[role="treeitem"]')!.addEventListener('click', handler);
      collapse({ role: 'treeitem', name: 'Case' });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('assertState', () => {
    it('passes when state matches', () => {
      document.body.innerHTML = '<button aria-label="Submit" aria-busy="false">Submit</button>';
      expect(() => assertState(
        { role: 'button', name: 'Submit' },
        { busy: false }
      )).not.toThrow();
    });

    it('throws when state does not match', () => {
      document.body.innerHTML = '<button aria-label="Submit" aria-busy="true">Submit</button>';
      expect(() => assertState(
        { role: 'button', name: 'Submit' },
        { busy: false }
      )).toThrow('State mismatch for button "Submit": busy expected false, got true');
    });

    it('checks multiple state properties', () => {
      document.body.innerHTML = '<button aria-label="Submit" aria-busy="false" aria-disabled="true">Submit</button>';
      expect(() => assertState(
        { role: 'button', name: 'Submit' },
        { busy: false, disabled: true }
      )).not.toThrow();
    });
  });
});
