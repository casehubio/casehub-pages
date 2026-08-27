var propsCanvas = document.getElementById('props-canvas');
var propsEmpty = document.getElementById('props-empty');
var propsHeader = document.getElementById('props-header');
var propsType = document.getElementById('props-type');
var propsName = document.getElementById('props-name');
var propsPalette = document.getElementById('props-palette');

var currentModel = (window as any).casehubPages.createBasicPipelineModel();
var schemas = (window as any).casehubPages.PIPELINE_SCHEMAS;

if (propsCanvas) {
  (propsCanvas as any).model = currentModel;
  (propsCanvas as any).editPolicy = (window as any).casehubPages.defaultEditPolicy();

  propsCanvas.addEventListener('pages-event', function(e: any) {
    var detail = (e as CustomEvent).detail;
    if (detail.topic !== 'graph:node:click') return;

    var nodeId = detail.payload.nodeId;
    var node = currentModel.nodes.find(function(n: any) { return n.id === nodeId; });
    if (!node || !schemas[node.type]) return;

    if (propsEmpty) propsEmpty.style.display = 'none';
    if (propsHeader) propsHeader.style.display = 'block';
    if (propsType) propsType.textContent = node.type;
    if (propsName) propsName.textContent = String(node.properties.name || node.type);
    if (propsPalette) {
      (propsPalette as any).style.display = 'block';
      (propsPalette as any).source = {
        schema: schemas[node.type],
        data: Object.assign({}, node.properties),
        onChange: function(field: any, value: any) {
          node.properties[field[0]] = value;
          if (field[0] === 'name' && propsName) {
            propsName.textContent = String(value);
          }
        },
      };
    }
  });
}
