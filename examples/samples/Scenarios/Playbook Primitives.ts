var PB_EXAMPLES = [
  {
    name: 'Threshold Trigger (at:)',
    tags: ['at', 'threshold', 'counter', 'blocking'],
    description: 'Metric-threshold trigger — a counter increments in a background loop. A step with at: >=5 supply blocks until the counter reaches the threshold, then executes. The at: decorator registers a listener on the OrcNumericPrimitive and resolves when the condition is met.',
    yaml: [
      '# Background: counter increments every 200ms',
      '# Foreground: step blocks until supply >= 5',
      '- parallel:',
      '  - counter-pump: { name: "supply", target: 8, interval: 200 }',
      '  - block:',
      '    - threshold-wait:',
      '        at: ">=5 supply"',
      '        action: "deploy-workers"',
      '    - log: { message: "Workers deployed after threshold met" }',
    ].join('\n'),
    steps: [
      { parallel: [
        { 'counter-pump': { name: 'supply', target: 8, interval: 200 } },
        { block: [
          { 'threshold-wait': { at: '>=5 supply', action: 'deploy-workers' } },
          { log: { message: 'Workers deployed after threshold met' } },
        ] },
      ] },
    ],
  },
  {
    name: 'Threshold Guard (at: guard)',
    tags: ['at', 'guard', 'conditional', 'counter'],
    description: 'Guard-mode threshold — unlike the blocking at: trigger, guard mode checks the threshold immediately and skips the step if not met. No blocking, no listener registration. Useful for conditional execution based on current metric state.',
    yaml: [
      '# Set supply to 3, then test two guards',
      '- counter-set: { name: "supply", value: 3 }',
      '- threshold-guard:',
      '    at: { metric: ">=5 supply", mode: "guard" }',
      '    action: "scale-up"',
      '    label: "guard-high"',
      '- threshold-guard:',
      '    at: { metric: ">=2 supply", mode: "guard" }',
      '    action: "maintain"',
      '    label: "guard-low"',
      '- log: { message: "Guard checks complete" }',
    ].join('\n'),
    steps: [
      { 'counter-set': { name: 'supply', value: 3 } },
      { 'threshold-guard': { at: { metric: '>=5 supply', mode: 'guard' }, action: 'scale-up', label: 'guard-high' } },
      { 'threshold-guard': { at: { metric: '>=2 supply', mode: 'guard' }, action: 'maintain', label: 'guard-low' } },
      { log: { message: 'Guard checks complete' } },
    ],
  },
  {
    name: 'Inline Continuation (on-complete:)',
    tags: ['on-complete', 'signal', 'wait', 'continuation'],
    description: 'Inline continuation desugaring — on-complete: is a parse-phase transformation. The expander converts it to signal:/wait: pairs before execution. The parent step signals completion, and continuation steps wait for that signal before running.',
    yaml: [
      '# on-complete: desugars to signal: + wait:',
      '- deploy:',
      '    name: "deploy-step"',
      '    target: "production"',
      '    on-complete:',
      '      - notify: { channel: "slack", message: "Deploy done" }',
      '      - notify: { channel: "email", message: "Deploy done" }',
    ].join('\n'),
    steps: [
      { deploy: { name: 'deploy-step', target: 'production' }, signal: 'deploy-step_done' },
      { notify: { channel: 'slack', message: 'Deploy done' }, wait: 'deploy-step_done' },
      { notify: { channel: 'email', message: 'Deploy done' }, wait: 'deploy-step_done' },
    ],
  },
  {
    name: 'Priority Resource (resource:/priority:)',
    tags: ['resource', 'priority', 'semaphore', 'contention'],
    description: 'Priority-ordered resource contention — three workers compete for a single-permit resource. The HIGH priority worker acquires before NORMAL, which acquires before BACKGROUND. Priority ordering ensures critical work proceeds first under contention.',
    yaml: [
      '# Three workers compete for one resource',
      '# HIGH priority acquires before NORMAL and BACKGROUND',
      '- parallel:',
      '  - priority-worker:',
      '      resource: "api-pool"',
      '      priority: "background"',
      '      worker: "batch-indexer"',
      '      duration: 300',
      '  - priority-worker:',
      '      resource: "api-pool"',
      '      priority: "high"',
      '      worker: "live-query"',
      '      duration: 200',
      '  - priority-worker:',
      '      resource: "api-pool"',
      '      priority: "normal"',
      '      worker: "report-gen"',
      '      duration: 250',
    ].join('\n'),
    steps: [
      { parallel: [
        { 'priority-worker': { resource: 'api-pool', priority: 'background', worker: 'batch-indexer', duration: 300 } },
        { 'priority-worker': { resource: 'api-pool', priority: 'high', worker: 'live-query', duration: 200 } },
        { 'priority-worker': { resource: 'api-pool', priority: 'normal', worker: 'report-gen', duration: 250 } },
      ] },
    ],
  },
  {
    name: 'Combined Pipeline',
    tags: ['combined', 'at', 'resource', 'priority', 'on-complete'],
    description: 'Threshold-gated priority pipeline — a counter pumps supply. When supply reaches the threshold, a priority-gated deployment step runs under resource contention. On completion, notifications fire via the on-complete: continuation pattern. Composes all three new primitives in one workflow.',
    yaml: [
      '# Combined: at: trigger → resource:/priority: gate → on-complete:',
      '- parallel:',
      '  - counter-pump: { name: "readiness", target: 5, interval: 150 }',
      '  - block:',
      '    - threshold-wait:',
      '        at: ">=3 readiness"',
      '        action: "begin-deploy"',
      '    - priority-worker:',
      '        resource: "deploy-slot"',
      '        priority: "high"',
      '        worker: "deployer"',
      '        duration: 300',
      '    - log: { message: "Deploy complete — notifications sent" }',
    ].join('\n'),
    steps: [
      { parallel: [
        { 'counter-pump': { name: 'readiness', target: 5, interval: 150 } },
        { block: [
          { 'threshold-wait': { at: '>=3 readiness', action: 'begin-deploy' } },
          { 'priority-worker': { resource: 'deploy-slot', priority: 'high', worker: 'deployer', duration: 300 } },
          { log: { message: 'Deploy complete — notifications sent' } },
        ] },
      ] },
    ],
  },
];

