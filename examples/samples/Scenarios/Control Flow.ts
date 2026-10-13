var SW_EXAMPLES = [
  {
    name: 'Block (sequential)',
    tags: ['block', 'sequential'],
    description: 'A block groups steps that execute sequentially. Each step runs only after the previous one succeeds.',
    yaml: [
      '- block:',
      '  - log: { message: "Step 1: initialize" }',
      '  - log: { message: "Step 2: process" }',
      '  - log: { message: "Step 3: finalize" }',
    ].join('\n'),
    steps: [
      { block: [
        { log: { message: 'Step 1: initialize' } },
        { log: { message: 'Step 2: process' } },
        { log: { message: 'Step 3: finalize' } },
      ] },
    ],
  },
  {
    name: 'Parallel',
    tags: ['parallel', 'concurrent'],
    description: 'Parallel runs multiple steps concurrently. All branches execute simultaneously — the step completes when all branches finish.',
    yaml: [
      '- parallel:',
      '  - log: { message: "Branch A: fetching data" }',
      '  - log: { message: "Branch B: loading config" }',
      '  - log: { message: "Branch C: warming cache" }',
    ].join('\n'),
    steps: [
      { parallel: [
        { log: { message: 'Branch A: fetching data' } },
        { log: { message: 'Branch B: loading config' } },
        { log: { message: 'Branch C: warming cache' } },
      ] },
    ],
  },
  {
    name: 'If / Else',
    tags: ['if', 'else', 'conditional'],
    description: 'Conditional branching — evaluates a condition, runs then-steps if truthy, else-steps otherwise. Conditions use the truthiness evaluator.',
    yaml: [
      '- if: true',
      '  then:',
      '    - log: { message: "Condition was true" }',
      '  else:',
      '    - log: { message: "Condition was false" }',
      '- if: false',
      '  then:',
      '    - log: { message: "This is skipped" }',
      '  else:',
      '    - log: { message: "False branch taken" }',
    ].join('\n'),
    steps: [
      { if: 'true', then: [{ log: { message: 'Condition was true' } }], else: [{ log: { message: 'Condition was false' } }] },
      { if: 'false', then: [{ log: { message: 'This is skipped' } }], else: [{ log: { message: 'False branch taken' } }] },
    ],
  },
  {
    name: 'Match / Cases',
    tags: ['match', 'pattern matching', 'cases'],
    description: 'Pattern matching with value, structural, any-of, and default patterns. The first matching case executes; later cases are skipped.',
    yaml: [
      '- match: "warning"',
      '  cases:',
      '    - pattern: "error"',
      '      log: { message: "Matched: error" }',
      '    - pattern: "warning"',
      '      log: { message: "Matched: warning" }',
      '    - default:',
      '        - log: { message: "No match — default" }',
    ].join('\n'),
    steps: [
      { match: 'warning', cases: [
        { pattern: 'error', log: { message: 'Matched: error' } },
        { pattern: 'warning', log: { message: 'Matched: warning' } },
        { default: [{ log: { message: 'No match — default' } }] },
      ] },
    ],
  },
  {
    name: 'Try / Catch / Finally',
    tags: ['try', 'catch', 'finally', 'error handling'],
    description: 'Structured error handling. Try-steps execute first; if any fails, catch-steps run. Finally-steps always execute regardless of outcome.',
    yaml: [
      '- try:',
      '    - log: { message: "Attempting risky operation" }',
      '    - fail: { message: "Something went wrong" }',
      '  catch:',
      '    - log: { message: "Caught error — recovering" }',
      '  finally:',
      '    - log: { message: "Cleanup — always runs" }',
    ].join('\n'),
    steps: [
      { try: [
        { log: { message: 'Attempting risky operation' } },
        { fail: { message: 'Something went wrong' } },
      ], catch: [
        { log: { message: 'Caught error — recovering' } },
      ], finally: [
        { log: { message: 'Cleanup — always runs' } },
      ] },
    ],
  },
  {
    name: 'Barrier',
    tags: ['barrier', 'await', 'dependency'],
    description: 'A barrier blocks until all named steps have completed. Use it to express "wait for A and B before proceeding."',
    yaml: [
      '- step: fetch-data',
      '  log: { message: "Fetching data" }',
      '- step: load-config',
      '  log: { message: "Loading config" }',
      '- barrier:',
      '    await: [fetch-data, load-config]',
      '- log: { message: "Both done — proceeding" }',
    ].join('\n'),
    steps: [
      { step: 'fetch-data', log: { message: 'Fetching data' } },
      { step: 'load-config', log: { message: 'Loading config' } },
      { barrier: { await: ['fetch-data', 'load-config'] } },
      { log: { message: 'Both done — proceeding' } },
    ],
  },
  {
    name: 'Quorum',
    tags: ['quorum', 'n-of-m', 'partial completion'],
    description: 'Quorum succeeds when N of M named steps have completed — does not require all. Use for "any 2 of 3" patterns.',
    yaml: [
      '- step: primary',
      '  log: { message: "Primary completed" }',
      '- step: secondary',
      '  log: { message: "Secondary completed" }',
      '- step: tertiary',
      '  log: { message: "Tertiary completed" }',
      '- quorum:',
      '    required: 2',
      '    of: [primary, secondary, tertiary]',
      '- log: { message: "Quorum met — 2 of 3 done" }',
    ].join('\n'),
    steps: [
      { step: 'primary', log: { message: 'Primary completed' } },
      { step: 'secondary', log: { message: 'Secondary completed' } },
      { step: 'tertiary', log: { message: 'Tertiary completed' } },
      { quorum: { required: 2, of: ['primary', 'secondary', 'tertiary'] } },
      { log: { message: 'Quorum met — 2 of 3 done' } },
    ],
  },
  {
    name: 'Select (first-to-complete)',
    tags: ['select', 'race', 'first-to-complete'],
    description: 'Select races multiple branches — the first to complete wins. Wait branches block on named signals; the first signal to fire determines which branch executes.',
    yaml: [
      '- select:',
      '  - wait: fast-signal',
      '    log: { message: "Fast branch won the race" }',
      '  - wait: slow-signal',
      '    log: { message: "Slow branch won the race" }',
    ].join('\n'),
    steps: [
      { select: [
        { wait: 'fast-signal', log: { message: 'Fast branch won the race' } },
        { wait: 'slow-signal', log: { message: 'Slow branch won the race' } },
      ] },
    ],
    preRun: function(runner) {
      runner.scope.signal('fast-signal').signal();
    },
  },
];

