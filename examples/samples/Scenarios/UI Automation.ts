function uaFill(name, value) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function uaSelect(name, value) {
  var el = document.querySelector('select[aria-label="' + name + '"]');
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function uaClick(name) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (el) el.click();
}
function uaCheck(name, checked) {
  var el = document.querySelector('[aria-label="' + name + '"]');
  if (el) el.checked = checked !== false;
}
async function uaDelay(ms) { await new Promise(function(r) { setTimeout(r, ms); }); }

var UA_DESCRIPTIONS = [
  'Fill, select, and click form elements using ARIA labels. The simplest automation pattern — one script drives a single form.',
  'A parent script <strong>calls</strong> child scripts for each form section. Watch each section light up as its sub-script runs.',
  'Customize script parameters before execution. The script builds its step list dynamically from the supplied parameter values.',
  'Populate a data grid row-by-row using scoped ARIA targeting. Each row\'s inputs are targeted within the row context.'
];

var UA_TEMPLATES = [
  '<div style="max-width: 500px;">' +
    '<form id="member-form" style="display: flex; flex-direction: column; gap: 12px;">' +
      '<div><label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--pages-neutral-9);">Full Name</label>' +
        '<input aria-label="Full Name" role="textbox" style="width: 100%; padding: 8px 12px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 14px; box-sizing: border-box;" /></div>' +
      '<div><label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--pages-neutral-9);">Email</label>' +
        '<input aria-label="Email" role="textbox" style="width: 100%; padding: 8px 12px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 14px; box-sizing: border-box;" /></div>' +
      '<div><label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--pages-neutral-9);">Department</label>' +
        '<select aria-label="Department" role="listbox" style="width: 100%; padding: 8px 12px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 14px;">' +
          '<option value="">Select...</option><option value="Engineering">Engineering</option><option value="Design">Design</option><option value="Product">Product</option><option value="Operations">Operations</option>' +
        '</select></div>' +
      '<div><label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--pages-neutral-9);">Role</label>' +
        '<input aria-label="Role" role="textbox" style="width: 100%; padding: 8px 12px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 14px; box-sizing: border-box;" /></div>' +
      '<div style="display: flex; gap: 8px; margin-top: 8px;">' +
        '<button type="button" aria-label="Submit" role="button" style="padding: 8px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Submit</button>' +
        '<button type="button" aria-label="Reset" role="button" style="padding: 8px 24px; background: var(--pages-neutral-3); color: var(--pages-neutral-12); border: 1px solid var(--pages-neutral-5); border-radius: 6px; cursor: pointer; font-size: 14px;">Reset</button>' +
      '</div>' +
    '</form></div>',

  '<div style="display: flex; flex-direction: column; gap: 16px;">' +
    '<div id="section-identity" style="background: var(--pages-neutral-2); border: 1px solid var(--pages-neutral-4); border-radius: 8px; overflow: hidden;">' +
      '<div style="padding: 10px 16px; border-bottom: 1px solid var(--pages-neutral-4); font-size: 13px; font-weight: 600; color: var(--pages-neutral-12); display: flex; justify-content: space-between;"><span>1. Identity</span><span id="badge-identity" style="font-size: 10px; padding: 2px 8px; border-radius: 10px; display: none;"></span></div>' +
      '<div style="padding: 12px 16px; display: flex; gap: 12px;">' +
        '<div style="flex: 1;"><label style="display: block; margin-bottom: 4px; font-size: 11px; color: var(--pages-neutral-9);">First Name</label><input aria-label="First Name" role="textbox" style="width: 100%; padding: 6px 10px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-1); color: var(--pages-neutral-12); font-size: 13px; box-sizing: border-box;" /></div>' +
        '<div style="flex: 1;"><label style="display: block; margin-bottom: 4px; font-size: 11px; color: var(--pages-neutral-9);">Last Name</label><input aria-label="Last Name" role="textbox" style="width: 100%; padding: 6px 10px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-1); color: var(--pages-neutral-12); font-size: 13px; box-sizing: border-box;" /></div>' +
        '<div style="flex: 1;"><label style="display: block; margin-bottom: 4px; font-size: 11px; color: var(--pages-neutral-9);">Email</label><input aria-label="Email" role="textbox" style="width: 100%; padding: 6px 10px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-1); color: var(--pages-neutral-12); font-size: 13px; box-sizing: border-box;" /></div>' +
      '</div></div>' +
    '<div id="section-role" style="background: var(--pages-neutral-2); border: 1px solid var(--pages-neutral-4); border-radius: 8px; overflow: hidden;">' +
      '<div style="padding: 10px 16px; border-bottom: 1px solid var(--pages-neutral-4); font-size: 13px; font-weight: 600; color: var(--pages-neutral-12); display: flex; justify-content: space-between;"><span>2. Role Assignment</span><span id="badge-role" style="font-size: 10px; padding: 2px 8px; border-radius: 10px; display: none;"></span></div>' +
      '<div style="padding: 12px 16px; display: flex; gap: 12px;">' +
        '<div style="flex: 1;"><label style="display: block; margin-bottom: 4px; font-size: 11px; color: var(--pages-neutral-9);">Department</label><select aria-label="Department" role="listbox" style="width: 100%; padding: 6px 10px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-1); color: var(--pages-neutral-12); font-size: 13px;"><option value="">Select...</option><option value="Engineering">Engineering</option><option value="Design">Design</option><option value="Product">Product</option></select></div>' +
        '<div style="flex: 1;"><label style="display: block; margin-bottom: 4px; font-size: 11px; color: var(--pages-neutral-9);">Job Title</label><input aria-label="Job Title" role="textbox" style="width: 100%; padding: 6px 10px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-1); color: var(--pages-neutral-12); font-size: 13px; box-sizing: border-box;" /></div>' +
      '</div></div>' +
    '<div id="section-access" style="background: var(--pages-neutral-2); border: 1px solid var(--pages-neutral-4); border-radius: 8px; overflow: hidden;">' +
      '<div style="padding: 10px 16px; border-bottom: 1px solid var(--pages-neutral-4); font-size: 13px; font-weight: 600; color: var(--pages-neutral-12); display: flex; justify-content: space-between;"><span>3. Access &amp; Tools</span><span id="badge-access" style="font-size: 10px; padding: 2px 8px; border-radius: 10px; display: none;"></span></div>' +
      '<div style="padding: 12px 16px; display: flex; gap: 16px; flex-wrap: wrap;">' +
        '<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--pages-neutral-12); cursor: pointer;"><input aria-label="GitHub" type="checkbox" role="checkbox" style="width: 16px; height: 16px;" /> GitHub</label>' +
        '<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--pages-neutral-12); cursor: pointer;"><input aria-label="Slack" type="checkbox" role="checkbox" style="width: 16px; height: 16px;" /> Slack</label>' +
        '<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--pages-neutral-12); cursor: pointer;"><input aria-label="JIRA" type="checkbox" role="checkbox" style="width: 16px; height: 16px;" /> JIRA</label>' +
        '<label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--pages-neutral-12); cursor: pointer;"><input aria-label="VPN" type="checkbox" role="checkbox" style="width: 16px; height: 16px;" /> VPN</label>' +
      '</div></div>' +
  '</div>',

  '<form id="project-form" style="display: flex; flex-direction: column; gap: 12px; max-width: 500px;">' +
    '<div><label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--pages-neutral-9);">Project Name</label>' +
      '<input aria-label="Project Name" role="textbox" style="width: 100%; padding: 8px 12px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 14px; box-sizing: border-box;" /></div>' +
    '<div><label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--pages-neutral-9);">Template</label>' +
      '<select aria-label="Template" role="listbox" style="width: 100%; padding: 8px 12px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 14px;">' +
        '<option value="">Select template...</option><option value="blank">Blank</option><option value="starter" selected>Starter</option><option value="enterprise">Enterprise</option></select></div>' +
    '<div><label style="display: block; margin-bottom: 4px; font-size: 13px; color: var(--pages-neutral-9);">Team Size</label>' +
      '<input aria-label="Team Size" type="number" role="textbox" value="5" style="width: 100%; padding: 8px 12px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 14px; box-sizing: border-box;" /></div>' +
    '<div style="display: flex; align-items: center; gap: 8px;">' +
      '<input aria-label="Enable CI" type="checkbox" role="checkbox" checked style="width: 18px; height: 18px; cursor: pointer;" />' +
      '<label style="font-size: 14px; color: var(--pages-neutral-12);">Enable CI Pipeline</label></div>' +
    '<div style="display: flex; gap: 8px; margin-top: 8px;">' +
      '<button type="button" aria-label="Create Project" role="button" style="padding: 8px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Create Project</button>' +
      '<button type="button" aria-label="Reset" role="button" style="padding: 8px 24px; background: var(--pages-neutral-3); color: var(--pages-neutral-12); border: 1px solid var(--pages-neutral-5); border-radius: 6px; cursor: pointer; font-size: 14px;">Reset</button>' +
    '</div></form>',

  '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">' +
    '<h3 style="margin: 0; color: var(--pages-neutral-12); font-size: 16px;">Sprint Team Roster</h3>' +
    '<div id="table-controls" style="display: flex; gap: 8px;"></div></div>' +
  '<table role="grid" aria-label="Team Roster" style="width: 100%; border-collapse: collapse; background: var(--pages-neutral-2); border-radius: 8px; overflow: hidden;">' +
    '<thead><tr style="background: var(--pages-neutral-1);">' +
      '<th style="padding: 10px 16px; text-align: left; font-size: 12px; color: var(--pages-neutral-9); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">#</th>' +
      '<th style="padding: 10px 16px; text-align: left; font-size: 12px; color: var(--pages-neutral-9); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Name</th>' +
      '<th style="padding: 10px 16px; text-align: left; font-size: 12px; color: var(--pages-neutral-9); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Role</th>' +
      '<th style="padding: 10px 16px; text-align: left; font-size: 12px; color: var(--pages-neutral-9); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Capacity</th>' +
      '<th style="padding: 10px 16px; text-align: center; font-size: 12px; color: var(--pages-neutral-9); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Active</th>' +
    '</tr></thead><tbody id="team-table-body"></tbody></table>' +
  '<div id="table-status" style="margin-top: 12px; font-size: 12px; color: var(--pages-neutral-9);"></div>'
];