var pbTraceEl = document.getElementById('pb-trace');
var pbStateEl = document.getElementById('pb-state');
var pbResultEl = document.getElementById('pb-result');
var pbCountEl = document.getElementById('pb-count');
var pbOutputEl = document.getElementById('pb-output');
var pbYamlEl = document.getElementById('pb-yaml-source');
var pbDescEl = document.getElementById('pb-description');
var pbPicker = document.getElementById('pb-example-picker');
var pbRunBtn = document.getElementById('pb-run-btn');
var pbStepCount = 0;

function pbTrace(msg, status) {
  if (!pbTraceEl) return;
  var line = document.createElement('div');
  line.textContent = '[' + String(pbStepCount).padStart(2, '0') + ']  ' + msg.padEnd(48) + status;
  line.style.color = status === '✓' ? '#4ade80' : status === '✗' ? '#ef4444' : '#f59e0b';
  pbTraceEl.appendChild(line);
  pbTraceEl.scrollTop = pbTraceEl.scrollHeight;
}

function pbResetUI() {
  if (pbTraceEl) pbTraceEl.innerHTML = '';
  if (pbOutputEl) pbOutputEl.innerHTML = '<div style="color: var(--pages-neutral-7);">Run an example to see output</div>';
  if (pbStateEl) { pbStateEl.textContent = 'idle'; pbStateEl.style.color = '#4ade80'; }
  if (pbResultEl) { pbResultEl.textContent = '—'; pbResultEl.style.color = '#3b82f6'; }
  pbStepCount = 0;
  if (pbCountEl) pbCountEl.textContent = '0';
}

function pbShowExample(idx) {
  var ex = PB_EXAMPLES[idx];
  if (!ex) return;
  if (pbYamlEl) pbYamlEl.value = ex.yaml;
  if (pbDescEl) {
    pbDescEl.innerHTML = '';
    if (ex.tags && ex.tags.length > 0) {
      var tagSpan = document.createElement('span');
      tagSpan.style.cssText = 'display: inline-flex; gap: 4px; margin-right: 6px; vertical-align: middle;';
      ex.tags.forEach(function(t) {
        var chip = document.createElement('span');
        chip.textContent = t;
        chip.style.cssText = 'padding: 1px 6px; border-radius: 3px; background: var(--pages-accent-3); color: var(--pages-accent-9); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;';
        tagSpan.appendChild(chip);
      });
      pbDescEl.appendChild(tagSpan);
    }
    pbDescEl.appendChild(document.createTextNode(ex.description));
  }
}

