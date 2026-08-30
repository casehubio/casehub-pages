// Demonstrates script composability — a parent script calls child
// scripts for each form section. Each sub-script highlights its
// section as it runs.

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
function ariaCheck(name) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (el) el.checked = true;
}

function showBadge(id, text, color) {
  var badge = document.getElementById('badge-' + id);
  if (badge) {
    badge.style.display = 'inline';
    badge.textContent = text;
    badge.style.background = color === 'running' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(22, 163, 74, 0.2)';
    badge.style.color = color === 'running' ? '#93c5fd' : '#4ade80';
  }
}

function highlightSection(id, active) {
  var section = document.getElementById('section-' + id);
  if (section) {
    section.style.borderColor = active ? '#2563eb' : '';
    section.style.boxShadow = active ? '0 0 0 1px #2563eb' : '';
  }
}

async function delay(ms) { await new Promise(function(r) { setTimeout(r, ms); }); }

var CHILD_SCRIPTS = {
  identity: {
    label: 'fill-identity',
    section: 'identity',
    steps: [
      { fn: ariaFill, args: ['First Name', 'Morgan'] },
      { fn: ariaFill, args: ['Last Name', 'Taylor'] },
      { fn: ariaFill, args: ['Email', 'morgan.taylor@example.com'] },
    ],
  },
  role: {
    label: 'assign-role',
    section: 'role',
    steps: [
      { fn: ariaSelect, args: ['Department', 'Engineering'] },
      { fn: ariaFill, args: ['Job Title', 'Senior Platform Engineer'] },
    ],
  },
  access: {
    label: 'grant-access',
    section: 'access',
    steps: [
      { fn: ariaCheck, args: ['GitHub'] },
      { fn: ariaCheck, args: ['Slack'] },
      { fn: ariaCheck, args: ['JIRA'] },
      { fn: ariaCheck, args: ['VPN'] },
    ],
  },
};

async function runChildScript(key) {
  var child = CHILD_SCRIPTS[key];
  highlightSection(child.section, true);
  showBadge(child.section, 'running: ' + child.label, 'running');
  for (var i = 0; i < child.steps.length; i++) {
    await delay(350);
    var step = child.steps[i];
    step.fn.apply(null, step.args);
  }
  await delay(200);
  highlightSection(child.section, false);
  showBadge(child.section, 'done', 'done');
}

async function runFullWorkflow() {
  await runChildScript('identity');
  await delay(300);
  await runChildScript('role');
  await delay(300);
  await runChildScript('access');
}

function resetAll() {
  document.querySelectorAll('input[role="textbox"]').forEach(function(el) { el.value = ''; });
  document.querySelectorAll('select[role="listbox"]').forEach(function(el) { el.value = ''; });
  document.querySelectorAll('input[role="checkbox"]').forEach(function(el) { el.checked = false; });
  ['identity', 'role', 'access'].forEach(function(id) {
    var badge = document.getElementById('badge-' + id);
    if (badge) badge.style.display = 'none';
    highlightSection(id, false);
  });
}

var WORKFLOWS = [
  { name: 'Full Onboarding', description: 'Runs all 3 child scripts in sequence', run: runFullWorkflow },
  { name: 'Identity Only', description: 'Runs fill-identity sub-script', run: function() { return runChildScript('identity'); } },
  { name: 'Role Only', description: 'Runs assign-role sub-script', run: function() { return runChildScript('role'); } },
  { name: 'Access Only', description: 'Runs grant-access sub-script', run: function() { return runChildScript('access'); } },
];

var picker = document.getElementById('workflow-picker');
if (picker) {
  WORKFLOWS.forEach(function(entry) {
    var btn = document.createElement('button');
    btn.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 14px; background: var(--pages-accent-3); border: 1px solid var(--pages-accent-6); border-radius: 6px; cursor: pointer; color: var(--pages-accent-9); font-size: 13px; text-align: left; width: 100%;';
    btn.innerHTML = '<strong>' + entry.name + '</strong><span style="font-size: 11px; color: var(--pages-neutral-8);">' + entry.description + '</span>';
    btn.onmouseenter = function() { btn.style.background = 'rgba(37, 99, 235, 0.2)'; };
    btn.onmouseleave = function() { btn.style.background = 'rgba(37, 99, 235, 0.1)'; };
    btn.onclick = async function() {
      resetAll();
      picker.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
      await entry.run();
      picker.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
    };
    picker.appendChild(btn);
  });

  var clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'padding: 8px; background: var(--pages-neutral-2); border: 1px solid var(--pages-neutral-4); border-radius: 6px; cursor: pointer; color: var(--pages-neutral-9); font-size: 12px; width: 100%;';
  clearBtn.textContent = 'Reset';
  clearBtn.onclick = resetAll;
  picker.appendChild(clearBtn);
}
