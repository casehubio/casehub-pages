var IB_EXAMPLES = [
  {
    name: 'REST',
    tags: ['rest', 'http', 'request'],
    description: 'REST binding — invoke an HTTP endpoint. Supports GET, POST, PUT, DELETE with headers and body. The mock executor simulates a GET request to a users API and a POST to create an order.',
    yaml: [
      '- rest-request:',
      '    method: GET',
      '    url: /api/users',
      '    headers: { Accept: application/json }',
      '- log: { message: "Fetched user list" }',
      '- rest-request:',
      '    method: POST',
      '    url: /api/orders',
      '    headers: { Content-Type: application/json }',
      '    body: { item: "widget", qty: 5 }',
      '- log: { message: "Order created" }',
    ].join('\n'),
    steps: [
      { 'rest-request': { method: 'GET', url: '/api/users', headers: '{ Accept: application/json }' } },
      { log: { message: 'Fetched user list' } },
      { 'rest-request': { method: 'POST', url: '/api/orders', headers: '{ Content-Type: application/json }', body: '{ item: widget, qty: 5 }' } },
      { log: { message: 'Order created' } },
    ],
  },
  {
    name: 'MCP',
    tags: ['mcp', 'tool-call', 'model-context'],
    description: 'MCP binding — invoke a Model Context Protocol tool. The mock executor simulates calling a file_search tool and a code_review tool, returning structured results.',
    yaml: [
      '- mcp-call:',
      '    tool: file_search',
      '    params: { query: "authentication handler", limit: 5 }',
      '- log: { message: "Search complete" }',
      '- mcp-call:',
      '    tool: code_review',
      '    params: { file: "src/auth.ts", focus: "security" }',
      '- log: { message: "Review complete" }',
    ].join('\n'),
    steps: [
      { 'mcp-call': { tool: 'file_search', query: 'authentication handler', limit: 5 } },
      { log: { message: 'Search complete' } },
      { 'mcp-call': { tool: 'code_review', file: 'src/auth.ts', focus: 'security' } },
      { log: { message: 'Review complete' } },
    ],
  },
  {
    name: 'GraphQL',
    tags: ['graphql', 'query', 'mutation'],
    description: 'GraphQL binding — execute a query or mutation against a GraphQL endpoint. The mock executor simulates a users query and a createUser mutation with realistic response shapes.',
    yaml: [
      '- graphql-exec:',
      '    query: "{ users { id name email } }"',
      '- log: { message: "Query executed" }',
      '- graphql-exec:',
      '    query: "mutation { createUser(name: \\"Alice\\") { id } }"',
      '- log: { message: "Mutation executed" }',
    ].join('\n'),
    steps: [
      { 'graphql-exec': { query: '{ users { id name email } }' } },
      { log: { message: 'Query executed' } },
      { 'graphql-exec': { query: 'mutation { createUser(name: "Alice") { id } }' } },
      { log: { message: 'Mutation executed' } },
    ],
  },
  {
    name: 'Script',
    tags: ['script', 'inline', 'runtime'],
    description: 'Script binding — execute an inline script in a specified runtime (python3, node). The mock executor simulates running a Python data-processing script and a Node.js validation script.',
    yaml: [
      '- script-run:',
      '    runtime: python3',
      '    script: "import json; print(json.dumps({\'status\': \'ok\'}))"',
      '    timeout: 30s',
      '- log: { message: "Python script done" }',
      '- script-run:',
      '    runtime: node',
      '    script: "console.log(JSON.stringify({ valid: true }))"',
      '    timeout: 10s',
      '- log: { message: "Node script done" }',
    ].join('\n'),
    steps: [
      { 'script-run': { runtime: 'python3', script: "import json; print(json.dumps({'status': 'ok'}))", timeout: '30s' } },
      { log: { message: 'Python script done' } },
      { 'script-run': { runtime: 'node', script: 'console.log(JSON.stringify({ valid: true }))', timeout: '10s' } },
      { log: { message: 'Node script done' } },
    ],
  },
  {
    name: 'Agent',
    tags: ['agent', 'delegation', 'llm'],
    description: 'Agent binding — delegate work to an AI agent. The mock executor simulates dispatching a summarisation task and a code-generation task, returning structured output.',
    yaml: [
      '- agent-delegate:',
      '    descriptor: summarizer',
      '    model: claude-sonnet-5',
      '    structuredOutput: true',
      '    params: { text: "Long document content...", maxLength: 100 }',
      '- log: { message: "Summary generated" }',
      '- agent-delegate:',
      '    descriptor: code-gen',
      '    model: claude-opus-5',
      '    structuredOutput: true',
      '    params: { spec: "REST endpoint for user CRUD" }',
      '- log: { message: "Code generated" }',
    ].join('\n'),
    steps: [
      { 'agent-delegate': { descriptor: 'summarizer', model: 'claude-sonnet-5', text: 'Long document content...', maxLength: 100 } },
      { log: { message: 'Summary generated' } },
      { 'agent-delegate': { descriptor: 'code-gen', model: 'claude-opus-5', spec: 'REST endpoint for user CRUD' } },
      { log: { message: 'Code generated' } },
    ],
  },
  {
    name: 'Process',
    tags: ['process', 'os', 'command'],
    description: 'Process binding — execute an OS process. The mock executor simulates running ls and git status commands, capturing stdout and exit codes.',
    yaml: [
      '- process-exec:',
      '    command: ls',
      '    args: [-la, src/]',
      '    output: stdout',
      '    timeout: 10s',
      '- log: { message: "Directory listed" }',
      '- process-exec:',
      '    command: git',
      '    args: [status, --short]',
      '    output: stdout',
      '- log: { message: "Git status captured" }',
    ].join('\n'),
    steps: [
      { 'process-exec': { command: 'ls', args: '-la src/', output: 'stdout', timeout: '10s' } },
      { log: { message: 'Directory listed' } },
      { 'process-exec': { command: 'git', args: 'status --short', output: 'stdout' } },
      { log: { message: 'Git status captured' } },
    ],
  },
];

