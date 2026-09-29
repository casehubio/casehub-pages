// Step Catalog Browser demo — showcases browsing step actions, schemas, try-it, and template generation.
// Mock fetch intercepts GraphQL catalog queries and execution endpoint.

var catalogActionsList = [
  { name: 'check-compliance', description: 'Check document compliance against a standard', invokeKind: 'rest', source: 'yaml', inputCount: 2, outputCount: 1 },
  { name: 'send-notification', description: 'Send a notification via MCP', invokeKind: 'mcp', source: 'mcp', inputCount: 3, outputCount: 0 },
  { name: 'run-audit', description: 'Execute a security audit script', invokeKind: 'script', source: 'script', inputCount: 1, outputCount: 2 },
  { name: 'classify-document', description: 'Classify a document using an AI agent', invokeKind: 'agent', source: 'yaml', inputCount: 2, outputCount: 3 },
  { name: 'fetch-market-data', description: 'Fetch latest market data via REST', invokeKind: 'rest', source: 'yaml', inputCount: 1, outputCount: 4 },
  { name: 'validate-schema', description: 'Validate a JSON schema against data', invokeKind: 'script', source: 'script', inputCount: 2, outputCount: 1 },
];

var catalogDetails = {
  'check-compliance': {
    name: 'check-compliance', description: 'Check document compliance against a standard',
    invokeKind: 'rest', source: 'yaml',
    inputs: {
      documentId: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: null, description: 'Document identifier' },
      standard: { type: 'STRING', required: true, defaultValue: 'ISO-27001', allowedValues: ['ISO-27001', 'SOC-2', 'GDPR'], format: null, description: 'Compliance standard to check' },
    },
    outputs: { compliant: { type: 'BOOLEAN', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Whether the document is compliant' } },
    invoke: { kind: 'rest', metadata: { method: 'POST', url: 'https://api.example.com/compliance/check' } },
  },
  'send-notification': {
    name: 'send-notification', description: 'Send a notification via MCP',
    invokeKind: 'mcp', source: 'mcp',
    inputs: {
      recipient: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: 'email', description: 'Recipient email' },
      subject: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: null, description: 'Notification subject' },
      body: { type: 'STRING', required: false, defaultValue: '', allowedValues: null, format: null, description: 'Notification body' },
    },
    outputs: {},
    invoke: { kind: 'mcp', metadata: { tool: 'notifications.send' } },
  },
  'run-audit': {
    name: 'run-audit', description: 'Execute a security audit script',
    invokeKind: 'script', source: 'script',
    inputs: { target: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: 'url', description: 'Target URL to audit' } },
    outputs: {
      score: { type: 'INTEGER', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Security score 0-100' },
      findings: { type: 'STRING', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Audit findings' },
    },
    invoke: { kind: 'script', metadata: { runtime: 'python3', script: 'scripts/security-audit.py' } },
  },
  'classify-document': {
    name: 'classify-document', description: 'Classify a document using an AI agent',
    invokeKind: 'agent', source: 'yaml',
    inputs: {
      documentUrl: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: 'url', description: 'URL of the document' },
      taxonomy: { type: 'STRING', required: false, defaultValue: 'default', allowedValues: ['default', 'legal', 'financial', 'medical'], format: null, description: 'Classification taxonomy' },
    },
    outputs: {
      category: { type: 'STRING', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Primary category' },
      confidence: { type: 'NUMBER', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Confidence score' },
      tags: { type: 'STRING', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Extracted tags' },
    },
    invoke: { kind: 'agent', metadata: { descriptor: 'document-classifier-v2' } },
  },
  'fetch-market-data': {
    name: 'fetch-market-data', description: 'Fetch latest market data via REST',
    invokeKind: 'rest', source: 'yaml',
    inputs: { symbol: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: null, description: 'Ticker symbol' } },
    outputs: {
      price: { type: 'NUMBER', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Current price' },
      change: { type: 'NUMBER', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Price change %' },
      volume: { type: 'INTEGER', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Trading volume' },
      timestamp: { type: 'STRING', required: false, defaultValue: null, allowedValues: null, format: 'datetime', description: 'Data timestamp' },
    },
    invoke: { kind: 'rest', metadata: { method: 'GET', url: 'https://api.example.com/market/{symbol}' } },
  },
  'validate-schema': {
    name: 'validate-schema', description: 'Validate a JSON schema against data',
    invokeKind: 'script', source: 'script',
    inputs: {
      schema: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: null, description: 'JSON schema' },
      data: { type: 'STRING', required: true, defaultValue: null, allowedValues: null, format: null, description: 'Data to validate' },
    },
    outputs: { valid: { type: 'BOOLEAN', required: false, defaultValue: null, allowedValues: null, format: null, description: 'Whether valid' } },
    invoke: { kind: 'script', metadata: { runtime: 'node', script: 'scripts/validate-schema.js' } },
  },
};

var mockResults = {
  'check-compliance': { kind: 'success', output: { compliant: true }, executionMetadata: { durationMs: 234 } },
  'send-notification': { kind: 'success', output: {}, executionMetadata: { durationMs: 89 } },
  'run-audit': { kind: 'success', output: { score: 87, findings: 'No critical issues found. 2 low-severity findings.' }, executionMetadata: { durationMs: 4521 } },
  'classify-document': { kind: 'success', output: { category: 'legal-contract', confidence: 0.94, tags: 'NDA, confidentiality, bilateral' }, executionMetadata: { durationMs: 1832 } },
  'fetch-market-data': { kind: 'success', output: { price: 182.63, change: 1.24, volume: 52340000, timestamp: '2026-09-29T10:30:00Z' }, executionMetadata: { durationMs: 156 } },
  'validate-schema': { kind: 'failure', message: 'Validation failed: data.age must be integer, got string' },
};

var _origFetch = window.fetch;
window.fetch = function(url, opts) {
  var urlStr = typeof url === 'string' ? url : url.toString();

  if (urlStr.includes('/graphql') && opts && opts.method === 'POST') {
    var body = JSON.parse(opts.body || '{}');
    var query = body.query || '';

    if (query.includes('catalogAction(')) {
      var nameMatch = query.match(/name:\s*"([^"]+)"/);
      var actionName = nameMatch ? nameMatch[1] : '';
      return Promise.resolve({
        ok: true,
        json: function() { return Promise.resolve({ data: { catalogAction: catalogDetails[actionName] || null } }); },
      });
    }
    if (query.includes('catalogActions')) {
      return Promise.resolve({
        ok: true,
        json: function() { return Promise.resolve({ data: { catalogActions: catalogActionsList } }); },
      });
    }
  }

  if (urlStr.includes('/scenario/catalog/execute') && opts && opts.method === 'POST') {
    var execBody = JSON.parse(opts.body || '{}');
    var result = mockResults[execBody.actionName] || { kind: 'failure', message: 'Unknown action: ' + execBody.actionName };
    return new Promise(function(resolve) {
      setTimeout(function() {
        resolve({ ok: true, json: function() { return Promise.resolve(result); } });
      }, 500 + Math.random() * 1000);
    });
  }

  return _origFetch.apply(window, arguments);
};

customElements.whenDefined('pages-step-catalog').then(function() {
  var catalogEl = document.getElementById('step-catalog');
  if (catalogEl) {
    catalogEl.baseUrl = '';
    catalogEl.execBaseUrl = '';
    catalogEl.loadCatalog();

    catalogEl.addEventListener('step-template-selected', function(e) {
      var output = document.getElementById('template-output');
      var badge = document.getElementById('template-badge');
      if (output) output.textContent = e.detail.yaml;
      if (badge) {
        badge.style.display = 'inline';
        badge.textContent = 'Copied';
        setTimeout(function() { badge.style.display = 'none'; }, 2000);
      }
    });
  }
});