var uaContent = document.getElementById('ua-content');
var uaControls = document.getElementById('ua-controls');
var uaDesc = document.getElementById('ua-description');
var uaStatus = document.getElementById('ua-status');
var uaPicker = document.getElementById('ua-example-picker');
var uaCurrentExample = -1;

function uaShowStatus(msg, success) {
  if (!uaStatus) return;
  uaStatus.style.display = 'block';
  uaStatus.style.background = success ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)';
  uaStatus.style.border = '1px solid ' + (success ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)');
  uaStatus.style.color = success ? '#4ade80' : '#f87171';
  uaStatus.textContent = msg;
}

function uaMakeBtn(text, primary, onClick) {
  var btn = document.createElement('button');
  btn.style.cssText = primary
    ? 'width: 100%; padding: 10px 14px; background: var(--pages-accent-3); border: 1px solid var(--pages-accent-6); border-radius: 6px; cursor: pointer; color: var(--pages-accent-9); font-size: 13px; text-align: left;'
    : 'width: 100%; padding: 8px; background: var(--pages-neutral-2); border: 1px solid var(--pages-neutral-4); border-radius: 6px; cursor: pointer; color: var(--pages-neutral-9); font-size: 12px;';
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function uaSetupExample0() {
  uaControls.innerHTML = '';
  uaControls.appendChild(uaMakeBtn('Run Ticket Intake', true, async function() {
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
    if (uaStatus) uaStatus.style.display = 'none';
    var steps = [
      { action: 'fill', target: 'Full Name', value: 'Alice Chen' },
      { action: 'fill', target: 'Email', value: 'alice.chen@example.com' },
      { action: 'select', target: 'Department', value: 'Engineering' },
      { action: 'fill', target: 'Role', value: 'Senior Developer' },
      { action: 'click', target: 'Submit' },
    ];
    for (var j = 0; j < steps.length; j++) {
      await uaDelay(400);
      var s = steps[j];
      if (s.action === 'fill') uaFill(s.target, s.value);
      else if (s.action === 'select') uaSelect(s.target, s.value);
      else if (s.action === 'click') uaClick(s.target);
    }
    uaShowStatus('Ticket intake completed', true);
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
  }));
  uaControls.appendChild(uaMakeBtn('Reset', false, function() {
    var form = document.getElementById('member-form');
    if (form) { form.querySelectorAll('input').forEach(function(i) { i.value = ''; }); form.querySelectorAll('select').forEach(function(s) { s.value = ''; }); }
    if (uaStatus) uaStatus.style.display = 'none';
  }));
}

function uaSetupExample1() {
  uaControls.innerHTML = '';
  var info = document.createElement('div');
  info.style.cssText = 'font-size: 11px; color: var(--pages-neutral-9); padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px; font-family: monospace; line-height: 1.6;';
  info.innerHTML = 'onboard-employee (parent)<br/>&nbsp;&nbsp;→ call: fill-identity<br/>&nbsp;&nbsp;→ call: assign-role<br/>&nbsp;&nbsp;→ call: grant-access';
  uaControls.appendChild(info);

  function showBadge(id, text, color) {
    var badge = document.getElementById('badge-' + id);
    if (badge) { badge.style.display = 'inline'; badge.textContent = text; badge.style.background = color === 'running' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(22, 163, 74, 0.2)'; badge.style.color = color === 'running' ? '#93c5fd' : '#4ade80'; }
  }
  function highlight(id, active) {
    var sec = document.getElementById('section-' + id);
    if (sec) { sec.style.borderColor = active ? '#2563eb' : ''; sec.style.boxShadow = active ? '0 0 0 1px #2563eb' : ''; }
  }
  var CHILDREN = {
    identity: { label: 'fill-identity', steps: [['First Name', 'Morgan'], ['Last Name', 'Taylor'], ['Email', 'morgan.taylor@example.com']] },
    role: { label: 'assign-role', steps: 'select' },
    access: { label: 'grant-access', steps: 'check' },
  };
  async function runChild(key) {
    highlight(key, true);
    showBadge(key, 'running: ' + CHILDREN[key].label, 'running');
    if (key === 'identity') {
      for (var i = 0; i < CHILDREN[key].steps.length; i++) { await uaDelay(350); uaFill(CHILDREN[key].steps[i][0], CHILDREN[key].steps[i][1]); }
    } else if (key === 'role') {
      await uaDelay(350); uaSelect('Department', 'Engineering');
      await uaDelay(350); uaFill('Job Title', 'Senior Platform Engineer');
    } else if (key === 'access') {
      var tools = ['GitHub', 'Slack', 'JIRA', 'VPN'];
      for (var t = 0; t < tools.length; t++) { await uaDelay(350); uaCheck(tools[t], true); }
    }
    await uaDelay(200);
    highlight(key, false);
    showBadge(key, 'done', 'done');
  }
  uaControls.appendChild(uaMakeBtn('Full Onboarding', true, async function() {
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
    await runChild('identity'); await uaDelay(300); await runChild('role'); await uaDelay(300); await runChild('access');
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
  }));
  uaControls.appendChild(uaMakeBtn('Reset', false, function() {
    uaContent.querySelectorAll('input[role="textbox"]').forEach(function(el) { el.value = ''; });
    uaContent.querySelectorAll('select[role="listbox"]').forEach(function(el) { el.value = ''; });
    uaContent.querySelectorAll('input[role="checkbox"]').forEach(function(el) { el.checked = false; });
    ['identity', 'role', 'access'].forEach(function(id) { var b = document.getElementById('badge-' + id); if (b) b.style.display = 'none'; highlight(id, false); });
  }));
}

function uaSetupExample2() {
  uaControls.innerHTML = '';
  var PARAMS = [
    { name: 'projectName', label: 'Project Name *', type: 'text', defaultValue: 'Acme Portal' },
    { name: 'template', label: 'Template', type: 'select', defaultValue: 'starter', options: [{value:'blank',text:'Blank'},{value:'starter',text:'Starter'},{value:'enterprise',text:'Enterprise'}] },
    { name: 'teamSize', label: 'Team Size', type: 'number', defaultValue: '5' },
    { name: 'enableCI', label: 'Enable CI', type: 'checkbox', defaultValue: 'true' },
  ];
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
      p.options.forEach(function(opt) { var o = document.createElement('option'); o.value = opt.value; o.textContent = opt.text; if (opt.value === p.defaultValue) o.selected = true; sel.appendChild(o); });
      wrapper.appendChild(sel);
    } else if (p.type === 'checkbox') {
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'param-' + p.name; cb.checked = p.defaultValue === 'true'; cb.style.cssText = 'width: 16px; height: 16px;';
      wrapper.appendChild(cb);
    } else {
      var inp = document.createElement('input'); inp.type = p.type; inp.id = 'param-' + p.name; inp.value = p.defaultValue || '';
      inp.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-2); color: var(--pages-neutral-12); font-size: 12px; box-sizing: border-box;';
      wrapper.appendChild(inp);
    }
    uaControls.appendChild(wrapper);
  });
  uaControls.appendChild(uaMakeBtn('Run with Parameters', true, async function() {
    var pv = {};
    PARAMS.forEach(function(p) { var el = document.getElementById('param-' + p.name); if (!el) return; pv[p.name] = p.type === 'checkbox' ? el.checked : el.value; });
    if (!pv.projectName) { uaShowStatus('Missing required parameter: Project Name', false); return; }
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
    if (uaStatus) uaStatus.style.display = 'none';
    var form = document.getElementById('project-form');
    if (form) { form.querySelectorAll('input').forEach(function(i) { if (i.type !== 'checkbox') i.value = ''; }); form.querySelectorAll('select').forEach(function(s) { s.value = ''; }); }
    await uaDelay(400); uaFill('Project Name', pv.projectName);
    await uaDelay(400); uaSelect('Template', pv.template);
    await uaDelay(400); uaFill('Team Size', '' + pv.teamSize);
    await uaDelay(400);
    var ciEl = document.querySelector('[aria-label="Enable CI"]');
    if (ciEl) ciEl.checked = !!pv.enableCI;
    await uaDelay(400); uaClick('Create Project');
    uaShowStatus('Project "' + pv.projectName + '" created (template: ' + pv.template + ', team: ' + pv.teamSize + ', CI: ' + (pv.enableCI ? 'on' : 'off') + ')', true);
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
  }));
}