var swTraceEl = document.getElementById('sw-trace');
var swStateEl = document.getElementById('sw-state');
var swResultEl = document.getElementById('sw-result');
var swCountEl = document.getElementById('sw-count');
var swOutputEl = document.getElementById('sw-output');
var swYamlEl = document.getElementById('sw-yaml-source');
var swDescEl = document.getElementById('sw-description');
var swPicker = document.getElementById('sw-example-picker');
var swRunBtn = document.getElementById('sw-run-btn');
var swStepCount = 0;

function swTrace(msg, status) {
  if (!swTraceEl) return;
  var line = document.createElement('div');
  line.textContent = '[' + String(swStepCount).padStart(2, '0') + ']  ' + msg.padEnd(40) + status;
  line.style.color = status === '✓' ? '#4ade80' : status === '✗' ? '#ef4444' : '#f59e0b';
  swTraceEl.appendChild(line);
  swTraceEl.scrollTop = swTraceEl.scrollHeight;
}

function swResetUI() {
  if (swTraceEl) swTraceEl.innerHTML = '';
  if (swOutputEl) swOutputEl.innerHTML = '<div style="color: var(--pages-neutral-7);">Run an example to see output</div>';
  if (swStateEl) { swStateEl.textContent = 'idle'; swStateEl.style.color = '#4ade80'; }
  if (swResultEl) { swResultEl.textContent = '—'; swResultEl.style.color = '#3b82f6'; }
  swStepCount = 0;
  if (swCountEl) swCountEl.textContent = '0';
}