var ibTraceEl = document.getElementById('ib-trace');
var ibStateEl = document.getElementById('ib-state');
var ibResultEl = document.getElementById('ib-result');
var ibCountEl = document.getElementById('ib-count');
var ibOutputEl = document.getElementById('ib-output');
var ibYamlEl = document.getElementById('ib-yaml-source');
var ibDescEl = document.getElementById('ib-description');
var ibPicker = document.getElementById('ib-example-picker');
var ibRunBtn = document.getElementById('ib-run-btn');
var ibStepCount = 0;

function ibTrace(msg, status) {
  if (!ibTraceEl) return;
  var line = document.createElement('div');
  line.textContent = '[' + String(ibStepCount).padStart(2, '0') + ']  ' + msg.padEnd(48) + status;
  line.style.color = status === '✓' ? '#4ade80' : status === '✗' ? '#ef4444' : '#f59e0b';
  ibTraceEl.appendChild(line);
  ibTraceEl.scrollTop = ibTraceEl.scrollHeight;
}

function ibResetUI() {
  if (ibTraceEl) ibTraceEl.innerHTML = '';
  if (ibOutputEl) ibOutputEl.innerHTML = '<div style="color: var(--pages-neutral-7);">Run an example to see output</div>';
  if (ibStateEl) { ibStateEl.textContent = 'idle'; ibStateEl.style.color = '#4ade80'; }
  if (ibResultEl) { ibResultEl.textContent = '—'; ibResultEl.style.color = '#3b82f6'; }
  ibStepCount = 0;
  if (ibCountEl) ibCountEl.textContent = '0';
}

function ibShowExample(idx) {
  var ex = IB_EXAMPLES[idx];
  if (!ex) return;
  if (ibYamlEl) ibYamlEl.value = ex.yaml;
  if (ibDescEl) {
    ibDescEl.innerHTML = '';
    if (ex.tags && ex.tags.length > 0) {
      var tagSpan = document.createElement('span');
      tagSpan.style.cssText = 'display: inline-flex; gap: 4px; margin-right: 6px; vertical-align: middle;';
      ex.tags.forEach(function(t) {
        var chip = document.createElement('span');
        chip.textContent = t;
        chip.style.cssText = 'padding: 1px 6px; border-radius: 3px; background: var(--pages-accent-3); color: var(--pages-accent-9); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;';
        tagSpan.appendChild(chip);
      });
      ibDescEl.appendChild(tagSpan);
    }
    ibDescEl.appendChild(document.createTextNode(ex.description));
  }
}

function ibDelay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

