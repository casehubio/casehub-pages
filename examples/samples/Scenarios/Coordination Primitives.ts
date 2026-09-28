var CP_EXAMPLES = [
  {
    name: 'Counter',
    tags: ['counter', 'atomic', 'increment'],
    description: 'Atomic counter — increment, decrement, add, and read. Each named counter is a singleton within the scope, so multiple steps share the same state.',
    yaml: [
      'steps:',
      '  - counter-add: { name: "requests", delta: 1 }',
      '  - counter-add: { name: "requests", delta: 1 }',
      '  - counter-add: { name: "requests", delta: 3 }',
      '  - counter-get: { name: "requests" }',
      '  - counter-add: { name: "requests", delta: -2 }',
      '  - counter-get: { name: "requests" }',
    ].join('\n'),
    steps: [
      { 'counter-add': { name: 'requests', delta: 1 } },
      { 'counter-add': { name: 'requests', delta: 1 } },
      { 'counter-add': { name: 'requests', delta: 3 } },
      { 'counter-get': { name: 'requests' } },
      { 'counter-add': { name: 'requests', delta: -2 } },
      { 'counter-get': { name: 'requests' } },
    ],
  },
  {
    name: 'Flag',
    tags: ['flag', 'boolean', 'toggle'],
    description: 'Atomic boolean flag — set, clear, toggle, and check. Useful for signalling state changes between steps without passing data.',
    yaml: [
      'steps:',
      '  - flag-check: { name: "ready" }',
      '  - flag-set: { name: "ready" }',
      '  - flag-check: { name: "ready" }',
      '  - flag-toggle: { name: "ready" }',
      '  - flag-check: { name: "ready" }',
    ].join('\n'),
    steps: [
      { 'flag-check': { name: 'ready' } },
      { 'flag-set': { name: 'ready' } },
      { 'flag-check': { name: 'ready' } },
      { 'flag-toggle': { name: 'ready' } },
      { 'flag-check': { name: 'ready' } },
    ],
  },
  {
    name: 'Gauge',
    tags: ['gauge', 'value', 'compare-and-set'],
    description: 'Typed value holder with atomic compare-and-set. Unlike a counter, a gauge holds any value — use it for temperatures, levels, thresholds.',
    yaml: [
      'steps:',
      '  - gauge-set: { name: "temp", value: 20 }',
      '  - gauge-get: { name: "temp" }',
      '  - gauge-set: { name: "temp", value: 35 }',
      '  - gauge-get: { name: "temp" }',
      '  - gauge-cas: { name: "temp", expect: 35, update: 42 }',
      '  - gauge-get: { name: "temp" }',
    ].join('\n'),
    steps: [
      { 'gauge-set': { name: 'temp', value: 20 } },
      { 'gauge-get': { name: 'temp' } },
      { 'gauge-set': { name: 'temp', value: 35 } },
      { 'gauge-get': { name: 'temp' } },
      { 'gauge-cas': { name: 'temp', expect: 35, update: 42 } },
      { 'gauge-get': { name: 'temp' } },
    ],
  },
  {
    name: 'Accumulator',
    tags: ['accumulator', 'reduce', 'aggregate'],
    description: 'Reduce-style aggregation — feeds values through a binary operator (sum, product, min, max). The accumulator starts at an identity value and applies the operator for each accumulate call.',
    yaml: [
      'steps:',
      '  - accumulate: { name: "total", op: "sum", value: 10 }',
      '  - accumulate: { name: "total", op: "sum", value: 25 }',
      '  - accumulate: { name: "total", op: "sum", value: 7 }',
      '  - accumulate-get: { name: "total" }',
      '  - accumulate: { name: "max-seen", op: "max", value: 42 }',
      '  - accumulate: { name: "max-seen", op: "max", value: 17 }',
      '  - accumulate: { name: "max-seen", op: "max", value: 99 }',
      '  - accumulate-get: { name: "max-seen" }',
    ].join('\n'),
    steps: [
      { 'accumulate': { name: 'total', op: 'sum', value: 10 } },
      { 'accumulate': { name: 'total', op: 'sum', value: 25 } },
      { 'accumulate': { name: 'total', op: 'sum', value: 7 } },
      { 'accumulate-get': { name: 'total' } },
      { 'accumulate': { name: 'max-seen', op: 'max', value: 42 } },
      { 'accumulate': { name: 'max-seen', op: 'max', value: 17 } },
      { 'accumulate': { name: 'max-seen', op: 'max', value: 99 } },
      { 'accumulate-get': { name: 'max-seen' } },
    ],
  },
  {
    name: 'Latch',
    tags: ['latch', 'countdown', 'barrier'],
    description: 'Countdown latch — starts at N, each countDown() decrements by 1. When count reaches zero, all waiters are released. Unlike a barrier, a latch is one-shot: once tripped it stays open.',
    yaml: [
      'steps:',
      '  - latch-create: { name: "init-gate", count: 3 }',
      '  - latch-countdown: { name: "init-gate" }',
      '  - latch-status: { name: "init-gate" }',
      '  - latch-countdown: { name: "init-gate" }',
      '  - latch-countdown: { name: "init-gate" }',
      '  - latch-status: { name: "init-gate" }',
    ].join('\n'),
    steps: [
      { 'latch-create': { name: 'init-gate', count: 3 } },
      { 'latch-countdown': { name: 'init-gate' } },
      { 'latch-status': { name: 'init-gate' } },
      { 'latch-countdown': { name: 'init-gate' } },
      { 'latch-countdown': { name: 'init-gate' } },
      { 'latch-status': { name: 'init-gate' } },
    ],
  },
  {
    name: 'State Machine',
    tags: ['state-machine', 'transitions', 'guards'],
    description: 'Declarative state machine with transitions, guards, and lifecycle handlers. Define states and allowed transitions, then drive the machine through its lifecycle.',
    yaml: [
      'steps:',
      '  - sm-create: { name: "order", states: [draft, submitted, approved, rejected], initial: draft }',
      '  - sm-state: { name: "order" }',
      '  - sm-transition: { name: "order", from: draft, to: submitted }',
      '  - sm-state: { name: "order" }',
      '  - sm-transition: { name: "order", from: submitted, to: approved }',
      '  - sm-state: { name: "order" }',
    ].join('\n'),
    steps: [
      { 'sm-create': { name: 'order', states: ['draft', 'submitted', 'approved', 'rejected'], initial: 'draft' } },
      { 'sm-state': { name: 'order' } },
      { 'sm-transition': { name: 'order', from: 'draft', to: 'submitted' } },
      { 'sm-state': { name: 'order' } },
      { 'sm-transition': { name: 'order', from: 'submitted', to: 'approved' } },
      { 'sm-state': { name: 'order' } },
    ],
  },
];

