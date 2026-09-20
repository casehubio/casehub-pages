// @ts-nocheck
var casehub = (window as any).casehubPages;
var canvas = document.getElementById('nested-pipeline-canvas') as any;
var palette = document.getElementById('drill-palette') as any;
var labels = { source: 'New Source', transform: 'New Transform', filter: 'New Filter', join: 'New Join', sink: 'New Sink' };
var typeColors = { source: 'var(--pages-success-9,#16a34a)', transform: 'var(--pages-accent-9,#5470c6)', filter: 'var(--pages-warning-9,#ca8a04)', join: 'var(--pages-info-9,#0891b2)', sink: 'var(--pages-danger-9,#dc2626)' };
var lastClickX = 0;
var lastClickY = 0;
var selectedNodeIds = [];

// --- Level 2: Validation detail (fan-in topology, all yellow/cyan) ---
var level2Validate = {
  nodes: [
    { id: 'schema', type: 'filter', properties: { name: 'Schema Check' } },
    { id: 'range', type: 'filter', properties: { name: 'Range Check' } },
    { id: 'nulls', type: 'filter', properties: { name: 'Null Check' } },
    { id: 'merge', type: 'join', properties: { name: 'Merge Results' } },
    { id: 'report', type: 'sink', properties: { name: 'Validation Report' } },
  ],
  edges: [
    { id: 'v-e1', type: 'default', source: 'schema', target: 'merge' },
    { id: 'v-e2', type: 'default', source: 'range', target: 'merge' },
    { id: 'v-e3', type: 'default', source: 'nulls', target: 'merge' },
    { id: 'v-e4', type: 'default', source: 'merge', target: 'report' },
  ],
};

// --- Level 1: Ingest detail (linear, all 5 types) ---
var level1Ingest = {
  nodes: [
    { id: 'api', type: 'source', properties: { name: 'Fetch API' } },
    { id: 'parse', type: 'transform', properties: { name: 'Parse JSON' } },
    { id: 'validate', type: 'filter', properties: { name: 'Validate' } },
    { id: 'enrich', type: 'join', properties: { name: 'Enrich' } },
    { id: 'queue', type: 'sink', properties: { name: 'Message Queue' } },
  ],
  edges: [
    { id: 'i-e1', type: 'default', source: 'api', target: 'parse' },
    { id: 'i-e2', type: 'default', source: 'parse', target: 'validate' },
    { id: 'i-e3', type: 'default', source: 'validate', target: 'enrich' },
    { id: 'i-e4', type: 'default', source: 'enrich', target: 'queue' },
  ],
};

// --- Level 1: Transform detail (fan-out/fan-in, blue/yellow) ---
var level1Transform = {
  nodes: [
    { id: 'split', type: 'source', properties: { name: 'Splitter' } },
    { id: 'clean', type: 'transform', properties: { name: 'Cleanse' } },
    { id: 'norm', type: 'transform', properties: { name: 'Normalize' } },
    { id: 'dedupe', type: 'filter', properties: { name: 'Deduplicate' } },
    { id: 'combine', type: 'join', properties: { name: 'Combine' } },
  ],
  edges: [
    { id: 't-e1', type: 'default', source: 'split', target: 'clean' },
    { id: 't-e2', type: 'default', source: 'split', target: 'norm' },
    { id: 't-e3', type: 'default', source: 'clean', target: 'combine' },
    { id: 't-e4', type: 'default', source: 'norm', target: 'dedupe' },
    { id: 't-e5', type: 'default', source: 'dedupe', target: 'combine' },
  ],
};

// --- Level 0: Top-level pipeline (3 stages, green → cyan → red) ---
var level0 = {
  nodes: [
    { id: 'ingest', type: 'source', properties: { name: 'Ingest' } },
    { id: 'transform', type: 'join', properties: { name: 'Transform' } },
    { id: 'export', type: 'sink', properties: { name: 'Export' } },
  ],
  edges: [
    { id: 'p-e1', type: 'default', source: 'ingest', target: 'transform' },
    { id: 'p-e2', type: 'default', source: 'transform', target: 'export' },
  ],
};

