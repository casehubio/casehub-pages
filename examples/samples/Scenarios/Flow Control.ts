var EXAMPLES = [
  {
    name: 'Sequential',
    tags: ['steps'],
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
    tags: ['concurrent'],
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
    tags: ['delay'],
    description: 'A virtual-time delay pauses the queue — the clock advances but no steps execute during the gap.',
    yaml: [
      'scenario: delay-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '  - delay: 1000ms',
      '  - click: { role: button, name: "B" }',
      '  - delay: 500ms',
      '  - click: { role: button, name: "C" }',
    ].join('\n'),
  },
  {
    name: 'Loop',
    tags: ['loop', 'decorator'],
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
    tags: ['when', 'decorator'],
    description: 'The when decorator conditionally skips a step based on a guard expression. B executes (when: true), C is skipped (when: false).',
    yaml: [
      'scenario: when-guard-demo',
      'steps:',
      '  - click: { role: button, name: "A" }',
      '  - click: { role: button, name: "B" }',
      '    when: true',
      '  - click: { role: button, name: "C" }',
      '    when: false',
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
  if (descEl) {
    descEl.innerHTML = '';
    if (ex.tags && ex.tags.length > 0) {
      var tagSpan = document.createElement('span');
      tagSpan.style.cssText = 'display: inline-flex; gap: 4px; margin-right: 6px; vertical-align: middle;';
      ex.tags.forEach(function(t) {
        var chip = document.createElement('span');
        chip.textContent = t;
        chip.style.cssText = 'padding: 1px 6px; border-radius: 3px; background: var(--pages-accent-3); color: var(--pages-accent-9); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;';
        tagSpan.appendChild(chip);
      });
      descEl.appendChild(tagSpan);
    }
    descEl.appendChild(document.createTextNode(ex.description));
  }
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
      var isDelaying = !payload.paused && payload.progress < 1 && payload.virtualTime !== undefined;
      if (stateEl) {
        if (payload.progress >= 1) { stateEl.textContent = 'done'; stateEl.style.color = '#4ade80'; }
        else if (payload.paused) { stateEl.textContent = 'paused'; stateEl.style.color = '#f59e0b'; }
        else if (isDelaying) { stateEl.textContent = 'delaying'; stateEl.style.color = '#f59e0b'; }
        else { stateEl.textContent = 'playing'; stateEl.style.color = '#3b82f6'; }
      }
      if (timeEl && payload.virtualTime !== undefined) timeEl.textContent = Math.round(payload.virtualTime) + 'ms';
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
