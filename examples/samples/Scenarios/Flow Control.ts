var EXAMPLES = [
  {
    name: 'Sequential',
    description: 'Steps execute one after another in declaration order.',
    yaml: [
      'scenario: sequential-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '  - click: { role: button, name: "B" }',
      '  - click: { role: button, name: "C" }',
      '  - click: { role: button, name: "D" }',
    ].join('\n'),
  },
  {
    name: 'Concurrent',
    description: 'Two branches execute in parallel — the scheduler interleaves steps from each branch on every tick.',
    yaml: [
      'scenario: concurrent-demo',
      'steps:',
      '  - concurrent:',
      '      branch-a:',
      '        - click: { role: button, name: "A" }',
      '        - click: { role: button, name: "C" }',
      '      branch-b:',
      '        - click: { role: button, name: "B" }',
      '        - click: { role: button, name: "D" }',
    ].join('\n'),
  },
  {
    name: 'Delay',
    description: 'A virtual-time delay pauses the queue — the clock advances but no steps execute during the gap.',
    yaml: [
      'scenario: delay-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '  - delay: 3000ms',
      '  - click: { role: button, name: "B" }',
      '  - delay: 1500ms',
      '  - click: { role: button, name: "C" }',
    ].join('\n'),
  },
  {
    name: 'Loop',
    description: 'The loop decorator repeats a step N times before advancing.',
    yaml: [
      'scenario: loop-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '    loop: 3',
      '  - click: { role: button, name: "B" }',
    ].join('\n'),
  },
  {
    name: 'When Guard',
    description: 'The when decorator conditionally skips a step based on a guard expression.',
    yaml: [
      'scenario: when-guard-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '  - click: { role: button, name: "B" }',
      '    when: isReady',
      '  - click: { role: button, name: "C" }',
      '    when: neverTrue',
      '  - click: { role: button, name: "D" }',
    ].join('\n'),
  },
];

var logEl = document.getElementById('event-log');
var stateEl = document.getElementById('orch-state');
var stepEl = document.getElementById('orch-step');
var timeEl = document.getElementById('orch-time');
var progressEl = document.getElementById('orch-progress');
var yamlEl = document.getElementById('yaml-source');
var descEl = document.getElementById('example-description');
var picker = document.getElementById('example-picker');
var runBtn = document.getElementById('run-btn');
var speedSlider = document.getElementById('speed-slider');
var speedLabel = document.getElementById('speed-label');
var stepDelay = 500;
var currentRunner = null;

if (speedSlider) {
  speedSlider.addEventListener('input', function() {
    stepDelay = parseInt(speedSlider.value, 10);
    if (speedLabel) speedLabel.textContent = stepDelay + 'ms';
  });
}

function formatTime(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  var sec = s % 60;
  var millis = ms % 1000;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec + '.' + (millis < 100 ? '0' : '') + (millis < 10 ? '0' : '') + millis;
}

