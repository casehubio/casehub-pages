var COMP_EXAMPLES = {
  'data-trigger': {
    yaml: [
      'scenario: data-trigger-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '  - click: { role: button, name: "B" }',
      '  - trigger:',
      '      type: data',
      '      channel: trades',
      '    steps:',
      '      - click: { role: button, name: "C" }',
      '      - click: { role: button, name: "D" }',
    ].join('\n'),
    description: 'A triggered queue activates when data arrives on a channel. The main steps run first; the trigger queue waits until the channel has data.',
    triggers: [{ name: 'trades', type: 'data' }],
  },
  'time-trigger': {
    yaml: [
      'scenario: time-trigger-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '  - trigger:',
      '      type: time',
      '      delay: 2s',
      '    steps:',
      '      - click: { role: button, name: "C" }',
      '      - click: { role: button, name: "D" }',
      '  - click: { role: button, name: "B" }',
    ].join('\n'),
    description: 'A triggered queue activates after virtual time elapses. The main branch continues while the timer counts down.',
    triggers: [{ name: 'timer', type: 'time', delay: '2s' }],
  },
  'orchestration-block': {
    yaml: [
      'scenario: orchestration-block-demo',
      'orchestration:',
      '  barriers:',
      '    all-ready: { count: 2 }',
      '  signals: [go]',
      '  channels:',
      '    events: { capacity: 5 }',
      'steps:',
      '  - concurrent:',
      '      setup:',
      '        - click: { role: button, name: "A" }',
      '        - signal: go',
      '      worker:',
      '        - await: { signal: go }',
      '        - click: { role: button, name: "B" }',
      '        - click: { role: button, name: "C" }',
    ].join('\n'),
    description: 'Top-level orchestration block declares barriers, signals, and channels. Concurrent branches use them for coordination.',
    triggers: [],
  },
};

function compFormatTime(ms) {
  var s = Math.floor(ms / 1000);
  var m = ms % 1000;
  return '[' + String(s).padStart(2, '0') + ':' + String(m).padStart(3, '0') + ']';
}

function compLog(msg, queue, virtualTime) {
  var log = document.getElementById('comp-event-log');
  if (!log) return;
  var line = document.createElement('div');
  var timeStr = compFormatTime(virtualTime || 0);
  var queueStr = (queue || '').padEnd(12);
  line.textContent = timeStr + '  ' + queueStr + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function compUpdateState(state) {
  var el = document.getElementById('comp-state');
  if (!el) return;
  el.textContent = state;
  el.style.color = state === 'done' ? '#3b82f6' : state === 'playing' ? '#4ade80' : '#f59e0b';
}

function compUpdateTime(ms) {
  var el = document.getElementById('comp-time');
  if (el) el.textContent = ms + 'ms';
}

function compRenderTriggers(triggers) {
  var container = document.getElementById('trigger-states');
  var list = document.getElementById('trigger-list');
  if (!container || !list) return;
  list.innerHTML = '';
  if (triggers.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  var countEl = document.getElementById('comp-trigger-count');
  if (countEl) countEl.textContent = String(triggers.length);
  triggers.forEach(function(t) {
    var row = document.createElement('div');
    row.id = 'trigger-' + t.name;
    row.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--pages-neutral-3); border-radius: 4px;';
    row.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #6b7280;" id="trigger-dot-' + t.name + '"></span>'
      + '<span style="font-size: 12px; color: var(--pages-neutral-12);">' + t.name + ' (' + t.type + ')</span>'
      + '<span style="font-size: 10px; color: var(--pages-neutral-8); margin-left: auto;" id="trigger-status-' + t.name + '">suspended</span>'
      + '<button id="trigger-fire-' + t.name + '" style="padding: 2px 10px; font-size: 11px; border: 1px solid var(--pages-accent-6); border-radius: 4px; background: var(--pages-accent-3); color: var(--pages-accent-9); cursor: pointer; margin-left: 4px;">Send</button>';
    list.appendChild(row);
    var fireBtn = document.getElementById('trigger-fire-' + t.name);
    if (fireBtn) {
      fireBtn.addEventListener('click', function() {
        if (compCurrentRunner && compCurrentRunner.injectData) {
          compCurrentRunner.injectData(t.name, { ts: +new Date() });
          compLog('data → ' + t.name, 'user', 0);
        }
      });
    }
  });
}

function compSetTriggerStatus(name, status) {
  var dot = document.getElementById('trigger-dot-' + name);
  var label = document.getElementById('trigger-status-' + name);
  if (dot) {
    dot.style.background = status === 'suspended' ? '#6b7280' : status === 'active' ? '#4ade80' : '#3b82f6';
  }
  if (label) label.textContent = status;
}

function compShowYaml(key) {
  var example = COMP_EXAMPLES[key];
  var pre = document.getElementById('comp-yaml-source');
  if (pre && example) pre.value = example.yaml;
}

function compResetUI() {
  var log = document.getElementById('comp-event-log');
  if (log) log.innerHTML = '';
  compUpdateState('Ready');
  compUpdateTime(0);
  var list = document.getElementById('trigger-list');
  if (list) list.innerHTML = '';
  var container = document.getElementById('trigger-states');
  if (container) container.style.display = 'none';
  var countEl = document.getElementById('comp-trigger-count');
  if (countEl) countEl.textContent = '0';
}

function compFindByAriaLabel(name) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (el) return el;
  var hosts = document.querySelectorAll('*');
  for (var i = 0; i < hosts.length; i++) {
    var root = hosts[i].shadowRoot;
    if (root) {
      el = root.querySelector('[aria-label="' + name + '"]');
      if (el) return el;
    }
  }
  return null;
}

