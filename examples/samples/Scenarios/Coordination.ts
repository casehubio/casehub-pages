var EXAMPLES = {
  'signal-await': {
    title: 'Signal / Await',
    description: 'Sender signals after a click, receiver awaits before proceeding — causal dependency.',
    yaml: [
      'scenario: signal-await-demo',
      'steps:',
      '  - concurrent:',
      '      sender:',
      '        - click: { role: button, name: "A" }',
      '        - signal: go',
      '      receiver:',
      '        - await: { signal: go }',
      '        - click: { role: button, name: "B" }',
    ].join('\n'),
  },
  'mutex': {
    title: 'Mutex',
    description: 'Two branches share a lock — steps with the same mutex never interleave.',
    yaml: [
      'scenario: mutex-demo',
      'steps:',
      '  - concurrent:',
      '      branch-a:',
      '        - click: { role: button, name: "A" }',
      '          mutex: db-write',
      '        - click: { role: button, name: "B" }',
      '          mutex: db-write',
      '      branch-b:',
      '        - click: { role: button, name: "C" }',
      '          mutex: db-write',
      '        - click: { role: button, name: "D" }',
      '          mutex: db-write',
    ].join('\n'),
  },
  'barrier': {
    title: 'Barrier',
    description: 'Three branches work independently, then meet at a barrier before proceeding.',
    yaml: [
      'scenario: barrier-demo',
      'orchestration:',
      '  barriers:',
      '    all-ready: { count: 3 }',
      'steps:',
      '  - concurrent:',
      '      alpha:',
      '        - click: { role: button, name: "A" }',
      '        - await: { barrier: all-ready }',
      '        - click: { role: button, name: "D" }',
      '      beta:',
      '        - click: { role: button, name: "B" }',
      '        - await: { barrier: all-ready }',
      '        - click: { role: button, name: "E" }',
      '      gamma:',
      '        - click: { role: button, name: "C" }',
      '        - await: { barrier: all-ready }',
      '        - click: { role: button, name: "F" }',
    ].join('\n'),
  },
  'channel': {
    title: 'Channel (via Signal)',
    description: 'Producer signals readiness, consumer awaits — models a channel handshake.',
    yaml: [
      'scenario: channel-demo',
      'orchestration:',
      '  signals: [data-ready, ack]',
      'steps:',
      '  - concurrent:',
      '      producer:',
      '        - click: { role: button, name: "A" }',
      '        - signal: data-ready',
      '        - await: { signal: ack }',
      '        - click: { role: button, name: "C" }',
      '      consumer:',
      '        - await: { signal: data-ready }',
      '        - click: { role: button, name: "B" }',
      '        - signal: ack',
      '        - click: { role: button, name: "D" }',
    ].join('\n'),
  },
};

var stateEl = document.getElementById('orch-state');
var queuesEl = document.getElementById('orch-queues');
var timeEl = document.getElementById('orch-time');
var queueStatesEl = document.getElementById('queue-states');
var eventLogEl = document.getElementById('event-log');
var yamlSourceEl = document.getElementById('yaml-source');
var examplePicker = document.getElementById('example-picker');
var runBtn = document.getElementById('run-btn');
var currentRunner = null;

var QUEUE_COLORS = { ready: '#4ade80', blocked: '#f59e0b', suspended: '#8b5cf6', done: '#6b7280' };

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

var coordStepDelay = 500;

function flashButton(name) {
  var btn = findByAriaLabel(name);
  if (!btn) return;
  btn.style.background = '#22c55e';
  btn.style.borderColor = '#22c55e';
  btn.style.color = '#000';
  setTimeout(function() {
    btn.style.background = 'var(--pages-accent-3)';
    btn.style.borderColor = 'var(--pages-accent-6)';
    btn.style.color = 'var(--pages-accent-11)';
  }, coordStepDelay);
}

function formatTime(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  var sec = s % 60;
  var millis = ms % 1000;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec + '.' + (millis < 100 ? '0' : '') + (millis < 10 ? '0' : '') + millis;
}

