var editCanvas = document.getElementById('edit-canvas');
var mutationLog = document.getElementById('mutation-log');
var clearBtn = document.getElementById('clear-log');
var selectedNodeIds = [];
var activePicker = null;
var icons = { source: '⬇', transform: '⚙', filter: '⧖', join: '⨝', sink: '⬆' };

function logMutation(label, detail) {
  if (mutationLog) {
    var entry = new Date().toLocaleTimeString() + '  ' + label + ': ' + JSON.stringify(detail) + '\n';
    mutationLog.textContent = entry + (mutationLog.textContent || '');
  }
}

function dismissPicker() {
  if (activePicker) {
    activePicker.remove();
    activePicker = null;
  }
}

function showTypePicker(x, y, types, onSelect) {
  dismissPicker();
  var picker = document.createElement('div');
  picker.style.cssText = 'position:fixed;z-index:9999;background:var(--pages-neutral-2,#1e1e1e);border:1px solid var(--pages-neutral-5,#555);border-radius:8px;padding:4px;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-family:var(--pages-font-family,system-ui);font-size:12px';
  picker.style.left = x + 'px';
  picker.style.top = y + 'px';

  for (var i = 0; i < types.length; i++) {
    var btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;padding:6px 12px;border:none;background:transparent;color:var(--pages-neutral-12,#ddd);cursor:pointer;border-radius:4px;text-align:left;font-size:12px';
    btn.textContent = (icons[types[i].type] || '') + ' ' + types[i].label;
    btn.setAttribute('data-type', types[i].type);
    btn.addEventListener('mouseover', function() { this.style.background = 'var(--pages-neutral-4,#333)'; });
    btn.addEventListener('mouseout', function() { this.style.background = 'transparent'; });
    btn.addEventListener('click', function(evt) {
      var t = (evt.currentTarget as HTMLElement).getAttribute('data-type');
      dismissPicker();
      onSelect(t);
    });
    picker.appendChild(btn);
  }

  document.body.appendChild(picker);
  activePicker = picker;
  setTimeout(function() {
    document.addEventListener('click', dismissPicker, { once: true });
  }, 0);
}

if (editCanvas) {
  (editCanvas as any).model = (window as any).casehubPages.createBasicPipelineModel();
  (editCanvas as any).editPolicy = (window as any).casehubPages.defaultEditPolicy();

  (editCanvas as any).onMutation = function(edit) {
    var result = (window as any).casehubPages.applyGraphEdit((editCanvas as any).model, edit);
    (editCanvas as any).model = result.model;
    logMutation(edit.type, edit);
  };

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
      var rect = editCanvas.getBoundingClientRect();
      showTypePicker(rect.left + rect.width / 2 - 60, rect.top + rect.height / 2 - 40, types, function(nodeType) {
        (editCanvas as any).onMutation({ type: 'splitEdge', edgeId: edgeId, insertNodeType: nodeType });
      });
    }
    if (detail.topic === 'graph:pane:click') {
      var panePolicy = (editCanvas as any).editPolicy;
      var paneModel = (editCanvas as any).model;
      if (!panePolicy) return;
      var creatableTypes = panePolicy.getCreatableTypes(null, paneModel);
      if (creatableTypes.length === 0) return;
      showTypePicker(detail.payload.x, detail.payload.y, creatableTypes, function(nodeType) {
        var labels = { source: 'New Source', transform: 'New Transform', filter: 'New Filter', join: 'New Join', sink: 'New Sink' };
        (editCanvas as any).onMutation({ type: 'addNode', nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } });
      });
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { dismissPicker(); return; }
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

var toolbar = document.getElementById('node-toolbar');
if (toolbar && editCanvas) {
  var buttons = toolbar.querySelectorAll('.add-node-btn');
  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener('click', function(evt) {
      var nodeType = (evt.currentTarget as HTMLElement).getAttribute('data-type');
      if (!nodeType) return;
      var labels = { source: 'New Source', transform: 'New Transform', filter: 'New Filter', join: 'New Join', sink: 'New Sink' };
      (editCanvas as any).onMutation({ type: 'addNode', nodeType: nodeType, properties: { name: labels[nodeType] || nodeType } });
    });
  }
}

if (clearBtn && mutationLog) {
  clearBtn.addEventListener('click', function() {
    mutationLog.textContent = '';
  });
}