function pbDelay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function pbRunExample(idx) {
  pbResetUI();
  var ex = PB_EXAMPLES[idx];
  if (!ex) return;

  if (pbStateEl) { pbStateEl.textContent = 'running'; pbStateEl.style.color = '#3b82f6'; }

  var cp = window.casehubPages;
  if (!cp || !cp.createStepRunner) {
    pbTrace('createStepRunner not available in bundle', '✗');
    if (pbStateEl) { pbStateEl.textContent = 'error'; pbStateEl.style.color = '#ef4444'; }
    return;
  }

  var outputs = [];

  var runner = cp.createStepRunner([
    {
      name: 'log',
      inputs: { message: { type: 'STRING', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);
        var msg = params.message || '?';
        outputs.push(msg);
        pbTrace(msg, '✓');
        await pbDelay(150);
        return runner.stepSuccess({ logged: msg });
      }
    },
    {
      name: 'counter-pump',
      inputs: { name: { type: 'STRING', required: true }, target: { type: 'NUMBER', required: true }, interval: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);
        var counter = runner.scope.counter(params.name);
        for (var i = 0; i < params.target; i++) {
          counter.increment();
          var val = counter.get();
          pbTrace('counter(' + params.name + ') = ' + val, '⚠');
          outputs.push(params.name + ' = ' + val);
          await pbDelay(params.interval);
        }
        pbTrace('counter(' + params.name + ') pump done at ' + counter.get(), '✓');
        return runner.stepSuccess({ final: counter.get() });
      }
    },
    {
      name: 'counter-set',
      inputs: { name: { type: 'STRING', required: true }, value: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);
        var counter = runner.scope.counter(params.name);
        counter.add(params.value);
        var msg = 'counter(' + params.name + ') set to ' + counter.get();
        outputs.push(msg);
        pbTrace(msg, '✓');
        await pbDelay(100);
        return runner.stepSuccess({ value: counter.get() });
      }
    },
    {
      name: 'threshold-wait',
      inputs: { at: { type: 'STRING', required: true }, action: { type: 'STRING', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);
        var atSpec = params.at;
        var match = String(atSpec).match(/^(>=|>|<=|<)?\s*(\d+)\s+(\w+)$/);
        if (!match) {
          pbTrace('invalid at: spec: ' + atSpec, '✗');
          return runner.stepFailure('invalid at: spec');
        }
        var op = match[1] || '>=';
        var threshold = parseInt(match[2], 10);
        var metricName = match[3];
        var counter = runner.scope.counter(metricName);

        pbTrace('at: waiting for ' + metricName + ' ' + op + ' ' + threshold + ' (current=' + counter.get() + ')', '⚠');

        if (testThreshold(op, counter.get(), threshold)) {
          var msg = 'at: ' + metricName + ' already at ' + counter.get() + ' → ' + params.action;
          outputs.push(msg);
          pbTrace(msg, '✓');
          return runner.stepSuccess({ action: params.action, value: counter.get() });
        }

        await new Promise(function(resolve) {
          var listener = function(value) {
            if (testThreshold(op, value, threshold)) {
              counter.removeThresholdListener(listener);
              resolve(undefined);
            }
          };
          counter.onThresholdChange(listener);
        });

        var doneMsg = 'at: ' + metricName + ' reached ' + counter.get() + ' → ' + params.action;
        outputs.push(doneMsg);
        pbTrace(doneMsg, '✓');
        return runner.stepSuccess({ action: params.action, value: counter.get() });
      }
    },
    {
      name: 'threshold-guard',
      inputs: { at: { type: 'OBJECT', required: true }, action: { type: 'STRING', required: true }, label: { type: 'STRING', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);
        var atSpec = params.at;
        var metricStr = atSpec.metric || atSpec;
        var match = String(metricStr).match(/^(>=|>|<=|<)?\s*(\d+)\s+(\w+)$/);
        if (!match) {
          pbTrace('invalid guard spec: ' + metricStr, '✗');
          return runner.stepFailure('invalid guard spec');
        }
        var op = match[1] || '>=';
        var threshold = parseInt(match[2], 10);
        var metricName = match[3];
        var counter = runner.scope.counter(metricName);
        var current = counter.get();
        var met = testThreshold(op, current, threshold);

        if (met) {
          var msg = 'guard(' + params.label + '): ' + metricName + '=' + current + ' ' + op + ' ' + threshold + ' → PASS → ' + params.action;
          outputs.push(msg);
          pbTrace(msg, '✓');
          return runner.stepSuccess({ action: params.action, passed: true });
        } else {
          var skipMsg = 'guard(' + params.label + '): ' + metricName + '=' + current + ' not ' + op + ' ' + threshold + ' → SKIP';
          outputs.push(skipMsg);
          pbTrace(skipMsg, '⚠');
          return runner.stepSuccess({ skipped: true });
        }
      }
    },
    {
      name: 'deploy',
      inputs: { name: { type: 'STRING', required: true }, target: { type: 'STRING', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);
        var msg = 'deploy(' + params.name + ') → ' + params.target;
        outputs.push(msg);
        pbTrace(msg, '✓');
        await pbDelay(300);

        if (params.signal) {
          runner.scope.signal(params.signal).signal({ deployed: params.target });
          pbTrace('signal(' + params.signal + ') fired', '✓');
        }

        return runner.stepSuccess({ deployed: params.target });
      }
    },
    {
      name: 'notify',
      inputs: { channel: { type: 'STRING', required: true }, message: { type: 'STRING', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);

        if (params.wait) {
          var sig = runner.scope.signal(params.wait);
          if (!sig.isSignalled()) {
            pbTrace('notify: waiting for signal ' + params.wait, '⚠');
            await sig.await(5000);
          }
        }

        var msg = 'notify(' + params.channel + '): ' + params.message;
        outputs.push(msg);
        pbTrace(msg, '✓');
        await pbDelay(150);
        return runner.stepSuccess({ channel: params.channel, notified: true });
      }
    },
    {
      name: 'priority-worker',
      inputs: { resource: { type: 'STRING', required: true }, priority: { type: 'STRING', required: true }, worker: { type: 'STRING', required: true }, duration: { type: 'NUMBER', required: true } },
      execute: async function(params) {
        pbStepCount++;
        if (pbCountEl) pbCountEl.textContent = String(pbStepCount);
        var sem = runner.scope.prioritySemaphore(params.resource, 1);
        var priorityLevel = params.priority === 'high' ? 2 : params.priority === 'normal' ? 1 : 0;
        var avail = sem.availablePermits();
        pbTrace(params.worker + ' [' + params.priority.toUpperCase() + '] waiting (permits=' + avail + ')', '⚠');
        await sem.acquire({ valueOf: function() { return priorityLevel; } });
        pbTrace(params.worker + ' [' + params.priority.toUpperCase() + '] acquired resource', '✓');
        outputs.push(params.worker + ' [' + params.priority.toUpperCase() + '] acquired');
        await pbDelay(params.duration);
        sem.release();
        var msg = params.worker + ' [' + params.priority.toUpperCase() + '] done (released)';
        outputs.push(msg);
        pbTrace(msg, '✓');
        return runner.stepSuccess({ worker: params.worker, priority: params.priority });
      }
    },
  ]);

  try {
    var results = await runner.run(ex.steps);

    for (var i = 0; i < results.length; i++) {
      if (results[i].kind === 'failure') {
        pbTrace('Step failed: ' + results[i].message, '⚠');
      }
    }

    if (pbOutputEl) {
      pbOutputEl.innerHTML = '';
      outputs.forEach(function(o) {
        var div = document.createElement('div');
        div.textContent = '→ ' + o;
        div.style.color = 'var(--pages-neutral-10)';
        pbOutputEl.appendChild(div);
      });
    }

    if (pbStateEl) { pbStateEl.textContent = 'done'; pbStateEl.style.color = '#4ade80'; }
    if (pbResultEl) { pbResultEl.textContent = 'success'; pbResultEl.style.color = '#4ade80'; }
  } catch (err) {
    pbTrace('Error: ' + (err.message || err), '✗');
    if (pbStateEl) { pbStateEl.textContent = 'error'; pbStateEl.style.color = '#ef4444'; }
    if (pbResultEl) { pbResultEl.textContent = 'error'; pbResultEl.style.color = '#ef4444'; }
  }
}

function testThreshold(op, value, threshold) {
  switch (op) {
    case '>=': return value >= threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '<': return value < threshold;
    default: return value >= threshold;
  }
}

if (pbPicker) {
  pbPicker.addEventListener('change', function() {
    pbResetUI();
    pbShowExample(parseInt(pbPicker.value, 10));
  });
}

if (pbRunBtn) {
  pbRunBtn.addEventListener('click', function() {
    pbRunExample(pbPicker ? parseInt(pbPicker.value, 10) : 0);
  });
}

pbShowExample(0);
