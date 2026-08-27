var editCanvas = document.getElementById('edit-canvas');
var mutationLog = document.getElementById('mutation-log');
var clearBtn = document.getElementById('clear-log');
var selectedNodeIds = [];
var insertNodeType = 'transform';

function logMutation(label, detail) {
  if (mutationLog) {
    var entry = new Date().toLocaleTimeString() + '  ' + label + ': ' + JSON.stringify(detail) + '\n';
    mutationLog.textContent = entry + (mutationLog.textContent || '');
  }
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
      var labels = { source: 'New Source', transform: 'New Transform', filter: 'New Filter', join: 'New Join', sink: 'New Sink' };
      (editCanvas as any).onMutation({ type: 'splitEdge', edgeId: edgeId, insertNodeType: insertNodeType });
      logMutation('splitEdge (click edge to insert)', { edgeId: edgeId, insertNodeType: insertNodeType });
    }
  });

  document.addEventListener('keydown', function(e) {
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
      insertNodeType = nodeType;
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
