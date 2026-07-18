import type { PagesSchemaForm } from '@casehubio/pages-form';
import { registerFieldRenderer } from '@casehubio/pages-form';

// ── Schema ──────────────────────────────────────────────────
// Exercises every field type: string, number, boolean, enum,
// date, date-time, textarea, nested object, and array.

const schema = {
  type: 'object',
  properties: {
    // string
    transactionId: { type: 'string' },
    // number
    amount: { type: 'number' },
    // enum (renders <select>)
    currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
    // boolean (renders <checkbox>)
    flagged: { type: 'boolean' },
    // date (renders <input type="date">)
    reportDate: { type: 'string', format: 'date' },
    // date-time (renders <input type="datetime-local">)
    detectedAt: { type: 'string', format: 'date-time' },
    // long string → textarea (maxLength > 200)
    notes: { type: 'string', maxLength: 500 },
    // nested object — renders sub-fields recursively
    parties: {
      type: 'object',
      properties: {
        sender: { type: 'string' },
        receiver: { type: 'string' },
      },
    },
    // array of strings — add/remove items
    tags: { type: 'array', items: { type: 'string' } },
    // array of objects — add/remove structured items
    linkedTransactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          amount: { type: 'number' },
        },
      },
    },
  },
  required: ['transactionId', 'amount'],
};

// ── Data ────────────────────────────────────────────────────

const data = {
  transactionId: 'TXN-2026-04521',
  amount: 125000,
  currency: 'USD',
  flagged: true,
  reportDate: '2026-07-06',
  detectedAt: '2026-07-06T14:30:00Z',
  notes: 'Multiple rapid transfers to high-risk jurisdictions.',
  parties: { sender: 'Acme Holdings Ltd', receiver: 'Shell Corp 42 LLC' },
  tags: ['high-risk', 'cross-border', 'layering'],
  linkedTransactions: [
    { id: 'TXN-2026-04519', amount: 50000 },
    { id: 'TXN-2026-04520', amount: 75000 },
  ],
};

// ── Display mode ────────────────────────────────────────────
// Read-only formatted view — dates are locale-formatted,
// booleans show Yes/No, nested objects indent, arrays list.

const displayForm = document.createElement('pages-schema-form') as PagesSchemaForm;
displayForm.schema = schema;
displayForm.data = data;
displayForm.mode = 'display';

// ── Edit mode ───────────────────────────────────────────────
// Interactive form with per-field change events.

const editForm = document.createElement('pages-schema-form') as PagesSchemaForm;
editForm.schema = schema;
editForm.data = data;
editForm.mode = 'edit';

// Per-field change events
editForm.addEventListener('pages-form-change', (e: Event) => {
  const { key, value, data } = (e as CustomEvent).detail;
  console.log(`Field "${key}" changed:`, value);
  console.log('Current form state:', data);
});

// Submit event (fired by programmatic submit() call)
editForm.addEventListener('pages-form-submit', (e: Event) => {
  const { data } = (e as CustomEvent).detail;
  console.log('Form submitted:', data);
});

// ── Submit with validation ──────────────────────────────────
// Returns null if required fields are missing.

const result = editForm.submit();
if (result === null) {
  console.log('Validation failed — required fields missing');
} else {
  console.log('Submitted data:', result);
}

// ── Custom format renderer ──────────────────────────────────
// Register a Web Component to handle a specific schema format.
// When a field has format: 'currency', the registered element
// renders instead of the default input.

class CurrencyRenderer extends HTMLElement {
  value: unknown;
  schema: unknown;
  mode: 'display' | 'edit' = 'display';

  connectedCallback() {
    const amount = typeof this.value === 'number' ? this.value : 0;
    this.textContent = this.mode === 'display'
      ? `$${amount.toLocaleString()}`
      : `${amount}`;
  }
}
customElements.define('currency-renderer', CurrencyRenderer);

registerFieldRenderer('currency', CurrencyRenderer as any);
