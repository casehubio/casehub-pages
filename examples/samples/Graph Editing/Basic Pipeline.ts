var canvas = document.getElementById('pipeline-canvas');
if (canvas) {
  (canvas as any).model = (window as any).casehubPages.createBasicPipelineModel();
}
