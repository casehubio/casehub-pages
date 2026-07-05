import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import './schema-form.js';

describe('pages-schema-form', () => {
  let el: HTMLElement & { schema: unknown; data: unknown; mode: string; submit: () => unknown };

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      count: { type: 'number' },
      active: { type: 'boolean' },
      status: { type: 'string', enum: ['open', 'closed'] },
    },
    required: ['title'],
  };

  const data = { title: 'Test Item', count: 42, active: true, status: 'open' };

  beforeEach(async () => {
    el = document.createElement('pages-schema-form') as any;
    el.schema = schema;
    el.data = data;
    el.mode = 'display';
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders in display mode with labels and values', () => {
    const shadow = el.shadowRoot!;
    expect(shadow.textContent).toContain('title');
    expect(shadow.textContent).toContain('Test Item');
    expect(shadow.textContent).toContain('42');
  });

  it('renders boolean as Yes/No', () => {
    const shadow = el.shadowRoot!;
    expect(shadow.textContent).toContain('Yes');
  });

  it('shows dash for null values', async () => {
    el.data = { title: 'Test', count: null, active: false, status: null };
    await (el as any).updateComplete;
    expect(el.shadowRoot!.textContent).toContain('—');
  });

  it('renders no-schema message when schema is null', async () => {
    el.schema = null;
    await (el as any).updateComplete;
    expect(el.shadowRoot!.textContent).toContain('No schema provided');
  });

  it('renders edit mode with form inputs', async () => {
    el.mode = 'edit';
    await (el as any).updateComplete;
    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('input[type="text"]')).toBeTruthy();
    expect(shadow.querySelector('input[type="number"]')).toBeTruthy();
    expect(shadow.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(shadow.querySelector('select')).toBeTruthy();
  });

  it('dispatches pages-schema-form-change event on field edit', async () => {
    el.mode = 'edit';
    await (el as any).updateComplete;

    const changePromise = new Promise<CustomEvent>((resolve) => {
      el.addEventListener('pages-schema-form-change', ((e: Event) => resolve(e as CustomEvent)) as EventListener, { once: true });
    });

    const input = el.shadowRoot!.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'New Title';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const event = await changePromise;
    expect(event.detail.key).toBe('title');
    expect(event.detail.value).toBe('New Title');
    expect(event.detail.data).toBeDefined();
  });

  it('dispatches pages-schema-form-submit event on submit()', async () => {
    el.mode = 'edit';
    await (el as any).updateComplete;

    const submitPromise = new Promise<CustomEvent>((resolve) => {
      el.addEventListener('pages-schema-form-submit', ((e: Event) => resolve(e as CustomEvent)) as EventListener, { once: true });
    });

    const result = el.submit();
    expect(result).not.toBeNull();

    const event = await submitPromise;
    expect(event.detail.data).toBeDefined();
    expect(event.detail.data.title).toBe('Test Item');
  });

  it('submit() returns null when required fields are empty', async () => {
    el.mode = 'edit';
    el.data = { title: '', count: 42, active: true, status: 'open' };
    await (el as any).updateComplete;

    const result = el.submit();
    expect(result).toBeNull();
  });

  it('uses --pages-* CSS custom properties (not --blocks-*)', () => {
    const styles = (el.constructor as any).styles;
    const cssText = Array.isArray(styles)
      ? styles.map((s: any) => s.cssText ?? String(s)).join(' ')
      : styles.cssText ?? String(styles);
    expect(cssText).not.toContain('--blocks-');
    expect(cssText).toContain('--pages-');
  });

  it('renders nested object fields recursively', async () => {
    el.schema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            zip: { type: 'string' },
          },
        },
      },
    };
    el.data = { address: { city: 'London', zip: 'EC1' } };
    await (el as any).updateComplete;

    const shadow = el.shadowRoot!;
    expect(shadow.textContent).toContain('London');
    expect(shadow.textContent).toContain('EC1');
  });

  it('renders array values as comma-separated list', async () => {
    el.schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    };
    el.data = { tags: ['alpha', 'beta', 'gamma'] };
    await (el as any).updateComplete;

    expect(el.shadowRoot!.textContent).toContain('alpha, beta, gamma');
  });

  it('edit mode renders actions slot', async () => {
    el.mode = 'edit';
    await (el as any).updateComplete;

    const slot = el.shadowRoot!.querySelector('slot[name="actions"]');
    expect(slot).toBeTruthy();
  });

  it('display mode uses role="group"', () => {
    const container = el.shadowRoot!.querySelector('.schema-form');
    expect(container?.getAttribute('role')).toBe('group');
  });

  it('edit mode uses role="form"', async () => {
    el.mode = 'edit';
    await (el as any).updateComplete;
    const container = el.shadowRoot!.querySelector('.schema-form');
    expect(container?.getAttribute('role')).toBe('form');
  });
});
