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
function ariaCheck(name, checked) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (el) el.checked = checked;
}
function ariaClick(name) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (el) el.click();
}

var PARAMS = [
  { name: 'projectName', label: 'Project Name *', type: 'text', required: true, defaultValue: 'Acme Portal' },
  { name: 'template', label: 'Template', type: 'select', required: false, defaultValue: 'starter', options: [{ value: 'blank', text: 'Blank Project' }, { value: 'starter', text: 'Starter Kit' }, { value: 'enterprise', text: 'Enterprise Suite' }] },
  { name: 'teamSize', label: 'Team Size', type: 'number', required: false, defaultValue: '5' },
  { name: 'enableCI', label: 'Enable CI', type: 'checkbox', required: false, defaultValue: 'true' },
];

var paramForm = document.getElementById('param-form');
if (paramForm) {
  PARAMS.forEach(function(p) {
    var wrapper = document.createElement('div');
    var label = document.createElement('label');
    label.textContent = p.label;
    label.style.cssText = 'display: block; margin-bottom: 3px; font-size: 11px; color: var(--pages-neutral-9);';
    wrapper.appendChild(label);

    if (p.type === 'select') {
      var sel = document.createElement('select');
      sel.id = 'param-' + p.name;
      sel.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 12px;';
      p.options.forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt.value || opt; o.textContent = opt.text || opt;
        if ((opt.value || opt) === p.defaultValue) o.selected = true;
        sel.appendChild(o);
      });
      wrapper.appendChild(sel);
    } else if (p.type === 'checkbox') {
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = 'param-' + p.name;
      cb.checked = p.defaultValue === 'true';
      cb.style.cssText = 'width: 16px; height: 16px;';
      wrapper.appendChild(cb);
    } else {
      var inp = document.createElement('input');
      inp.type = p.type; inp.id = 'param-' + p.name;
      inp.value = p.defaultValue || '';
      inp.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 12px; box-sizing: border-box;';
      wrapper.appendChild(inp);
    }
    paramForm.appendChild(wrapper);
  });
}

function getParamValues() {
  var values = {};
  PARAMS.forEach(function(p) {
    var el = document.getElementById('param-' + p.name);
    if (!el) return;
    if (p.type === 'checkbox') values[p.name] = el.checked;
    else values[p.name] = el.value;
  });
  return values;
}

function showStatus(msg, success) {
  var status = document.getElementById('project-status');
  if (status) {
    status.style.display = 'block';
    status.style.background = success ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)';
    status.style.border = '1px solid ' + (success ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)');
    status.style.color = success ? '#4ade80' : '#f87171';
    status.textContent = msg;
  }
}

async function runParameterized(params) {
  var steps = [
    { action: 'fill', target: 'Project Name', value: params.projectName },
    { action: 'select', target: 'Template', value: params.template },
    { action: 'fill', target: 'Team Size', value: '' + params.teamSize },
  ];

  if (params.enableCI) {
    var cb = document.querySelector('[aria-label="Enable CI"]');
    if (cb && !cb.checked) steps.push({ action: 'check', target: 'Enable CI' });
  } else {
    var cb2 = document.querySelector('[aria-label="Enable CI"]');
    if (cb2 && cb2.checked) steps.push({ action: 'uncheck', target: 'Enable CI' });
  }

  steps.push({ action: 'click', target: 'Create Project' });

  for (var j = 0; j < steps.length; j++) {
    await new Promise(function(r) { setTimeout(r, 400); });
    var step = steps[j];
    if (step.action === 'fill') ariaFill(step.target, step.value);
    else if (step.action === 'select') ariaSelect(step.target, step.value);
    else if (step.action === 'click') ariaClick(step.target);
    else if (step.action === 'check') ariaCheck(step.target, true);
    else if (step.action === 'uncheck') ariaCheck(step.target, false);
  }
}

var runBtn = document.getElementById('run-param-btn');
if (runBtn) {
  runBtn.onclick = async function() {
    var params = getParamValues();
    if (!params.projectName) {
      showStatus('Missing required parameter: Project Name', false);
      return;
    }
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';

    var form = document.getElementById('project-form');
    if (form) {
      form.querySelectorAll('input').forEach(function(i) { if (i.type !== 'checkbox') i.value = ''; });
      form.querySelectorAll('select').forEach(function(s) { s.value = ''; });
    }
    var status = document.getElementById('project-status');
    if (status) status.style.display = 'none';

    await runParameterized(params);
    showStatus('Project "' + params.projectName + '" created with template "' + params.template + '" (team: ' + params.teamSize + ', CI: ' + (params.enableCI ? 'on' : 'off') + ')', true);
    runBtn.disabled = false;
    runBtn.textContent = 'Run with Parameters';
  };
}

var createBtn = document.querySelector('[aria-label="Create Project"]');
if (createBtn) createBtn.addEventListener('click', function() { showStatus('Project created manually', true); });
var resetBtn = document.querySelector('[aria-label="Reset"]');
if (resetBtn) resetBtn.addEventListener('click', function() {
  var form = document.getElementById('project-form');
  if (form) {
    form.querySelectorAll('input').forEach(function(i) { if (i.type === 'checkbox') i.checked = true; else i.value = ''; });
    form.querySelectorAll('select').forEach(function(s) { s.value = ''; });
  }
  var status = document.getElementById('project-status');
  if (status) status.style.display = 'none';
});