function appendLog(time, queue, action, result) {
  var line = document.createElement('div');
  var queuePad = (queue + '          ').slice(0, 10);
  var actionPad = (action + '                    ').slice(0, 20);
  line.textContent = '[' + formatTime(time) + ']  ' + queuePad + actionPad + result;
  if (result.indexOf('blocked') >= 0 || result.indexOf('waiting') >= 0) {
    line.style.color = '#f59e0b';
  } else if (result.indexOf('unblocked') >= 0 || result.indexOf('released') >= 0) {
    line.style.color = '#a78bfa';
  } else {
    line.style.color = '#4ade80';
  }
  eventLogEl.appendChild(line);
  eventLogEl.scrollTop = eventLogEl.scrollHeight;
}

function updateQueueDot(queueId, state) {
  var dot = document.getElementById('qdot-' + queueId);
  if (!dot) {
    dot = document.createElement('span');
    dot.id = 'qdot-' + queueId;
    dot.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    queueStatesEl.appendChild(dot);
  }
  var color = QUEUE_COLORS[state] || '#6b7280';
  dot.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: ' + color + '; display: inline-block;"></span><span style="font-size: 11px; color: var(--pages-neutral-9);">' + queueId + '</span>';
}

function resetUI() {
  eventLogEl.innerHTML = '';
  queueStatesEl.innerHTML = '';
  stateEl.textContent = 'Running';
  stateEl.style.color = '#3b82f6';
  queuesEl.textContent = '—';
  timeEl.textContent = '0ms';
}

function showYaml(key) {
  var example = EXAMPLES[key];
  if (example) {
    yamlSourceEl.value = example.yaml;
  }
}

function runExample(key) {
  if (currentRunner) {
    currentRunner.dispose();
    currentRunner = null;
  }

  var example = EXAMPLES[key];
  if (!example) return;

  resetUI();

  var et = new EventTarget();
  var scenario = casehubPages.parseScenario(example.yaml);

  et.addEventListener('pages-event', function(e) {
    var detail = e.detail;
    if (detail.topic === 'scenario:step') {
      var p = detail.payload;
      var stepObj = p.step;
      var action = '';
      if (stepObj.delivery === 'orchestration') {
        if (stepObj.construct === 'signal') action = 'signal ' + stepObj.name;
        else if (stepObj.construct === 'await') action = 'await ' + (stepObj.signal || stepObj.barrier || '?');
        else action = stepObj.construct;
      } else if (stepObj.action) {
        action = stepObj.action + ' ' + ((stepObj.target && stepObj.target.name) || '');
      }
      appendLog(p.virtualTime, p.queue, action, '✓');
    }
    if (detail.topic === 'scenario:queue') {
      var qp = detail.payload;
      updateQueueDot(qp.queueId, qp.state);
      if (qp.state === 'blocked') {
        appendLog(0, qp.queueId, qp.reason || 'blocked', '→ waiting');
      } else if (qp.state === 'ready' && qp.reason) {
        appendLog(0, qp.queueId, qp.reason, '→ unblocked');
      }
    }
    if (detail.topic === 'scenario:state') {
      var sp = detail.payload;
      timeEl.textContent = Math.round(sp.progress * 100) + '%';
      if (sp.paused === false && sp.progress >= 1) {
        stateEl.textContent = 'Done';
        stateEl.style.color = '#4ade80';
      }
    }
  });

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
          var el = findByAriaLabel(target.name);
          if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            flashButton(target.name);
          }
          setTimeout(resolve, coordStepDelay);
        });
      }
    }],
  });

  currentRunner = runner;

  var queueCount = 0;
  if (runner.outline) queueCount = runner.outline.length;
  queuesEl.textContent = queueCount > 0 ? queueCount + '' : '—';

  runner.play();
}

if (examplePicker) {
  showYaml(examplePicker.value);
  examplePicker.addEventListener('change', function() {
    showYaml(examplePicker.value);
  });
}

var coordSpeedSlider = document.getElementById('speed-slider');
var coordSpeedLabel = document.getElementById('speed-label');
if (coordSpeedSlider) {
  coordSpeedSlider.addEventListener('input', function() {
    coordStepDelay = parseInt(coordSpeedSlider.value, 10);
    if (coordSpeedLabel) coordSpeedLabel.textContent = coordStepDelay + 'ms';
  });
}

if (runBtn) {
  runBtn.addEventListener('click', function() {
    runExample(examplePicker.value);
  });
}
