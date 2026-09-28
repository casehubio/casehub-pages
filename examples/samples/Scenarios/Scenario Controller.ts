// Uses the real <pages-scenario-controller> component from @casehubio/pages-aria.
// Pumps mock scenario:state events via eventTarget to simulate orchestrator
// step progression — no server connection needed.

var SCENARIOS = [
  {
    name: 'helpdesk-demo',
    steps: ['Navigate to portal', 'Login as agent', 'Open ticket queue', 'Select priority ticket', 'Fill resolution notes', 'Close ticket', 'Check dashboard metrics', 'Verify notification sent'],
  },
  {
    name: 'data-import',
    steps: ['Open import wizard', 'Select CSV file', 'Map columns', 'Validate data', 'Import records', 'Generate report'],
  },
];

var eventTarget = new EventTarget();
var mount = document.getElementById('controller-mount');
var controller = null;
if (mount) {
  controller = document.createElement('pages-scenario-controller');
  controller.style.display = 'block';
  controller.eventTarget = eventTarget;
  controller.baseUrl = 'http://mock';
  mount.appendChild(controller);
}
var currentSteps = [];
var currentName = '';
var stepIndex = -1;
var playing = false;
var playTimer = null;

function logEvent(msg) {
  var log = document.getElementById('event-log');
  if (!log) return;
  var time = new Date().toLocaleTimeString();
  var line = document.createElement('div');
  line.textContent = '[' + time + '] ' + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function updateMetrics() {
  var statusEl = document.getElementById('app-status');
  var stepEl = document.getElementById('current-step');
  if (stepIndex < 0 || currentSteps.length === 0) {
    if (statusEl) { statusEl.textContent = 'Ready'; statusEl.style.color = '#4ade80'; }
    if (stepEl) stepEl.textContent = '—';
    return;
  }
  var done = stepIndex >= currentSteps.length;
  if (statusEl) {
    statusEl.textContent = done ? 'Complete' : (playing ? 'Running' : 'Paused');
    statusEl.style.color = done ? '#4ade80' : (playing ? '#3b82f6' : '#f59e0b');
  }
  if (stepEl) stepEl.textContent = done ? 'Done' : (currentSteps[stepIndex] || '—');
}

function fireState(scenarioName, step, paused, progress) {
  eventTarget.dispatchEvent(new CustomEvent('pages-event', {
    detail: {
      topic: 'scenario:state',
      payload: {
        scenario: scenarioName,
        chapter: null,
        section: null,
        step: step,
        paused: paused,
        speed: 1.0,
        progress: progress,
        content: null,
        slides: null,
      },
    },
  }));
}

function advanceStep() {
  if (stepIndex >= currentSteps.length) return;
  stepIndex++;
  if (stepIndex < currentSteps.length) {
    var pct = stepIndex / currentSteps.length;
    fireState(currentName, currentSteps[stepIndex], false, pct);
    logEvent('Step: ' + currentSteps[stepIndex]);
  } else {
    fireState(currentName, null, true, 1.0);
    logEvent('Scenario complete');
    playing = false;
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }
  updateMetrics();
}

function startScenario(scenario) {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  currentName = scenario.name;
  currentSteps = scenario.steps;
  stepIndex = 0;
  playing = false;

  document.getElementById('event-log').innerHTML = '';
  logEvent('Loaded: ' + scenario.name + ' (' + scenario.steps.length + ' steps)');
  logEvent('Step: ' + currentSteps[0]);

  fireState(currentName, currentSteps[0], true, 0);
  updateMetrics();
}

if (controller) {
  // Mock the fetch calls the controller makes
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string') {
      // Mock outline endpoint
      if (url.indexOf('/scenario/outline') >= 0) {
        var outline = [];
        if (currentSteps.length > 0) {
          var mid = Math.ceil(currentSteps.length / 2);
          outline = [
            { label: 'Phase 1', target: null, children: currentSteps.slice(0, mid).map(function(s) { return { label: s, target: 'browser', children: [] }; }) },
            { label: 'Phase 2', target: null, children: currentSteps.slice(mid).map(function(s) { return { label: s, target: 'browser', children: [] }; }) },
          ];
        }
        return Promise.resolve({ ok: true, json: function() { return Promise.resolve(outline); } });
      }
      // Mock command endpoints (pause/resume/step/speed)
      if (url.indexOf('/scenario/') >= 0 && opts && opts.method === 'POST') {
        if (url.indexOf('/pause') >= 0) {
          playing = false;
          if (playTimer) { clearInterval(playTimer); playTimer = null; }
          if (stepIndex < currentSteps.length) fireState(currentName, currentSteps[stepIndex], true, stepIndex / currentSteps.length);
          logEvent('Paused');
          updateMetrics();
        } else if (url.indexOf('/resume') >= 0) {
          playing = true;
          logEvent('Playing');
          playTimer = setInterval(advanceStep, 800);
          if (stepIndex < currentSteps.length) fireState(currentName, currentSteps[stepIndex], false, stepIndex / currentSteps.length);
          updateMetrics();
        } else if (url.indexOf('/step') >= 0) {
          playing = false;
          if (playTimer) { clearInterval(playTimer); playTimer = null; }
          advanceStep();
        }
        return Promise.resolve({ ok: true, json: function() { return Promise.resolve({}); } });
      }
      // Mock state endpoint
      if (url.indexOf('/scenario/state') >= 0) {
        return Promise.resolve({ ok: true, json: function() {
          return Promise.resolve({
            scenario: currentName || null, chapter: null, section: null,
            step: stepIndex >= 0 && stepIndex < currentSteps.length ? currentSteps[stepIndex] : null,
            paused: !playing, speed: 1.0,
            progress: currentSteps.length > 0 ? stepIndex / currentSteps.length : 0,
            content: null, slides: null,
          });
        }});
      }
    }
    return origFetch.apply(window, arguments);
  };
}

var buttons = document.getElementById('demo-buttons');
if (buttons) {
  SCENARIOS.forEach(function(s) {
    var btn = document.createElement('button');
    btn.style.cssText = 'padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
    btn.textContent = s.name;
    btn.onclick = function() { startScenario(s); };
    buttons.appendChild(btn);
  });
}
