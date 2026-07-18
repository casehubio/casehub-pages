import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './pages-schema-form.js';

describe('pages-schema-form', () => {
  let el: HTMLElement & { schema: unknown; data: unknown; mode: string };

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

  describe('edit mode', () => {
    beforeEach(async () => {
      el.mode = 'edit';
      await (el as any).updateComplete;
    });

    it('renders text input for string fields', () => {
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[id="title"]');
      expect(input).toBeTruthy();
      expect(input!.type).toBe('text');
      expect(input!.value).toBe('Test Item');
    });

    it('renders number input for number fields', () => {
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[id="count"]');
      expect(input).toBeTruthy();
      expect(input!.type).toBe('number');
    });

    it('renders checkbox for boolean fields', () => {
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="checkbox"]');
      expect(input).toBeTruthy();
      expect(input!.checked).toBe(true);
    });

    it('renders select for enum fields', () => {
      const select = el.shadowRoot!.querySelector<HTMLSelectElement>('select[id="status"]');
      expect(select).toBeTruthy();
      expect(select!.value).toBe('open');
      const options = select!.querySelectorAll('option');
      expect(options.length).toBe(2);
    });

    it('emits pages-form-change on field edit', async () => {
      const handler = vi.fn();
      el.addEventListener('pages-form-change', handler);
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[id="title"]')!;
      input.value = 'Updated';
      input.dispatchEvent(new Event('input'));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0].detail.key).toBe('title');
      expect(handler.mock.calls[0]?.[0].detail.value).toBe('Updated');
    });

    it('submit() returns data and emits pages-form-submit', () => {
      const handler = vi.fn();
      el.addEventListener('pages-form-submit', handler);
      const result = (el as any).submit();
      expect(result).toBeTruthy();
      expect(result.title).toBe('Test Item');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('submit() returns null for missing required fields', async () => {
      el.data = { count: 42, active: true, status: 'open' };
      await (el as any).updateComplete;
      const result = (el as any).submit();
      expect(result).toBeNull();
    });

    it('renders textarea for long strings', async () => {
      el.schema = {
        type: 'object',
        properties: { notes: { type: 'string', maxLength: 500 } },
      };
      el.data = { notes: 'Some long text' };
      await (el as any).updateComplete;
      expect(el.shadowRoot!.querySelector('textarea')).toBeTruthy();
    });
  });

  describe('nested objects', () => {
    const nestedSchema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
        },
      },
    };

    it('renders nested fields in display mode', async () => {
      el.schema = nestedSchema;
      el.data = { address: { street: '123 Main St', city: 'Springfield' } };
      el.mode = 'display';
      await (el as any).updateComplete;
      const text = el.shadowRoot!.textContent!;
      expect(text).toContain('123 Main St');
      expect(text).toContain('Springfield');
    });

    it('renders nested inputs in edit mode', async () => {
      el.schema = nestedSchema;
      el.data = { address: { street: '123 Main St', city: 'Springfield' } };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="text"]');
      expect(inputs.length).toBe(2);
      expect(inputs[0]!.value).toBe('123 Main St');
      expect(inputs[1]!.value).toBe('Springfield');
    });

    it('emits change with merged nested value', async () => {
      el.schema = nestedSchema;
      el.data = { address: { street: '123 Main St', city: 'Springfield' } };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const handler = vi.fn();
      el.addEventListener('pages-form-change', handler);
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[id="city"]')!;
      input.value = 'Shelbyville';
      input.dispatchEvent(new Event('input'));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0].detail.key).toBe('address');
      expect(handler.mock.calls[0]?.[0].detail.value).toEqual({ street: '123 Main St', city: 'Shelbyville' });
    });
  });

  describe('arrays', () => {
    const arraySchema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    };

    it('renders array items as comma-separated in display mode', async () => {
      el.schema = arraySchema;
      el.data = { tags: ['red', 'green', 'blue'] };
      el.mode = 'display';
      await (el as any).updateComplete;
      expect(el.shadowRoot!.textContent).toContain('red, green, blue');
    });

    it('renders editable inputs for each array item', async () => {
      el.schema = arraySchema;
      el.data = { tags: ['alpha', 'beta'] };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('.array-item-inline input');
      expect(inputs.length).toBe(2);
      expect(inputs[0]!.value).toBe('alpha');
      expect(inputs[1]!.value).toBe('beta');
    });

    it('adds an item when add button is clicked', async () => {
      el.schema = arraySchema;
      el.data = { tags: ['one'] };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const handler = vi.fn();
      el.addEventListener('pages-form-change', handler);
      const addBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.array-add')!;
      addBtn.click();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0].detail.value).toEqual(['one', '']);
    });

    it('removes an item when remove button is clicked', async () => {
      el.schema = arraySchema;
      el.data = { tags: ['a', 'b', 'c'] };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const handler = vi.fn();
      el.addEventListener('pages-form-change', handler);
      const removeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.array-remove')!;
      removeBtn.click();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0].detail.value).toEqual(['b', 'c']);
    });

    it('renders object array items with nested fields', async () => {
      const objArraySchema = {
        type: 'object',
        properties: {
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, role: { type: 'string' } },
            },
          },
        },
      };
      el.schema = objArraySchema;
      el.data = { contacts: [{ name: 'Alice', role: 'Lead' }] };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('.array-item input[type="text"]');
      expect(inputs.length).toBe(2);
      expect(inputs[0]!.value).toBe('Alice');
      expect(inputs[1]!.value).toBe('Lead');
    });
  });

  describe('date fields', () => {
    const dateSchema = {
      type: 'object',
      properties: {
        born: { type: 'string', format: 'date' },
        created: { type: 'string', format: 'date-time' },
      },
    };

    it('renders formatted date in display mode', async () => {
      el.schema = dateSchema;
      el.data = { born: '2000-01-15', created: '2026-07-06T14:30:00Z' };
      el.mode = 'display';
      await (el as any).updateComplete;
      const text = el.shadowRoot!.textContent!;
      expect(text).toContain('2000');
      expect(text).toContain('2026');
    });

    it('renders date input in edit mode', async () => {
      el.schema = dateSchema;
      el.data = { born: '2000-01-15', created: '2026-07-06T14:30:00Z' };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const dateInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="date"]');
      expect(dateInput).toBeTruthy();
      expect(dateInput!.value).toBe('2000-01-15');
    });

    it('renders datetime-local input in edit mode', async () => {
      el.schema = dateSchema;
      el.data = { born: '2000-01-15', created: '2026-07-06T14:30:00Z' };
      el.mode = 'edit';
      await (el as any).updateComplete;
      const dtInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="datetime-local"]');
      expect(dtInput).toBeTruthy();
    });
  });
});