function swShowExample(idx) {
  var ex = SW_EXAMPLES[idx];
  if (!ex) return;
  if (swYamlEl) swYamlEl.value = ex.yaml;
  if (swDescEl) {
    swDescEl.innerHTML = '';
    if (ex.tags && ex.tags.length > 0) {
      var tagSpan = document.createElement('span');
      tagSpan.style.cssText = 'display: inline-flex; gap: 4px; margin-right: 6px; vertical-align: middle;';
      ex.tags.forEach(function(t) {
        var chip = document.createElement('span');
        chip.textContent = t;
        chip.style.cssText = 'padding: 1px 6px; border-radius: 3px; background: var(--pages-accent-3); color: var(--pages-accent-9); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;';
        tagSpan.appendChild(chip);
      });
      swDescEl.appendChild(tagSpan);
    }
    swDescEl.appendChild(document.createTextNode(ex.description));
  }
}

function swDelay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function swRunExample(idx) {
  swResetUI();
  var ex = SW_EXAMPLES[idx];
  if (!ex) return;

  if (swStateEl) { swStateEl.textContent = 'running'; swStateEl.style.color = '#3b82f6'; }

  var cp = window.casehubPages;
  if (!cp || !cp.createStepRunner) {
    swTrace('createStepRunner not available in bundle', '✗');
    if (swStateEl) { swStateEl.textContent = 'error'; swStateEl.style.color = '#ef4444'; }
    return;
  }

  var outputs = [];

  var runner = cp.createStepRunner([
    {
      name: 'log',
      inputs: { message: { type: 'STRING', required: true } },
      execute: async function(params) {
        swStepCount++;
        if (swCountEl) swCountEl.textContent = String(swStepCount);
        var msg = params.message || '?';
        outputs.push(msg);
        swTrace(msg, '✓');
        await swDelay(300);
        return runner.stepSuccess({ logged: msg });
      }
    },
    {
      name: 'fail',
      inputs: { message: { type: 'STRING', required: true } },
      execute: async function(params) {
        swStepCount++;
        if (swCountEl) swCountEl.textContent = String(swStepCount);
        var msg = params.message || 'failure';
        swTrace(msg, '✗');
        await swDelay(300);
        return runner.stepFailure(msg);
      }
    }
  ]);

  if (ex.preRun) ex.preRun(runner);

  try {
    var results = await runner.run(ex.steps);

    for (var i = 0; i < results.length; i++) {
      if (results[i].kind === 'failure') {
        swTrace('Step failed: ' + results[i].message, '⚠');
      }
    }

    if (swOutputEl) {
      swOutputEl.innerHTML = '';
      outputs.forEach(function(o) {
        var div = document.createElement('div');
        div.textContent = '→ ' + o;
        div.style.color = 'var(--pages-neutral-10)';
        swOutputEl.appendChild(div);
      });
    }

    if (swStateEl) { swStateEl.textContent = 'done'; swStateEl.style.color = '#4ade80'; }
    if (swResultEl) { swResultEl.textContent = 'success'; swResultEl.style.color = '#4ade80'; }
  } catch (err) {
    swTrace('Error: ' + (err.message || err), '✗');
    if (swStateEl) { swStateEl.textContent = 'error'; swStateEl.style.color = '#ef4444'; }
    if (swResultEl) { swResultEl.textContent = 'error'; swResultEl.style.color = '#ef4444'; }
  }
}

if (swPicker) {
  swPicker.addEventListener('change', function() {
    swResetUI();
    swShowExample(parseInt(swPicker.value, 10));
  });
}

if (swRunBtn) {
  swRunBtn.addEventListener('click', function() {
    swRunExample(swPicker ? parseInt(swPicker.value, 10) : 0);
  });
}

swShowExample(0);
