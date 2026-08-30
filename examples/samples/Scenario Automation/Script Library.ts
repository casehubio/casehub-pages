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

var SCRIPTS = [
  {
    name: 'file-access-ticket',
    description: 'File an access request ticket for a new team member',
    labels: ['domain:helpdesk', 'capability:access'],
    tags: ['onboarding'],
    readiness: 'ready',
    steps: [
      { action: 'fill', target: 'Subject', value: 'New hire access request — Dev environment' },
      { action: 'select', target: 'Priority', value: 'medium' },
      { action: 'fill', target: 'Description', value: 'Please grant Dev environment access for the new team member.' },
      { action: 'select', target: 'Category', value: 'access' },
      { action: 'click', target: 'Create Ticket' },
    ],
  },
  {
    name: 'report-hardware-issue',
    description: 'Log a hardware malfunction ticket with high priority',
    labels: ['domain:helpdesk', 'capability:hardware'],
    tags: ['incident'],
    readiness: 'ready',
    steps: [
      { action: 'fill', target: 'Subject', value: 'Monitor flickering — Desk 4B' },
      { action: 'select', target: 'Priority', value: 'high' },
      { action: 'fill', target: 'Description', value: 'External monitor flickering intermittently. Display cable and power already checked.' },
      { action: 'select', target: 'Category', value: 'hardware' },
      { action: 'click', target: 'Create Ticket' },
    ],
  },
  {
    name: 'software-install-request',
    description: 'Request a licensed software installation',
    labels: ['domain:helpdesk', 'capability:software'],
    tags: ['request'],
    readiness: 'ready',
    steps: [
      { action: 'fill', target: 'Subject', value: 'Install IntelliJ IDEA Ultimate — Engineering' },
      { action: 'select', target: 'Priority', value: 'low' },
      { action: 'fill', target: 'Description', value: 'Need IntelliJ IDEA Ultimate license on workstation ENG-042. Approved by manager.' },
      { action: 'select', target: 'Category', value: 'software' },
      { action: 'click', target: 'Create Ticket' },
    ],
  },
  {
    name: 'critical-outage',
    description: 'File a critical P0 network outage ticket',
    labels: ['domain:helpdesk', 'capability:network'],
    tags: ['incident', 'critical'],
    readiness: 'ready',
    steps: [
      { action: 'fill', target: 'Subject', value: 'OUTAGE: Building 3 network down' },
      { action: 'select', target: 'Priority', value: 'critical' },
      { action: 'fill', target: 'Description', value: 'Complete network outage in Building 3. ~200 users impacted.' },
      { action: 'select', target: 'Category', value: 'network' },
      { action: 'click', target: 'Create Ticket' },
    ],
  },
  {
    name: 'new-account-setup',
    description: 'Set up accounts for a new employee across all systems',
    labels: ['domain:helpdesk', 'capability:access'],
    tags: ['onboarding', 'getting-started'],
    readiness: 'ready',
    steps: [
      { action: 'fill', target: 'Subject', value: 'New employee account setup — Morgan Taylor' },
      { action: 'select', target: 'Priority', value: 'medium' },
      { action: 'fill', target: 'Description', value: 'New engineer starting Monday. Need email, Slack, GitHub, JIRA, VPN, badge.' },
      { action: 'select', target: 'Category', value: 'account' },
      { action: 'click', target: 'Create Ticket' },
    ],
  },
];

var READINESS_COLORS = {
  ready: { bg: 'rgba(22, 163, 74, 0.15)', text: '#4ade80' },
  'not-ready': { bg: 'rgba(220, 38, 38, 0.15)', text: '#f87171' },
  unknown: { bg: 'rgba(202, 138, 4, 0.15)', text: '#fbbf24' },
};

var activeFilter = null;
var searchQuery = '';

function clearForm() {
  var form = document.getElementById('ticket-form');
  if (form) {
    form.querySelectorAll('input, textarea').forEach(function(el) { el.value = ''; });
    form.querySelectorAll('select').forEach(function(el) { el.value = ''; });
  }
  var badge = document.getElementById('ticket-badge');
  if (badge) badge.style.display = 'none';
}

function showTicketCreated() {
  var badge = document.getElementById('ticket-badge');
  if (badge) {
    badge.style.display = 'inline';
    badge.textContent = 'Created';
    badge.style.background = 'rgba(22, 163, 74, 0.2)';
    badge.style.color = '#4ade80';
  }
  var open = document.getElementById('metric-open');
  if (open) open.textContent = String(parseInt(open.textContent || '12') + 1);
}

