var editCanvas = document.getElementById('edit-canvas');
var mutationLog = document.getElementById('mutation-log');
var clearBtn = document.getElementById('clear-log');

if (editCanvas) {
  (editCanvas as any).model = (window as any).casehubPages.createBasicPipelineModel();
  (editCanvas as any).editPolicy = (window as any).casehubPages.defaultEditPolicy();

  (editCanvas as any).onMutation = function(edit: any) {
    if (mutationLog) {
      var entry = new Date().toLocaleTimeString() + '  ' + JSON.stringify(edit) + '\n';
      mutationLog.textContent = entry + (mutationLog.textContent || '');
    }
  };
}

if (clearBtn && mutationLog) {
  clearBtn.addEventListener('click', function() {
    mutationLog.textContent = '';
  });
}
