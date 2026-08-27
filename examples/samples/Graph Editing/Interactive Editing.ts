var editCanvas = document.getElementById('edit-canvas');
var editPalette = document.getElementById('edit-palette');
var mutationLog = document.getElementById('mutation-log');
var clearBtn = document.getElementById('clear-log');
var selectedNodeIds = [];
var lastClickX = 0;
var lastClickY = 0;
var labels = { source: 'New Source', transform: 'New Transform', filter: 'New Filter', join: 'New Join', sink: 'New Sink' };
var typeColors = { source: 'var(--pages-success-9,#16a34a)', transform: 'var(--pages-accent-9,#5470c6)', filter: 'var(--pages-warning-9,#ca8a04)', join: 'var(--pages-info-9,#0891b2)', sink: 'var(--pages-danger-9,#dc2626)' };
var stencilItems = (window as any).casehubPages.getAllStencils
  ? (window as any).casehubPages.getAllStencils().map(function(s) {
      return { type: s.type, label: s.label, icon: s.icon, group: undefined };
    })
  : [
      { type: 'source', label: 'Source', icon: '⬇', group: 'Input' },
      { type: 'transform', label: 'Transform', icon: '⚙', group: 'Processing' },
      { type: 'filter', label: 'Filter', icon: '⧖', group: 'Processing' },
      { type: 'join', label: 'Join', icon: '⨝', group: 'Processing' },
      { type: 'sink', label: 'Sink', icon: '⬆', group: 'Output' },
    ];

function logMutation(label, detail) {
  if (mutationLog) {
    var entry = new Date().toLocaleTimeString() + '  ' + label + ': ' + JSON.stringify(detail) + '\n';
    mutationLog.textContent = entry + (mutationLog.textContent || '');
  }
}

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

  chooser.addEventListener('pages-palette-select', function(e) {
    onSelect(e.detail.item.type);
  });
  chooser.addEventListener('pages-chooser-dismiss', function() {
    chooser.remove();
  });
}

if (editPalette) {
  (editPalette as any).items = stencilItems;
  (editPalette as any).iconRenderer = function(icon) {
    var item = stencilItems.find(function(s) { return s.icon === icon; });
    var bg = item ? typeColors[item.type] || 'var(--pages-neutral-8)' : 'var(--pages-neutral-8)';
    var span = document.createElement('span');
    span.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:' + bg + ';color:#fff;font-size:14px;line-height:1';
    span.textContent = icon;
    return span;
  };
}

if (editCanvas) {
  (editCanvas as any).model = (window as any).casehubPages.createBasicPipelineModel();
  (editCanvas as any).editPolicy = (window as any).casehubPages.defaultEditPolicy();
  var cs = getComputedStyle(editCanvas);
  var miniMapColors = {
    source: cs.getPropertyValue('--pages-success-9').trim() || '#16a34a',
    transform: cs.getPropertyValue('--pages-accent-9').trim() || '#5470c6',
    filter: cs.getPropertyValue('--pages-warning-9').trim() || '#ca8a04',
    join: cs.getPropertyValue('--pages-info-9').trim() || '#0891b2',
    sink: cs.getPropertyValue('--pages-danger-9').trim() || '#dc2626',
  };
  (editCanvas as any).miniMapNodeColor = function(node) { return miniMapColors[node.type] || '#2563eb'; };

  editCanvas.addEventListener('click', function(evt) {
    lastClickX = (evt as MouseEvent).clientX;
    lastClickY = (evt as MouseEvent).clientY;
  }, true);

  (editCanvas as any).onMutation = function(edit) {
    var result = (window as any).casehubPages.applyGraphEdit((editCanvas as any).model, edit);
    (editCanvas as any).model = result.model;
    logMutation(edit.type, edit);
  };

  if (editPalette) {
    editPalette.addEventListener('pages-palette-select', function(e) {
      var nodeType = (e as CustomEvent).detail.item.type;
      (editCanvas as any).onMutation({ type: 'addNode', nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } });
    });
  }

  editCanvas.addEventListener('pages-event', function(e) {
    var detail = (e as CustomEvent).detail;
    if (detail.topic === 'graph:selection:change') {
      selectedNodeIds = detail.payload.nodeIds || [];
    }
    if (detail.topic === 'graph:edge:click') {
      var edgeId = detail.payload.edgeId;
      var model = (editCanvas as any).model;
      var policy = (editCanvas as any).editPolicy;
      var edge = model.edges.find(function(ed) { return ed.id === edgeId; });
      if (!edge || !policy) return;
      var types = policy.getInsertableTypes(edge, model);
      if (types.length === 0) return;
      if (types.length === 1) {
        (editCanvas as any).onMutation({ type: 'splitEdge', edgeId: edgeId, insertNodeType: types[0].type });
        return;
      }
      showNodeChooser(lastClickX, lastClickY, types, function(nodeType) {
        (editCanvas as any).onMutation({ type: 'splitEdge', edgeId: edgeId, insertNodeType: nodeType });
      });
    }
    if (detail.topic === 'graph:pane:click') {
      var panePolicy = (editCanvas as any).editPolicy;
      var paneModel = (editCanvas as any).model;
      if (!panePolicy) return;
      var creatableTypes = panePolicy.getCreatableTypes(null, paneModel);
      if (creatableTypes.length === 0) return;
      showNodeChooser(detail.payload.x, detail.payload.y, creatableTypes, function(nodeType) {
        (editCanvas as any).onMutation({ type: 'addNode', nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } });
      });
    }
    if (detail.topic === 'graph:connect:end-on-empty') {
      var sourceId = detail.payload.sourceNodeId;
      var connectPolicy = (editCanvas as any).editPolicy;
      var connectModel = (editCanvas as any).model;
      if (!connectPolicy || !sourceId) return;
      var sourceNode = connectModel.nodes.find(function(n) { return n.id === sourceId; });
      var connectTypes = connectPolicy.getCreatableTypes(sourceNode || null, connectModel);
      if (connectTypes.length === 0) return;
      showNodeChooser(detail.payload.x, detail.payload.y, connectTypes, function(nodeType) {
        var newId = 'node-' + Date.now();
        (editCanvas as any).onMutation({
          type: 'compound',
          edits: [
            { type: 'addNode', id: newId, nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } },
            { type: 'addEdge', sourceId: sourceId, targetId: newId },
          ],
        });
      });
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { dismissChooser(); return; }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!selectedNodeIds.length) return;
    var target = e.target;
    if (target && ((target as HTMLElement).tagName === 'INPUT' || (target as HTMLElement).tagName === 'TEXTAREA')) return;

    e.preventDefault();
    var policy = (editCanvas as any).editPolicy;
    var model = (editCanvas as any).model;
    if (!policy || !model) return;

    for (var i = 0; i < selectedNodeIds.length; i++) {
      var nodeId = selectedNodeIds[i];
      var node = model.nodes.find(function(n) { return n.id === nodeId; });
      if (!node) continue;
      var strategy = policy.getDeleteStrategy(node, model);
      var result = (window as any).casehubPages.applyGraphEdit(model, { type: 'removeNode', nodeId: nodeId, strategy: strategy });
      model = result.model;
      logMutation('removeNode', { nodeId: nodeId, strategy: strategy.type });
    }
    (editCanvas as any).model = model;
    selectedNodeIds = [];
  });
}

if (clearBtn && mutationLog) {
  clearBtn.addEventListener('click', function() {
    mutationLog.textContent = '';
  });
}
