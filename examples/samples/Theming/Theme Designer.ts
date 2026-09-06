const btn = document.getElementById('open-designer');
const designer = document.getElementById('demo-designer') as any;
btn?.addEventListener('click', () => { designer.open = true; });
designer?.addEventListener('pages-theme-created', (e: CustomEvent) => {
  console.log('Theme created:', e.detail.name);
});
designer?.addEventListener('pages-designer-closed', () => {
  console.log('Designer closed');
});
