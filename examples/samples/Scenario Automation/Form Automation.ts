function ariaFill(name, value) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function ariaSelect(name, value) {
  var el = document.querySelector('select[aria-label="' + name + '"]');
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function ariaClick(name) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (el) el.click();
}

var SCENARIOS = [
  {
    name: 'New Engineer',
    description: 'Fills the form for an engineering hire',
    steps: [
      { action: 'fill', target: 'Full Name', value: 'Alice Chen' },
      { action: 'fill', target: 'Email', value: 'alice.chen@example.com' },
      { action: 'select', target: 'Department', value: 'Engineering' },
      { action: 'fill', target: 'Role', value: 'Senior Developer' },
      { action: 'click', target: 'Submit' },
    ],
  },
  {
    name: 'Design Lead',
    description: 'Onboards a design team lead',
    steps: [
      { action: 'fill', target: 'Full Name', value: 'Jordan Rivera' },
      { action: 'fill', target: 'Email', value: 'j.rivera@example.com' },
      { action: 'select', target: 'Department', value: 'Design' },
      { action: 'fill', target: 'Role', value: 'Design Lead' },
      { action: 'click', target: 'Submit' },
    ],
  },
  {
    name: 'Ops Rotation',
    description: 'Quick-add an operations team member',
    steps: [
      { action: 'fill', target: 'Full Name', value: 'Sam Okoro' },
      { action: 'fill', target: 'Email', value: 'sam.okoro@example.com' },
      { action: 'select', target: 'Department', value: 'Operations' },
      { action: 'fill', target: 'Role', value: 'SRE' },
      { action: 'click', target: 'Submit' },
    ],
  },
];

function resetForm() {
  var form = document.getElementById('member-form');
  if (form) {
    form.querySelectorAll('input').forEach(function(i) { i.value = ''; });
    form.querySelectorAll('select').forEach(function(s) { s.value = ''; });
  }
  var status = document.getElementById('form-status');
  if (status) status.style.display = 'none';
}

function showStatus(name) {
  var status = document.getElementById('form-status');
  if (status) {
    status.style.display = 'block';
    status.style.background = 'rgba(22, 163, 74, 0.15)';
    status.style.border = '1px solid rgba(22, 163, 74, 0.3)';
    status.style.color = '#4ade80';
    status.textContent = 'Scenario "' + name + '" completed successfully';
  }
}

async function runSteps(steps, delayMs) {
  for (var j = 0; j < steps.length; j++) {
    var step = steps[j];
    await new Promise(function(r) { setTimeout(r, delayMs); });
    if (step.action === 'fill') ariaFill(step.target, step.value || '');
    else if (step.action === 'select') ariaSelect(step.target, step.value || '');
    else if (step.action === 'click') ariaClick(step.target);
  }
}

var picker = document.getElementById('scenario-picker');
if (picker) {
  SCENARIOS.forEach(function(entry) {
    var btn = document.createElement('button');
    btn.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 14px; background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 6px; cursor: pointer; color: #93c5fd; font-size: 13px; text-align: left; transition: background 0.15s; width: 100%;';
    btn.innerHTML = '<strong>' + entry.name + '</strong><span style="font-size: 11px; color: #64748b;">' + entry.description + '</span>';
    btn.onmouseenter = function() { btn.style.background = 'rgba(37, 99, 235, 0.2)'; };
    btn.onmouseleave = function() { btn.style.background = 'rgba(37, 99, 235, 0.1)'; };
    btn.onclick = async function() {
      resetForm();
      picker.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
      await runSteps(entry.steps, 400);
      showStatus(entry.name);
      picker.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
    };
    picker.appendChild(btn);
  });
}

var submitBtn = document.querySelector('[aria-label="Submit"]');
if (submitBtn) submitBtn.addEventListener('click', function() { showStatus('Manual submission'); });

var resetBtn = document.querySelector('[aria-label="Reset"]');
if (resetBtn) resetBtn.addEventListener('click', resetForm);
