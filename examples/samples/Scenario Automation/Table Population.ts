const ROW_COUNT = 5;
const INPUT_STYLE = 'width: 100%; padding: 6px 10px; border: 1px solid var(--pages-border-subtle, #444); border-radius: 4px; background: var(--pages-surface-tertiary, #1a1a2e); color: var(--pages-text-primary, #eee); font-size: 13px; box-sizing: border-box;';

const tbody = document.getElementById('team-table-body');
if (tbody) {
  for (let i = 0; i < ROW_COUNT; i++) {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    tr.style.cssText = 'border-bottom: 1px solid var(--pages-border-subtle, #333);';
    tr.innerHTML = `
      <td style="padding: 8px 16px; color: var(--pages-text-muted, #888); font-size: 13px;">${i + 1}</td>
      <td style="padding: 6px 8px;"><input aria-label="Name" role="textbox" style="${INPUT_STYLE}" /></td>
      <td style="padding: 6px 8px;"><input aria-label="Role" role="textbox" style="${INPUT_STYLE}" /></td>
      <td style="padding: 6px 8px;"><input aria-label="Capacity" type="number" role="textbox" style="${INPUT_STYLE}" /></td>
      <td style="padding: 6px 8px; text-align: center;"><input aria-label="Active" type="checkbox" role="checkbox" style="width: 18px; height: 18px; cursor: pointer;" checked /></td>
    `;
    tbody.appendChild(tr);
  }
}

const TEAM_DATA = [
  { name: 'Alice Chen', role: 'Tech Lead', capacity: '8', active: true },
  { name: 'Bob Kim', role: 'Senior Dev', capacity: '6', active: true },
  { name: 'Carlos Ruiz', role: 'Developer', capacity: '8', active: true },
  { name: 'Diana Park', role: 'QA Engineer', capacity: '5', active: false },
  { name: 'Eve Johnson', role: 'Designer', capacity: '4', active: true },
];

function fillRowField(rowIndex, label, value) {
  var rows = document.querySelectorAll('[role="row"]');
  var row = rows[rowIndex];
  if (!row) return;
  var input = row.querySelector('[aria-label="' + label + '"]');
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function uncheckRow(rowIndex) {
  var rows = document.querySelectorAll('[role="row"]');
  var row = rows[rowIndex];
  if (!row) return;
  var cb = row.querySelector('[aria-label="Active"]');
  if (cb) cb.checked = false;
}

const SMALL_TEAM = [
  { name: 'Frank Lee', role: 'Intern', capacity: '3', active: true },
  { name: 'Grace Wu', role: 'Contractor', capacity: '6', active: true },
];

function clearTable() {
  if (!tbody) return;
  var inputs = tbody.querySelectorAll('input');
  inputs.forEach(function(input) {
    if (input.type === 'checkbox') input.checked = true;
    else input.value = '';
  });
  updateStatus('');
}

function updateStatus(text) {
  const status = document.getElementById('table-status');
  if (status) status.textContent = text;
}

async function populateTeam(data, delayMs) {
  for (var i = 0; i < data.length; i++) {
    var m = data[i];
    await new Promise(r => setTimeout(r, delayMs));
    fillRowField(i, 'Name', m.name);
    await new Promise(r => setTimeout(r, delayMs));
    fillRowField(i, 'Role', m.role);
    await new Promise(r => setTimeout(r, delayMs));
    fillRowField(i, 'Capacity', m.capacity);
    if (!m.active) {
      await new Promise(r => setTimeout(r, delayMs));
      uncheckRow(i);
    }
  }
}

const controls = document.getElementById('table-controls');
if (controls) {
  const fullBtn = document.createElement('button');
  fullBtn.style.cssText = 'padding: 6px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
  fullBtn.textContent = 'Full Sprint Team';
  fullBtn.title = '5 members with roles and capacity';
  fullBtn.onclick = async function() {
    clearTable();
    controls.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
    updateStatus('Running "Full Sprint Team"...');
    await populateTeam(TEAM_DATA, 150);
    updateStatus('"Full Sprint Team" complete');
    controls.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
  };
  controls.appendChild(fullBtn);

  var smallBtn = document.createElement('button');
  smallBtn.style.cssText = 'padding: 6px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
  smallBtn.textContent = 'Small Team';
  smallBtn.title = '2 members — quick fill';
  smallBtn.onclick = async function() {
    clearTable();
    controls.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
    updateStatus('Running "Small Team"...');
    await populateTeam(SMALL_TEAM, 150);
    updateStatus('"Small Team" complete');
    controls.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
  };
  controls.appendChild(smallBtn);

  var clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'padding: 6px 16px; background: var(--pages-surface-tertiary, #333); color: var(--pages-text-primary, #eee); border: 1px solid var(--pages-border-subtle, #444); border-radius: 6px; cursor: pointer; font-size: 13px;';
  clearBtn.textContent = 'Clear';
  clearBtn.onclick = clearTable;
  controls.appendChild(clearBtn);
}