function uaSetupExample3() {
  uaControls.innerHTML = '';
  var tbody = document.getElementById('team-table-body');
  if (tbody) {
    var ROW_COUNT = 5;
    var IS = 'width: 100%; padding: 6px 10px; border: 1px solid var(--pages-neutral-5); border-radius: 4px; background: var(--pages-neutral-1); color: var(--pages-neutral-12); font-size: 13px; box-sizing: border-box;';
    for (var i = 0; i < ROW_COUNT; i++) {
      var tr = document.createElement('tr');
      tr.setAttribute('role', 'row');
      tr.style.cssText = 'border-bottom: 1px solid var(--pages-neutral-4);';
      tr.innerHTML = '<td style="padding: 8px 16px; color: var(--pages-text-muted, #888); font-size: 13px;">' + (i + 1) + '</td>' +
        '<td style="padding: 6px 8px;"><input aria-label="Name" role="textbox" style="' + IS + '" /></td>' +
        '<td style="padding: 6px 8px;"><input aria-label="Role" role="textbox" style="' + IS + '" /></td>' +
        '<td style="padding: 6px 8px;"><input aria-label="Capacity" type="number" role="textbox" style="' + IS + '" /></td>' +
        '<td style="padding: 6px 8px; text-align: center;"><input aria-label="Active" type="checkbox" role="checkbox" style="width: 18px; height: 18px; cursor: pointer;" checked /></td>';
      tbody.appendChild(tr);
    }
  }
  var TEAM = [
    { name: 'Alice Chen', role: 'Tech Lead', capacity: '8', active: true },
    { name: 'Bob Kim', role: 'Senior Dev', capacity: '6', active: true },
    { name: 'Carlos Ruiz', role: 'Developer', capacity: '8', active: true },
    { name: 'Diana Park', role: 'QA Engineer', capacity: '5', active: false },
    { name: 'Eve Johnson', role: 'Designer', capacity: '4', active: true },
  ];
  function fillRowField(rowIdx, label, value) {
    var rows = document.querySelectorAll('[role="row"]');
    var row = rows[rowIdx]; if (!row) return;
    var input = row.querySelector('[aria-label="' + label + '"]'); if (!input) return;
    input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function clearGrid() {
    if (!tbody) return;
    tbody.querySelectorAll('input').forEach(function(input) { if (input.type === 'checkbox') input.checked = true; else input.value = ''; });
    var st = document.getElementById('table-status'); if (st) st.textContent = '';
  }
  async function populateTeam(data) {
    for (var r = 0; r < data.length; r++) {
      var m = data[r];
      await uaDelay(150); fillRowField(r, 'Name', m.name);
      await uaDelay(150); fillRowField(r, 'Role', m.role);
      await uaDelay(150); fillRowField(r, 'Capacity', m.capacity);
      if (!m.active) { await uaDelay(150); var rows = document.querySelectorAll('[role="row"]'); var cb = rows[r] && rows[r].querySelector('[aria-label="Active"]'); if (cb) cb.checked = false; }
    }
  }
  uaControls.appendChild(uaMakeBtn('Full Sprint Team', true, async function() {
    clearGrid();
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
    await populateTeam(TEAM);
    var st = document.getElementById('table-status'); if (st) st.textContent = '"Full Sprint Team" complete';
    uaControls.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
  }));
  uaControls.appendChild(uaMakeBtn('Clear', false, clearGrid));
  var tc = document.getElementById('table-controls');
  if (tc) tc.style.display = 'none';
}

var UA_SETUP = [uaSetupExample0, uaSetupExample1, uaSetupExample2, uaSetupExample3];

function uaLoadExample(idx) {
  if (idx === uaCurrentExample) return;
  uaCurrentExample = idx;
  if (uaContent) uaContent.innerHTML = UA_TEMPLATES[idx];
  if (uaDesc) uaDesc.innerHTML = UA_DESCRIPTIONS[idx];
  if (uaStatus) uaStatus.style.display = 'none';
  UA_SETUP[idx]();
}

if (uaPicker) {
  uaPicker.onchange = function() { uaLoadExample(parseInt(uaPicker.value, 10)); };
  uaLoadExample(0);
}