var REST_MOCK = {
  'GET /api/users': { status: 200, body: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
  'POST /api/orders': { status: 201, body: { orderId: 'ORD-4782', item: 'widget', qty: 5 } },
};

var MCP_MOCK = {
  'file_search': { results: [{ file: 'src/auth/handler.ts', score: 0.94 }, { file: 'src/auth/middleware.ts', score: 0.87 }] },
  'code_review': { findings: [{ severity: 'warning', message: 'Token expiry not validated', line: 42 }] },
};

var GQL_MOCK = {
  'query': { data: { users: [{ id: '1', name: 'Alice', email: 'alice@example.com' }, { id: '2', name: 'Bob', email: 'bob@example.com' }] } },
  'mutation': { data: { createUser: { id: '3' } } },
};

async function ibRunExample(idx) {
  ibResetUI();
  var ex = IB_EXAMPLES[idx];
  if (!ex) return;

  if (ibStateEl) { ibStateEl.textContent = 'running'; ibStateEl.style.color = '#3b82f6'; }

  var cp = window.casehubPages;
  if (!cp || !cp.createStepRunner) {
    ibTrace('createStepRunner not available in bundle', '✗');
    if (ibStateEl) { ibStateEl.textContent = 'error'; ibStateEl.style.color = '#ef4444'; }
    return;
  }

  var outputs = [];

  var runner = cp.createStepRunner([
    {
      name: 'log',
      inputs: { message: { type: 'STRING', required: true } },
      execute: async function(params) {
        ibStepCount++;
        if (ibCountEl) ibCountEl.textContent = String(ibStepCount);
        var msg = params.message || '?';
        outputs.push(msg);
        ibTrace(msg, '✓');
        await ibDelay(200);
        return runner.stepSuccess({ logged: msg });
      }
    },
    {
      name: 'rest-request',
      inputs: { method: { type: 'STRING', required: true }, url: { type: 'STRING', required: true }, headers: { type: 'STRING', required: false }, body: { type: 'STRING', required: false } },
      execute: async function(params) {
        ibStepCount++;
        if (ibCountEl) ibCountEl.textContent = String(ibStepCount);
        var key = params.method + ' ' + params.url;
        ibTrace('→ ' + key, '⚠');
        await ibDelay(400);
        var mock = REST_MOCK[key] || { status: 200, body: {} };
        var msg = key + ' → ' + mock.status + ' ' + JSON.stringify(mock.body);
        outputs.push(msg);
        ibTrace('← ' + mock.status + ' ' + JSON.stringify(mock.body), '✓');
        return runner.stepSuccess({ status: mock.status, body: mock.body });
      }
    },
    {
      name: 'mcp-call',
      inputs: { tool: { type: 'STRING', required: true }, query: { type: 'STRING', required: false }, file: { type: 'STRING', required: false }, focus: { type: 'STRING', required: false }, limit: { type: 'NUMBER', required: false } },
      execute: async function(params) {
        ibStepCount++;
        if (ibCountEl) ibCountEl.textContent = String(ibStepCount);
        ibTrace('→ mcp.' + params.tool + '()', '⚠');
        await ibDelay(500);
        var mock = MCP_MOCK[params.tool] || { result: 'ok' };
        var msg = 'mcp.' + params.tool + ' → ' + JSON.stringify(mock);
        outputs.push(msg);
        ibTrace('← ' + JSON.stringify(mock), '✓');
        return runner.stepSuccess(mock);
      }
    },
    {
      name: 'graphql-exec',
      inputs: { query: { type: 'STRING', required: true } },
      execute: async function(params) {
        ibStepCount++;
        if (ibCountEl) ibCountEl.textContent = String(ibStepCount);
        var isMutation = params.query.indexOf('mutation') === 0;
        ibTrace('→ graphql ' + (isMutation ? 'mutation' : 'query'), '⚠');
        await ibDelay(400);
        var mock = GQL_MOCK[isMutation ? 'mutation' : 'query'];
        var msg = 'graphql → ' + JSON.stringify(mock);
        outputs.push(msg);
        ibTrace('← ' + JSON.stringify(mock.data), '✓');
        return runner.stepSuccess(mock);
      }
    },
    {
      name: 'script-run',
      inputs: { runtime: { type: 'STRING', required: true }, script: { type: 'STRING', required: true }, timeout: { type: 'STRING', required: false } },
      execute: async function(params) {
        ibStepCount++;
        if (ibCountEl) ibCountEl.textContent = String(ibStepCount);
        ibTrace('→ ' + params.runtime + ': ' + params.script.substring(0, 40) + '...', '⚠');
        await ibDelay(600);
        var result = params.runtime === 'python3'
          ? { stdout: '{"status": "ok"}', exitCode: 0 }
          : { stdout: '{"valid":true}', exitCode: 0 };
        var msg = params.runtime + ' → exit=' + result.exitCode + ' stdout=' + result.stdout;
        outputs.push(msg);
        ibTrace('← exit=' + result.exitCode + ' ' + result.stdout, '✓');
        return runner.stepSuccess(result);
      }
    },
    {
      name: 'agent-delegate',
      inputs: { descriptor: { type: 'STRING', required: true }, model: { type: 'STRING', required: false }, text: { type: 'STRING', required: false }, maxLength: { type: 'NUMBER', required: false }, spec: { type: 'STRING', required: false } },
      execute: async function(params) {
        ibStepCount++;
        if (ibCountEl) ibCountEl.textContent = String(ibStepCount);
        ibTrace('→ agent(' + params.descriptor + ') model=' + (params.model || 'default'), '⚠');
        await ibDelay(800);
        var result = params.descriptor === 'summarizer'
          ? { summary: 'Document discusses key architectural decisions...', tokens: 47 }
          : { code: 'app.get("/users", handler)', language: 'typescript', lines: 42 };
        var msg = 'agent(' + params.descriptor + ') → ' + JSON.stringify(result);
        outputs.push(msg);
        ibTrace('← ' + JSON.stringify(result), '✓');
        return runner.stepSuccess(result);
      }
    },
    {
      name: 'process-exec',
      inputs: { command: { type: 'STRING', required: true }, args: { type: 'STRING', required: false }, output: { type: 'STRING', required: false }, timeout: { type: 'STRING', required: false } },
      execute: async function(params) {
        ibStepCount++;
        if (ibCountEl) ibCountEl.textContent = String(ibStepCount);
        ibTrace('→ $ ' + params.command + ' ' + (params.args || ''), '⚠');
        await ibDelay(300);
        var result = params.command === 'ls'
          ? { stdout: 'total 48\ndrwxr-xr-x  6 user staff  192 Sep 28 auth/\ndrwxr-xr-x  4 user staff  128 Sep 28 api/', exitCode: 0 }
          : { stdout: ' M src/auth.ts\n?? src/new-feature.ts', exitCode: 0 };
        var msg = '$ ' + params.command + ' → exit=' + result.exitCode;
        outputs.push(msg);
        ibTrace('← exit=' + result.exitCode, '✓');
        outputs.push(result.stdout);
        ibTrace(result.stdout.split('\n')[0], '✓');
        return runner.stepSuccess(result);
      }
    },
  ]);

  try {
    var results = await runner.run(ex.steps);

    for (var i = 0; i < results.length; i++) {
      if (results[i].kind === 'failure') {
        ibTrace('Step failed: ' + results[i].message, '⚠');
      }
    }

    if (ibOutputEl) {
      ibOutputEl.innerHTML = '';
      outputs.forEach(function(o) {
        var div = document.createElement('div');
        div.textContent = '→ ' + o;
        div.style.color = 'var(--pages-neutral-10)';
        ibOutputEl.appendChild(div);
      });
    }

    if (ibStateEl) { ibStateEl.textContent = 'done'; ibStateEl.style.color = '#4ade80'; }
    if (ibResultEl) { ibResultEl.textContent = 'success'; ibResultEl.style.color = '#4ade80'; }
  } catch (err) {
    ibTrace('Error: ' + (err.message || err), '✗');
    if (ibStateEl) { ibStateEl.textContent = 'error'; ibStateEl.style.color = '#ef4444'; }
    if (ibResultEl) { ibResultEl.textContent = 'error'; ibResultEl.style.color = '#ef4444'; }
  }
}

if (ibPicker) {
  ibPicker.addEventListener('change', function() {
    ibResetUI();
    ibShowExample(parseInt(ibPicker.value, 10));
  });
}

if (ibRunBtn) {
  ibRunBtn.addEventListener('click', function() {
    ibRunExample(ibPicker ? parseInt(ibPicker.value, 10) : 0);
  });
}

ibShowExample(0);