var cpTraceEl = document.getElementById('cp-trace');
var cpStateEl = document.getElementById('cp-state');
var cpResultEl = document.getElementById('cp-result');
var cpCountEl = document.getElementById('cp-count');
var cpOutputEl = document.getElementById('cp-output');
var cpYamlEl = document.getElementById('cp-yaml-source');
var cpDescEl = document.getElementById('cp-description');
var cpPicker = document.getElementById('cp-example-picker');
var cpRunBtn = document.getElementById('cp-run-btn');
var cpStepCount = 0;

function cpTrace(msg, status) {
  if (!cpTraceEl) return;
  var line = document.createElement('div');
  line.textContent = '[' + String(cpStepCount).padStart(2, '0') + ']  ' + msg.padEnd(44) + status;
  line.style.color = status === '✓' ? '#4ade80' : status === '✗' ? '#ef4444' : '#f59e0b';
  cpTraceEl.appendChild(line);
  cpTraceEl.scrollTop = cpTraceEl.scrollHeight;
}

function cpResetUI() {
  if (cpTraceEl) cpTraceEl.innerHTML = '';
  if (cpOutputEl) cpOutputEl.innerHTML = '<div style="color: var(--pages-neutral-7);">Run an example to see output</div>';
  if (cpStateEl) { cpStateEl.textContent = 'idle'; cpStateEl.style.color = '#4ade80'; }
  if (cpResultEl) { cpResultEl.textContent = '—'; cpResultEl.style.color = '#3b82f6'; }
  cpStepCount = 0;
  if (cpCountEl) cpCountEl.textContent = '0';
}

