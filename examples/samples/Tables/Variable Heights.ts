import type { PagesDataTable } from '@casehubio/pages-table';

// Apply variable row heights on each tab.
// Auto Height + Auto + Spanning: rowHeight = 'auto' with white-space override.
// Callback Heights: rowHeight = function returning 64px every 3rd row.
// Written to survive stripTs() — no lowercase type annotations.

function applyAutoHeight(table) {
  table.rowHeight = 'auto';
  var shadow = table.shadowRoot;
  if (shadow && !shadow.querySelector('.vh-wrap')) {
    var s = document.createElement('style');
    s.className = 'vh-wrap';
    s.textContent = '.cell { white-space: normal !important; overflow: visible !important; overflow-wrap: break-word !important; }';
    shadow.appendChild(s);
  }
}

function applyCallbackHeight(table) {
  table.rowHeight = function(_row, index) {
    return index % 3 === 0 ? 64 : 40;
  };
}

function configureTable() {
  var tables = document.querySelectorAll('pages-data-table');
  if (tables.length === 0) return;

  tables.forEach(function(t) {
    if (t.__vhDone) return;
    t.__vhDone = true;

    var tabButtons = document.querySelectorAll('[role="tab"]');
    var activeTab = '';
    tabButtons.forEach(function(btn) {
      if (btn.getAttribute('aria-selected') === 'true') {
        activeTab = (btn.textContent || '').trim();
      }
    });

    if (activeTab.indexOf('Callback') >= 0) {
      applyCallbackHeight(t);
    } else if (activeTab.indexOf('Column Resize') >= 0) {
      // pure YAML — resizable: true handled by pipeline, no JS needed
    } else {
      applyAutoHeight(t);
    }
  });
}

var vhObserver = new MutationObserver(function() {
  var tables = document.querySelectorAll('pages-data-table');
  tables.forEach(function(t) {
    if (!t.__vhDone) {
      setTimeout(configureTable, 200);
    }
  });
});

var vhTarget = document.getElementById('sample-target');
if (vhTarget) {
  vhObserver.observe(vhTarget, { childList: true, subtree: true });
}

setTimeout(configureTable, 300);
