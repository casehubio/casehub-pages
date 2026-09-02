// @ts-nocheck
var msCanvas = document.getElementById('ms-canvas');
var msMutationLog = document.getElementById('ms-mutation-log');
var msClearBtn = document.getElementById('ms-clear-log');

function msLog(label, detail) {
  if (msMutationLog) {
    var entry = new Date().toLocaleTimeString() + '  ' + label + ': ' + JSON.stringify(detail) + '\n';
    msMutationLog.textContent = entry + (msMutationLog.textContent || '');
  }
}

// Chain 1: Source → Parse → Enrich → Validate → Sink
//                             ↘ Normalise (branch — makes {Parse,Enrich} invalid without it)
// Chain 2: Source2 → Clean → Lookup → Format → Report
//
// Valid multi-node selections:
//   {Parse, Enrich, Normalise}  — 3 nodes, can splice onto Chain 2 edges
//   {Enrich, Normalise}         — 2 nodes, can splice
//   {Clean, Lookup}             — 2 nodes, can splice onto Chain 1 edges
//   {Clean, Lookup, Format}     — 3 nodes
//   {Lookup, Format}            — 2 nodes
// Invalid:
//   {Parse, Enrich}             — Enrich branches to Normalise, 2 outbound
function createMultiSelectDemoModel() {
  return {
    nodes: [
      { id: 'src1', type: 'source', properties: { name: 'Source' } },
      { id: 'tx1', type: 'transform', properties: { name: 'Parse' } },
      { id: 'tx2', type: 'transform', properties: { name: 'Enrich' } },
      { id: 'tx4', type: 'transform', properties: { name: 'Normalise' } },
      { id: 'fl1', type: 'filter', properties: { name: 'Validate' } },
      { id: 'sk1', type: 'sink', properties: { name: 'Sink' } },
      { id: 'src2', type: 'source', properties: { name: 'Source 2' } },
      { id: 'tx5', type: 'transform', properties: { name: 'Clean' } },
      { id: 'tx6', type: 'transform', properties: { name: 'Lookup' } },
      { id: 'tx7', type: 'transform', properties: { name: 'Format' } },
      { id: 'sk2', type: 'sink', properties: { name: 'Report' } },
    ],
    edges: [
      { id: 'e1', type: 'default', source: 'src1', target: 'tx1' },
      { id: 'e2', type: 'default', source: 'tx1', target: 'tx2' },
      { id: 'e3', type: 'default', source: 'tx2', target: 'fl1' },
      { id: 'e4', type: 'default', source: 'fl1', target: 'sk1' },
      { id: 'e5', type: 'default', source: 'tx2', target: 'tx4' },
      { id: 'e5b', type: 'default', source: 'tx4', target: 'fl1' },
      { id: 'e6', type: 'default', source: 'src2', target: 'tx5' },
      { id: 'e7', type: 'default', source: 'tx5', target: 'tx6' },
      { id: 'e8', type: 'default', source: 'tx6', target: 'tx7' },
      { id: 'e9', type: 'default', source: 'tx7', target: 'sk2' },
    ],
  };
}

if (msCanvas) {
  (msCanvas as any).model = createMultiSelectDemoModel();
  (msCanvas as any).editPolicy = (window as any).casehubPages.defaultEditPolicy();
  (msCanvas as any).connectionsEnabled = false;

  var miniColors = {
    source: '#16a34a',
    transform: '#5470c6',
    filter: '#ca8a04',
    join: '#0891b2',
    sink: '#dc2626',
  };
  (msCanvas as any).miniMapNodeColor = function(node) { return miniColors[node.type] || '#2563eb'; };

  (msCanvas as any).onMutation = function(edit) {
    var result = (window as any).casehubPages.applyGraphEdit((msCanvas as any).model, edit);
    (msCanvas as any).model = result.model;
    msLog(edit.type, edit);
  };

  msCanvas.addEventListener('pages-event', function(e) {
    var detail = (e as CustomEvent).detail;
    if (detail.topic === 'graph:multiselect:change') {
      msLog('multiselect', { mode: detail.payload.mode, nodeIds: detail.payload.nodeIds });
    }
  });
}

if (msClearBtn && msMutationLog) {
  msClearBtn.addEventListener('click', function() {
    msMutationLog.textContent = '';
  });
}
