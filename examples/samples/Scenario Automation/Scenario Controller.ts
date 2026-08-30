// Simulates the scenario controller with outline tree, transport
// controls, and step-by-step progression — no server needed.

var SCENARIOS = [
  {
    name: 'Helpdesk Demo',
    outline: [
      { label: 'Setup', children: [
        { label: 'Navigate to portal', children: [] },
        { label: 'Login as agent', children: [] },
      ]},
      { label: 'Ticket Handling', children: [
        { label: 'Open ticket queue', children: [] },
        { label: 'Select priority ticket', children: [] },
        { label: 'Fill resolution notes', children: [] },
        { label: 'Close ticket', children: [] },
      ]},
      { label: 'Verification', children: [
        { label: 'Check dashboard metrics', children: [] },
        { label: 'Verify notification sent', children: [] },
      ]},
    ],
  },
  {
    name: 'Data Import',
    outline: [
      { label: 'Preparation', children: [
        { label: 'Open import wizard', children: [] },
        { label: 'Select CSV file', children: [] },
        { label: 'Map columns', children: [] },
      ]},
      { label: 'Execution', children: [
        { label: 'Validate data', children: [] },
        { label: 'Import records', children: [] },
        { label: 'Generate report', children: [] },
      ]},
    ],
  },
];

function flattenSteps(nodes) {
  var result = [];
  nodes.forEach(function(n) {
    if (n.children.length === 0) result.push(n.label);
    else result.push.apply(result, flattenSteps(n.children));
  });
  return result;
}

var currentScenario = null;
var allSteps = [];
var currentStepIdx = -1;
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

function updateDisplay() {
  var statusEl = document.getElementById('app-status');
  var stepEl = document.getElementById('current-step');
  var doneEl = document.getElementById('steps-done');
  var progressEl = document.getElementById('progress-text');

  if (!currentScenario) {
    if (statusEl) statusEl.textContent = 'Ready';
    if (stepEl) stepEl.textContent = '—';
    if (doneEl) doneEl.textContent = '0 / 0';
    if (progressEl) progressEl.textContent = '0%';
    return;
  }

  var total = allSteps.length;
  var done = Math.max(0, currentStepIdx);
  var pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (statusEl) {
    statusEl.textContent = currentStepIdx >= total ? 'Complete' : (playing ? 'Running' : 'Paused');
    statusEl.style.color = currentStepIdx >= total ? '#4ade80' : (playing ? '#3b82f6' : '#f59e0b');
  }
  if (stepEl) stepEl.textContent = currentStepIdx < total ? allSteps[currentStepIdx] || '—' : 'Done';
  if (doneEl) doneEl.textContent = done + ' / ' + total;
  if (progressEl) progressEl.textContent = pct + '%';
}

function renderOutline() {
  var tree = document.getElementById('outline-tree');
  if (!tree || !currentScenario) return;
  tree.innerHTML = '';

  function renderNode(node, depth) {
    var isLeaf = node.children.length === 0;
    var div = document.createElement('div');
    var stepIdx = isLeaf ? allSteps.indexOf(node.label) : -1;
    var isCurrent = isLeaf && stepIdx === currentStepIdx;
    var isCompleted = isLeaf && stepIdx >= 0 && stepIdx < currentStepIdx;

    div.style.cssText = 'padding: 3px 12px 3px ' + (depth * 16 + 8) + 'px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;';
    if (isLeaf) {
      div.style.color = isCurrent ? '#38bdf8' : (isCompleted ? '#475569' : '#94a3b8');
      if (isCurrent) div.style.fontWeight = '600';
      div.innerHTML = '<span style="width: 12px; text-align: center;">' + (isCurrent ? '●' : (isCompleted ? '✓' : '○')) + '</span>' + node.label;
    } else {
      div.style.color = '#e2e8f0';
      div.style.fontWeight = '500';
      div.textContent = node.label;
    }
    tree.appendChild(div);

    if (!isLeaf) {
      node.children.forEach(function(child) { renderNode(child, depth + 1); });
    }
  }

  currentScenario.outline.forEach(function(node) { renderNode(node, 0); });
}

function advanceStep() {
  if (!currentScenario) return;
  currentStepIdx++;
  if (currentStepIdx < allSteps.length) {
    logEvent('Step: ' + allSteps[currentStepIdx]);
  } else {
    logEvent('Scenario complete');
    playing = false;
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    var playBtn = document.getElementById('btn-play');
    if (playBtn) playBtn.textContent = '▶';
  }
  renderOutline();
  updateDisplay();
}

function startScenario(scenario) {
  currentScenario = scenario;
  allSteps = flattenSteps(scenario.outline);
  currentStepIdx = 0;
  playing = false;

  document.getElementById('event-log').innerHTML = '';
  document.getElementById('controller-panel').style.display = 'block';
  logEvent('Scenario loaded: ' + scenario.name);
  logEvent('Steps: ' + allSteps.length);
  logEvent('Step: ' + allSteps[0]);

  renderOutline();
  updateDisplay();
}

function resetController() {
  playing = false;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  currentScenario = null;
  allSteps = [];
  currentStepIdx = -1;
  document.getElementById('controller-panel').style.display = 'none';
  document.getElementById('event-log').innerHTML = '';
  var playBtn = document.getElementById('btn-play');
  if (playBtn) playBtn.textContent = '▶';
  updateDisplay();
}

var playBtn = document.getElementById('btn-play');
if (playBtn) {
  playBtn.onclick = function() {
    if (!currentScenario || currentStepIdx >= allSteps.length) return;
    playing = !playing;
    playBtn.textContent = playing ? '⏸' : '▶';
    logEvent(playing ? 'Playing' : 'Paused');
    if (playing) {
      playTimer = setInterval(function() {
        if (currentStepIdx >= allSteps.length - 1) {
          advanceStep();
          return;
        }
        advanceStep();
      }, 800);
    } else {
      if (playTimer) { clearInterval(playTimer); playTimer = null; }
    }
    updateDisplay();
  };
}

var stepBtn = document.getElementById('btn-step');
if (stepBtn) {
  stepBtn.onclick = function() {
    if (!currentScenario || currentStepIdx >= allSteps.length) return;
    if (playing) {
      playing = false;
      if (playTimer) { clearInterval(playTimer); playTimer = null; }
      var pb = document.getElementById('btn-play');
      if (pb) pb.textContent = '▶';
    }
    advanceStep();
  };
}

var resetBtn = document.getElementById('btn-reset');
if (resetBtn) { resetBtn.onclick = resetController; }

var scenarioPicker = document.getElementById('controller-scenarios');
if (scenarioPicker) {
  SCENARIOS.forEach(function(s) {
    var steps = flattenSteps(s.outline);
    var btn = document.createElement('button');
    btn.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 14px; background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 6px; cursor: pointer; color: #93c5fd; font-size: 13px; text-align: left; width: 100%;';
    btn.innerHTML = '<strong>' + s.name + '</strong><span style="font-size: 11px; color: #64748b;">' + steps.length + ' steps across ' + s.outline.length + ' sections</span>';
    btn.onmouseenter = function() { btn.style.background = 'rgba(37, 99, 235, 0.2)'; };
    btn.onmouseleave = function() { btn.style.background = 'rgba(37, 99, 235, 0.1)'; };
    btn.onclick = function() { startScenario(s); };
    scenarioPicker.appendChild(btn);
  });
}