async function runSteps(steps, delayMs) {
  var badge = document.getElementById('ticket-badge');
  if (badge) { badge.style.display = 'inline'; badge.textContent = 'Running...'; badge.style.background = 'rgba(59, 130, 246, 0.2)'; badge.style.color = '#93c5fd'; }
  for (var j = 0; j < steps.length; j++) {
    await new Promise(function(r) { setTimeout(r, delayMs); });
    var step = steps[j];
    if (step.action === 'fill') ariaFill(step.target, step.value || '');
    else if (step.action === 'select') ariaSelect(step.target, step.value || '');
    else if (step.action === 'click') ariaClick(step.target);
  }
  showTicketCreated();
}

function getFilteredScripts() {
  return SCRIPTS.filter(function(s) {
    if (activeFilter && s.labels.indexOf(activeFilter) === -1) return false;
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      return s.name.toLowerCase().indexOf(q) >= 0 || s.description.toLowerCase().indexOf(q) >= 0;
    }
    return true;
  });
}

function renderScripts() {
  var list = document.getElementById('script-list');
  if (!list) return;
  list.innerHTML = '';
  var filtered = getFilteredScripts();

  filtered.forEach(function(script) {
    var colors = READINESS_COLORS[script.readiness] || READINESS_COLORS['unknown'];
    var item = document.createElement('div');
    item.style.cssText = 'padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: flex-start; gap: 10px; cursor: pointer; transition: background 0.1s;';
    item.onmouseenter = function() { item.style.background = 'rgba(255,255,255,0.03)'; };
    item.onmouseleave = function() { item.style.background = 'none'; };

    var labelsHtml = script.labels.map(function(l) { return '<span style="font-size: 9px; padding: 1px 4px; border-radius: 2px; background: rgba(255,255,255,0.06); color: #94a3b8;">' + l + '</span>'; }).join('');
    var tagsHtml = script.tags.map(function(t) { return '<span style="font-size: 9px; padding: 1px 4px; border-radius: 2px; background: rgba(255,255,255,0.06); color: #64748b;">' + t + '</span>'; }).join('');

    item.innerHTML = '<span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ' + colors.bg + '; color: ' + colors.text + '; flex-shrink: 0; min-width: 52px; text-align: center;">' + script.readiness + '</span>' +
      '<div style="flex: 1; min-width: 0;">' +
        '<div style="font-size: 13px; font-weight: 500; color: var(--pages-text-primary, #eee);">' + script.name + '</div>' +
        '<div style="font-size: 11px; color: var(--pages-text-muted, #888); margin-top: 2px;">' + script.description + '</div>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">' + labelsHtml + tagsHtml + '</div>' +
      '</div>' +
      '<button style="flex-shrink: 0; padding: 4px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" class="run-btn">Run</button>';

    var btn = item.querySelector('.run-btn');
    btn.onclick = async function(e) {
      e.stopPropagation();
      clearForm();
      btn.disabled = true;
      btn.textContent = '...';
      await runSteps(script.steps, 350);
      btn.disabled = false;
      btn.textContent = 'Run';
    };
    list.appendChild(item);
  });

  var count = document.getElementById('script-count');
  if (count) count.textContent = filtered.length + ' scripts';
}

function renderFilters() {
  var labelSet = {};
  SCRIPTS.forEach(function(s) { s.labels.forEach(function(l) { labelSet[l] = true; }); });
  var allLabels = Object.keys(labelSet).sort();
  var container = document.getElementById('label-filters');
  if (!container) return;
  container.innerHTML = '';
  allLabels.forEach(function(label) {
    var chip = document.createElement('span');
    var isActive = activeFilter === label;
    chip.style.cssText = 'font-size: 10px; padding: 2px 8px; border-radius: 10px; cursor: pointer; transition: background 0.1s; ' + (isActive ? 'background: #2563eb; color: white;' : 'background: rgba(255,255,255,0.06); color: #94a3b8;');
    chip.textContent = label;
    chip.onclick = function() {
      activeFilter = activeFilter === label ? null : label;
      renderFilters();
      renderScripts();
    };
    container.appendChild(chip);
  });
}

var searchEl = document.getElementById('library-search');
if (searchEl) {
  searchEl.addEventListener('input', function() {
    searchQuery = searchEl.value;
    renderScripts();
  });
}

var createBtn = document.querySelector('[aria-label="Create Ticket"]');
if (createBtn) createBtn.addEventListener('click', showTicketCreated);
var clearFormBtn = document.querySelector('[aria-label="Clear"]');
if (clearFormBtn) clearFormBtn.addEventListener('click', clearForm);

renderFilters();
renderScripts();