// Drill-down registry keyed by model identity — stateless across navigation
var drillByModel = new Map();
drillByModel.set(level0, {
  ingest:    { name: 'Ingest',    model: level1Ingest },
  transform: { name: 'Transform', model: level1Transform },
});
drillByModel.set(level1Ingest, {
  validate: { name: 'Validate', model: level2Validate },
});

// --- Palette setup ---
var stencilItems = casehub.getAllStencils
  ? casehub.getAllStencils().map(function(s) { return { type: s.type, label: s.label, icon: s.icon }; })
  : [
      { type: 'source', label: 'Source', icon: '⬇' },
      { type: 'transform', label: 'Transform', icon: '⚙' },
      { type: 'filter', label: 'Filter', icon: '⧖' },
      { type: 'join', label: 'Join', icon: '⨝' },
      { type: 'sink', label: 'Sink', icon: '⬆' },
    ];

if (palette) {
  palette.items = stencilItems;
  palette.iconRenderer = function(icon) {
    var item = stencilItems.find(function(s) { return s.icon === icon; });
    var bg = item ? typeColors[item.type] || 'var(--pages-neutral-8)' : 'var(--pages-neutral-8)';
    var span = document.createElement('span');
    span.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:' + bg + ';color:#fff;font-size:14px;line-height:1';
    span.textContent = icon;
    return span;
  };
}

// --- Node chooser helpers ---
function dismissChooser() {
  var existing = document.querySelector('pages-node-chooser');
  if (existing) existing.remove();
}

function showNodeChooser(x, y, types, onSelect) {
  dismissChooser();
  var chooser = document.createElement('pages-node-chooser') as any;
  chooser.items = types;
  chooser.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:9999';
  document.body.appendChild(chooser);
  chooser.addEventListener('pages-palette-select', function(e) { onSelect(e.detail.item.type); });
  chooser.addEventListener('pages-chooser-dismiss', function() { chooser.remove(); });
}