function cpShowExample(idx) {
  var ex = CP_EXAMPLES[idx];
  if (!ex) return;
  if (cpYamlEl) cpYamlEl.value = ex.yaml;
  if (cpDescEl) {
    cpDescEl.innerHTML = '';
    if (ex.tags && ex.tags.length > 0) {
      var tagSpan = document.createElement('span');
      tagSpan.style.cssText = 'display: inline-flex; gap: 4px; margin-right: 6px; vertical-align: middle;';
      ex.tags.forEach(function(t) {
        var chip = document.createElement('span');
        chip.textContent = t;
        chip.style.cssText = 'padding: 1px 6px; border-radius: 3px; background: var(--pages-accent-3); color: var(--pages-accent-9); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;';
        tagSpan.appendChild(chip);
      });
      cpDescEl.appendChild(tagSpan);
    }
    cpDescEl.appendChild(document.createTextNode(ex.description));
  }
}

function cpDelay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

var OPS = {
  sum: function(a, b) { return a + b; },
  max: function(a, b) { return Math.max(a, b); },
  min: function(a, b) { return Math.min(a, b); },
  product: function(a, b) { return a * b; },
};
var OP_IDENTITY = { sum: 0, max: -1e99, min: 1e99, product: 1 };

async function cpRunExample(idx) {
  cpResetUI();
  var ex = CP_EXAMPLES[idx];
  if (!ex) return;

  if (cpStateEl) { cpStateEl.textContent = 'running'; cpStateEl.style.color = '#3b82f6'; }

  var cp = window.casehubPages;
  if (!cp || !cp.createStepRunner) {
    cpTrace('createStepRunner not available in bundle', '✗');
    if (cpStateEl) { cpStateEl.textContent = 'error'; cpStateEl.style.color = '#ef4444'; }
    return;
  }

  var outputs = [];

  var runner = cp.createStepRunner([
    {
      name: 'counter-add',
      inputs: { name: { type: 'STRING', required: true }, delta: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var c = runner.scope.counter(params.name);
        c.add(params.delta);
        var msg = 'counter(' + params.name + ') += ' + params.delta + ' → ' + c.get();
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: c.get() });
      }
    },
    {
      name: 'counter-get',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var c = runner.scope.counter(params.name);
        var msg = 'counter(' + params.name + ') = ' + c.get();
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: c.get() });
      }
    },
    {
      name: 'flag-set',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var f = runner.scope.flag(params.name);
        f.set();
        var msg = 'flag(' + params.name + ').set() → true';
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: true });
      }
    },
    {
      name: 'flag-clear',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var f = runner.scope.flag(params.name);
        f.clear();
        var msg = 'flag(' + params.name + ').clear() → false';
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: false });
      }
    },
    {
      name: 'flag-check',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var f = runner.scope.flag(params.name);
        var val = f.get();
        var msg = 'flag(' + params.name + ') = ' + val;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: val });
      }
    },
    {
      name: 'flag-toggle',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var f = runner.scope.flag(params.name);
        var newVal = f.toggle();
        var msg = 'flag(' + params.name + ').toggle() → ' + newVal;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: newVal });
      }
    },
    {
      name: 'gauge-set',
      inputs: { name: { type: 'STRING', required: true }, value: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var g = runner.scope.gauge(params.name, 0);
        g.set(params.value);
        var msg = 'gauge(' + params.name + ') := ' + params.value;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: params.value });
      }
    },
    {
      name: 'gauge-get',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var g = runner.scope.gauge(params.name, 0);
        var val = g.get();
        var msg = 'gauge(' + params.name + ') = ' + val;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: val });
      }
    },
    {
      name: 'gauge-cas',
      inputs: { name: { type: 'STRING', required: true }, expect: { type: 'NUMBER', required: true }, update: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var g = runner.scope.gauge(params.name, 0);
        var ok = g.compareAndSet(params.expect, params.update);
        var msg = 'gauge(' + params.name + ').cas(' + params.expect + ', ' + params.update + ') → ' + (ok ? 'swapped' : 'no match');
        outputs.push(msg);
        cpTrace(msg, ok ? '✓' : '⚠');
        await cpDelay(300);
        return runner.stepSuccess({ swapped: ok, value: g.get() });
      }
    },
    {
      name: 'accumulate',
      inputs: { name: { type: 'STRING', required: true }, op: { type: 'STRING', required: true }, value: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var opFn = OPS[params.op] || OPS.sum;
        var identity = OP_IDENTITY[params.op] !== undefined ? OP_IDENTITY[params.op] : 0;
        var acc = runner.scope.accumulator(params.name, opFn, identity);
        acc.accumulate(params.value);
        var msg = params.op + '(' + params.name + ') << ' + params.value + ' → ' + acc.get();
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: acc.get() });
      }
    },
    {
      name: 'accumulate-get',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var acc = runner.scope.accumulator(params.name, OPS.sum, 0);
        var val = acc.get();
        var msg = 'accumulator(' + params.name + ') = ' + val;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ value: val });
      }
    },
    {
      name: 'latch-create',
      inputs: { name: { type: 'STRING', required: true }, count: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        runner.scope.latch(params.name, params.count);
        var msg = 'latch(' + params.name + ') created with count=' + params.count;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ count: params.count });
      }
    },
    {
      name: 'latch-countdown',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var l = runner.scope.latch(params.name, 1);
        l.countDown();
        var remaining = l.getCount();
        var msg = 'latch(' + params.name + ').countDown() → remaining=' + remaining;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ remaining: remaining });
      }
    },
    {
      name: 'latch-status',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var l = runner.scope.latch(params.name, 1);
        var count = l.getCount();
        var tripped = count === 0;
        var msg = 'latch(' + params.name + ') count=' + count + (tripped ? ' (tripped)' : ' (waiting)');
        outputs.push(msg);
        cpTrace(msg, tripped ? '✓' : '⚠');
        await cpDelay(300);
        return runner.stepSuccess({ count: count, tripped: tripped });
      }
    },
    {
      name: 'sm-create',
      inputs: { name: { type: 'STRING', required: true }, states: { type: 'STRING', required: true }, initial: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var states = params.states;
        runner.scope.stateMachine(params.name, states, params.initial);
        var msg = 'sm(' + params.name + ') created: [' + states.join(', ') + '] initial=' + params.initial;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ state: params.initial });
      }
    },
    {
      name: 'sm-state',
      inputs: { name: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var sm = runner.scope.stateMachine(params.name, [], '');
        var state = sm.currentState();
        var msg = 'sm(' + params.name + ').state = ' + state;
        outputs.push(msg);
        cpTrace(msg, '✓');
        await cpDelay(300);
        return runner.stepSuccess({ state: state });
      }
    },
    {
      name: 'sm-transition',
      inputs: { name: { type: 'STRING', required: true }, from: { type: 'STRING', required: true }, to: { type: 'STRING', required: true } },
      execute: async function(params) {
        cpStepCount++;
        if (cpCountEl) cpCountEl.textContent = String(cpStepCount);
        var sm = runner.scope.stateMachine(params.name, [], '');
        var ok = sm.transition(params.from, params.to);
        var msg = 'sm(' + params.name + '): ' + params.from + ' → ' + params.to + (ok ? ' (ok)' : ' (rejected)');
        outputs.push(msg);
        cpTrace(msg, ok ? '✓' : '✗');
        await cpDelay(300);
        return ok ? runner.stepSuccess({ state: params.to }) : runner.stepFailure('Transition rejected');
      }
    },
  ]);

  try {
    var results = await runner.run(ex.steps);

    for (var i = 0; i < results.length; i++) {
      if (results[i].kind === 'failure') {
        cpTrace('Step failed: ' + results[i].message, '⚠');
      }
    }

    if (cpOutputEl) {
      cpOutputEl.innerHTML = '';
      outputs.forEach(function(o) {
        var div = document.createElement('div');
        div.textContent = '→ ' + o;
        div.style.color = 'var(--pages-neutral-10)';
        cpOutputEl.appendChild(div);
      });
    }

    if (cpStateEl) { cpStateEl.textContent = 'done'; cpStateEl.style.color = '#4ade80'; }
    if (cpResultEl) { cpResultEl.textContent = 'success'; cpResultEl.style.color = '#4ade80'; }
  } catch (err) {
    cpTrace('Error: ' + (err.message || err), '✗');
    if (cpStateEl) { cpStateEl.textContent = 'error'; cpStateEl.style.color = '#ef4444'; }
    if (cpResultEl) { cpResultEl.textContent = 'error'; cpResultEl.style.color = '#ef4444'; }
  }
}

if (cpPicker) {
  cpPicker.addEventListener('change', function() {
    cpResetUI();
    cpShowExample(parseInt(cpPicker.value, 10));
  });
}

if (cpRunBtn) {
  cpRunBtn.addEventListener('click', function() {
    cpRunExample(cpPicker ? parseInt(cpPicker.value, 10) : 0);
  });
}

cpShowExample(0);