function log(time, queue, action, status) {
  if (!logEl) return;
  var line = document.createElement('div');
  var timeStr = '[' + formatTime(time) + ']';
  var queueStr = queue.padEnd(12);
  var actionStr = action.padEnd(16);
  line.textContent = timeStr + '  ' + queueStr + actionStr + status;
  if (status === '✓') line.style.color = '#4ade80';
  else if (status === '⏭') line.style.color = '#f59e0b';
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function findByAriaLabel(name) {
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

function flashButton(name) {
  var btn = findByAriaLabel(name);
  if (!btn) return;
  btn.style.background = '#22c55e';
  btn.style.borderColor = '#22c55e';
  btn.style.color = '#000';
  setTimeout(function() {
    btn.style.background = 'var(--pages-neutral-2)';
    btn.style.borderColor = 'var(--pages-neutral-5)';
    btn.style.color = 'var(--pages-neutral-12)';
  }, Math.max(stepDelay - 150, 50));
}

function resetUI() {
  if (logEl) logEl.innerHTML = '';
  if (stateEl) stateEl.textContent = 'idle';
  if (stepEl) stepEl.textContent = '—';
  if (timeEl) timeEl.textContent = '0ms';
  if (progressEl) progressEl.textContent = '0%';
  var btns = document.querySelectorAll('#app-buttons button');
  btns.forEach(function(b) {
    b.style.background = 'var(--pages-neutral-2)';
    b.style.borderColor = 'var(--pages-neutral-5)';
    b.style.color = 'var(--pages-neutral-12)';
  });
}

function showExample(idx) {
  var ex = EXAMPLES[idx];
  if (!ex) return;
  if (yamlEl) yamlEl.value = ex.yaml;
  if (descEl) descEl.textContent = ex.description;
}

function runExample(idx) {
  if (currentRunner) {
    currentRunner.dispose();
    currentRunner = null;
  }
  resetUI();

  var ex = EXAMPLES[idx];
  if (!ex) return;

  var parseScenario = window.casehubPages && window.casehubPages.parseScenario;
  var createScheduler = window.casehubPages && window.casehubPages.createScheduler;

  if (!parseScenario || !createScheduler) {
    log(0, 'system', 'error', 'scheduler not in bundle');
    return;
  }

  var scenario;
  try {
    scenario = parseScenario(ex.yaml);
  } catch (e) {
    log(0, 'system', 'parse error', e.message || String(e));
    return;
  }

  var eventTarget = new EventTarget();

  eventTarget.addEventListener('pages-event', function(e) {
    var detail = e.detail;
    if (!detail) return;

    if (detail.topic === 'scenario:state') {
      var payload = detail.payload;
      if (stateEl) {
        stateEl.textContent = payload.paused ? 'paused' : (payload.progress >= 1 ? 'done' : 'playing');
        stateEl.style.color = payload.progress >= 1 ? '#4ade80' : (payload.paused ? '#f59e0b' : '#3b82f6');
      }
      if (progressEl) progressEl.textContent = Math.round(payload.progress * 100) + '%';
      if (payload.error && payload.error.message) {
        log(0, 'system', 'error', payload.error.message);
      }
    }

    if (detail.topic === 'scenario:step') {
      var sp = detail.payload;
      var step = sp.step;
      var action = step ? (step.action || step.construct || '?') : '?';
      var target = step && step.target ? step.target.name : (step ? (step.name || step.duration || '') : '');
      var label = action + (target ? ' ' + target : '');

      if (stepEl) stepEl.textContent = label;
      if (timeEl) timeEl.textContent = sp.virtualTime + 'ms';

      if (step && step.delivery === 'aria' && step.target && step.target.name) {
        flashButton(step.target.name);
      }

      if (step && step.delivery === 'orchestration' && step.construct === 'delay') {
        log(sp.virtualTime, sp.queue || 'main', 'delay ' + (step.duration || ''), '⏱');
      } else if (step && step.delivery === 'aria') {
        log(sp.virtualTime, sp.queue || 'main', label, '✓');
      } else {
        log(sp.virtualTime, sp.queue || 'main', label, '⏭');
      }
    }
  });

  var runner = createScheduler(scenario, {
    eventTarget: eventTarget,
    speed: 1,
    startPaused: false,
    executors: [{
      canExecute: function(step) { return step.delivery === 'aria'; },
      execute: function(step) {
        return new Promise(function(resolve) {
          var target = step.target;
          if (!target) { resolve(); return; }
          var el = findByAriaLabel(target.name);
          if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            flashButton(target.name);
          }
          setTimeout(resolve, stepDelay);
        });
      }
    }],
  });

  currentRunner = runner;
  runner.play();

  if (stateEl) {
    stateEl.textContent = 'playing';
    stateEl.style.color = '#3b82f6';
  }
}

if (picker) {
  picker.addEventListener('change', function() {
    showExample(parseInt(picker.value, 10));
  });
}

if (runBtn) {
  runBtn.addEventListener('click', function() {
    var idx = picker ? parseInt(picker.value, 10) : 0;
    runExample(idx);
  });
}

showExample(0);
