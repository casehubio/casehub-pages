var btn = document.getElementById('open-designer');
var designer = document.getElementById('demo-designer');
btn.addEventListener('click', function() {
  designer.open = true;
});
designer.addEventListener('pages-theme-created', function(e) {
  console.log('Theme created:', e.detail.name);
});
designer.addEventListener('pages-designer-closed', function() {
  console.log('Designer closed');
});