var compStepDelay = 500;

function compFlashButton(name) {
  var btn = compFindByAriaLabel(name);
  if (!btn) return;
  btn.style.background = '#22c55e';
  btn.style.borderColor = '#22c55e';
  btn.style.color = '#000';
  setTimeout(function() {
    btn.style.background = 'var(--pages-accent-3)';
    btn.style.borderColor = 'var(--pages-accent-6)';
    btn.style.color = 'var(--pages-accent-11)';
  }, Math.max(compStepDelay - 150, 50));
}

var compCurrentRunner = null;

function compRunExample(key) {
  if (compCurrentRunner) {
    compCurrentRunner.dispose();
    compCurrentRunner = null;
  }
  compResetUI();

  var example = COMP_EXAMPLES[key];
  if (!example) return;

  compRenderTriggers(example.triggers);

  var et = new EventTarget();
  var startTime = Date.now();

  et.addEventListener('pages-event', function(e) {
    var detail = e.detail;
    if (detail.topic === 'scenario:state') {
      var payload = detail.payload;
      compUpdateState(payload.paused ? 'paused' : (payload.progress >= 1 ? 'done' : 'playing'));
      if (payload.virtualTime !== undefined) compUpdateTime(payload.virtualTime);
    }
    if (detail.topic === 'scenario:step') {
      var p = detail.payload;
      var step = p.step;
      var action = step.action || step.construct || '?';
      var target = step.target ? step.target.name : (step.name || step.duration || '');
      var label = action + (target ? ' ' + target : '');
      compLog(label.padEnd(20) + '✓', p.queue, p.virtualTime);
      compUpdateTime(p.virtualTime);
    }
    if (detail.topic === 'scenario:queue') {
      var q = detail.payload;
      if (q.state === 'done') {
        compLog('← done', q.queueId, 0);
      }
      if (q.reason === 'delay') {
        compLog('← blocked (delay)', q.queueId, 0);
      }
      // Update trigger visualization
      example.triggers.forEach(function(t) {
        if (q.queueId.indexOf('trigger') === 0) {
          if (q.state === 'ready' || q.state === 'done') {
            compSetTriggerStatus(t.name, q.state === 'ready' ? 'active' : 'fired');
          }
        }
      });
    }
  });

  compLog('Starting: ' + key, 'system', 0);

  try {
    var scenario = casehubPages.parseScenario(example.yaml);
    var runner = casehubPages.createScheduler(scenario, {
      eventTarget: et,
      speed: 1,
      startPaused: true,
      executors: [{
        canExecute: function(step) { return step.delivery === 'aria'; },
        execute: function(step) {
          return new Promise(function(resolve) {
            var target = step.target;
            if (!target) { resolve(); return; }
            var el = compFindByAriaLabel(target.name);
            if (el) {
              el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              compFlashButton(target.name);
            }
            setTimeout(resolve, compStepDelay);
          });
        }
      }],
    });
    compCurrentRunner = runner;
    runner.play();
  } catch (err) {
    compLog('Error: ' + err.message, 'system', 0);
  }
}

// Wire up picker
var compPicker = document.getElementById('comp-example-picker');
if (compPicker) {
  compShowYaml(compPicker.value);
  compPicker.addEventListener('change', function() {
    compShowYaml(compPicker.value);
    compResetUI();
  });
}

// Wire up speed slider
var compSpeedSlider = document.getElementById('comp-speed-slider');
var compSpeedLabel = document.getElementById('comp-speed-label');
if (compSpeedSlider) {
  compSpeedSlider.addEventListener('input', function() {
    compStepDelay = parseInt(compSpeedSlider.value, 10);
    if (compSpeedLabel) compSpeedLabel.textContent = compStepDelay + 'ms';
  });
}

// Wire up run button
var compRunBtn = document.getElementById('comp-run-btn');
if (compRunBtn) {
  compRunBtn.addEventListener('click', function() {
    var picker = document.getElementById('comp-example-picker');
    if (picker) compRunExample(picker.value);
  });
}

// Show initial YAML
compShowYaml('data-trigger');