// --- Canvas setup ---
if (canvas) {
  canvas.model = level0;
  canvas.editPolicy = casehub.defaultEditPolicy();

  var cs = getComputedStyle(canvas);
  var miniMapColors = {
    source: cs.getPropertyValue('--pages-success-9').trim() || '#16a34a',
    transform: cs.getPropertyValue('--pages-accent-9').trim() || '#5470c6',
    filter: cs.getPropertyValue('--pages-warning-9').trim() || '#ca8a04',
    join: cs.getPropertyValue('--pages-info-9').trim() || '#0891b2',
    sink: cs.getPropertyValue('--pages-danger-9').trim() || '#dc2626',
  };
  canvas.miniMapNodeColor = function(node) { return miniMapColors[node.type] || '#2563eb'; };

  // --- Drill-down config (stateless — uses model param, no mutable closure) ---
  canvas.drillDown = {
    isDrillable: function(nodeId, model) {
      var subs = drillByModel.get(model);
      return subs ? nodeId in subs : false;
    },
    resolve: function(nodeId, model) {
      var subs = drillByModel.get(model);
      var entry = subs ? subs[nodeId] : null;
      if (!entry) return Promise.resolve(null);
      return Promise.resolve({ name: entry.name, model: entry.model });
    },
  };

  // --- Mutation handler ---
  canvas.onMutation = function(edit) {
    var oldModel = canvas.model;
    var result = casehub.applyGraphEdit(oldModel, edit);
    var oldDrill = drillByModel.get(oldModel);
    if (oldDrill) drillByModel.set(result.model, oldDrill);
    canvas.model = result.model;
  };

  // --- Palette click → add node (respects EditPolicy.getAddPlacement) ---
  if (palette) {
    palette.addEventListener('pages-palette-select', function(e) {
      var nodeType = e.detail.item.type;
      var policy = canvas.editPolicy;
      var model = canvas.model;
      var placement = policy && policy.getAddPlacement ? policy.getAddPlacement(nodeType, model) : { type: 'detached' };
      if (placement.type === 'splitEdge') {
        canvas.onMutation({ type: 'splitEdge', edgeId: placement.edgeId, insertNodeType: nodeType });
      } else {
        canvas.onMutation({ type: 'addNode', nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } });
      }
    });
  }

  canvas.addEventListener('click', function(evt) {
    lastClickX = evt.clientX;
    lastClickY = evt.clientY;
  }, true);

  // --- Graph events: edge click, pane click, connect-end-on-empty ---
  canvas.addEventListener('pages-event', function(e) {
    var detail = e.detail;
    if (detail.topic === 'graph:selection:change') {
      selectedNodeIds = detail.payload.nodeIds || [];
    }
    if (detail.topic === 'graph:edge:click') {
      var edgeId = detail.payload.edgeId;
      var model = canvas.model;
      var policy = canvas.editPolicy;
      var edge = model.edges.find(function(ed) { return ed.id === edgeId; });
      if (!edge || !policy) return;
      var types = policy.getInsertableTypes(edge, model);
      if (types.length === 0) return;
      if (types.length === 1) {
        canvas.onMutation({ type: 'splitEdge', edgeId: edgeId, insertNodeType: types[0].type });
        return;
      }
      showNodeChooser(lastClickX, lastClickY, types, function(nodeType) {
        canvas.onMutation({ type: 'splitEdge', edgeId: edgeId, insertNodeType: nodeType });
      });
    }
    if (detail.topic === 'graph:pane:click') {
      var creatableTypes = canvas.editPolicy?.getCreatableTypes(null, canvas.model) || [];
      if (creatableTypes.length === 0) return;
      showNodeChooser(detail.payload.x, detail.payload.y, creatableTypes, function(nodeType) {
        canvas.onMutation({ type: 'addNode', nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } });
      });
    }
    if (detail.topic === 'graph:connect:end-on-empty') {
      var sourceId = detail.payload.sourceNodeId;
      if (!sourceId) return;
      var sourceNode = canvas.model.nodes.find(function(n) { return n.id === sourceId; });
      var connectTypes = canvas.editPolicy?.getCreatableTypes(sourceNode || null, canvas.model) || [];
      if (connectTypes.length === 0) return;
      showNodeChooser(detail.payload.x, detail.payload.y, connectTypes, function(nodeType) {
        var newId = 'node-' + Date.now();
        canvas.onMutation({
          type: 'compound',
          edits: [
            { type: 'addNode', id: newId, nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } },
            { type: 'addEdge', sourceId: sourceId, targetId: newId },
          ],
        });
      });
    }
  });

  // --- Delete key ---
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { dismissChooser(); return; }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!selectedNodeIds.length) return;
    var target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    var policy = canvas.editPolicy;
    var model = canvas.model;
    if (!policy || !model) return;
    for (var i = 0; i < selectedNodeIds.length; i++) {
      var nodeId = selectedNodeIds[i];
      var node = model.nodes.find(function(n) { return n.id === nodeId; });
      if (!node) continue;
      var strategy = policy.getDeleteStrategy(node, model);
      var result = casehub.applyGraphEdit(model, { type: 'removeNode', nodeId: nodeId, strategy: strategy });
      model = result.model;
    }
    canvas.model = model;
    selectedNodeIds = [];
  });
}

// --- Property palette ---
var propsEmpty = document.getElementById('drill-props-empty');
var propsHeader = document.getElementById('drill-props-header');
var propsType = document.getElementById('drill-props-type');
var propsName = document.getElementById('drill-props-name');
var propsPalette = document.getElementById('drill-props-palette') as any;
var propsSchemas = casehub.PIPELINE_SCHEMAS;

if (canvas && propsPalette) {
  canvas.addEventListener('pages-event', function(e) {
    var detail = e.detail;
    if (detail.topic !== 'graph:node:click') return;
    var nodeId = detail.payload.nodeId;
    var model = canvas.model;
    var node = model.nodes.find(function(n) { return n.id === nodeId; });
    if (!node || !propsSchemas || !propsSchemas[node.type]) return;
    if (propsEmpty) propsEmpty.style.display = 'none';
    if (propsHeader) propsHeader.style.display = 'block';
    if (propsType) propsType.textContent = node.type;
    if (propsName) propsName.textContent = String(node.properties.name || node.type);
    if (propsPalette) {
      propsPalette.style.display = 'block';
      var nodeData = Object.assign({}, node.properties);
      propsPalette.source = {
        schema: propsSchemas[node.type],
        data: nodeData,
        onChange: function(field, value) {
          nodeData[field[0]] = value;
          node.properties[field[0]] = value;
          if (field[0] === 'name' && propsName) propsName.textContent = String(value);
        },
      };
    }
  });
}
