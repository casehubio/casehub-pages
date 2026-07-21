import type { PagesSchemaForm } from '@casehubio/pages-viz';

// Programmatic usage of pages-schema-form (the YAML DSL approach is preferred).
// This file demonstrates creating the component in code.

const schema = {
  properties: {
    transactionId: { type: 'string', minLength: 1 },
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
    flagged: { type: 'boolean' },
    reportDate: { type: 'string', format: 'date' },
    notes: { type: 'string', format: 'textarea' },
  },
  required: ['transactionId', 'amount'],
};

const form = document.createElement('pages-schema-form') as PagesSchemaForm;
form.props = { schema, excludeFields: ['id'] };
form.editable = true;

form.addEventListener('pages-field-change', (e: Event) => {
  const { field, value } = (e as CustomEvent).detail;
  console.log(`Field "${field}" changed:`, value);
});

form.addEventListener('pages-record-create', (e: Event) => {
  const { record } = (e as CustomEvent).detail;
  console.log('New record:', record);
});
