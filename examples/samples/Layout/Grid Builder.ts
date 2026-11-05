var mount = document.getElementById('grid-builder-mount');
if (mount) {
  fetch('samples/Layout/Grid Builder.yaml')
    .then(function (r) { return r.text(); })
    .then(function (yaml) {
      var check = setInterval(function () {
        if (customElements.get('pages-builder-shell')) {
          clearInterval(check);
          mount.innerHTML = '';
          var shell = document.createElement('pages-builder-shell') as any;
          shell.yaml = yaml;
          shell.renderPreview = function (container, yamlText) {
            container.innerHTML = '';
            var cp = (window as any).casehubPages;
            if (cp && cp.loadSite) {
              cp.loadSite(container, yamlText, {}).then(function (site) {
                var theme = cp.getTheme() || 'casehub-dark';
                site.setTheme(theme.endsWith('-dark') ? 'dark' : 'light');
                cp.applyTheme(theme, container);
              }).catch(function () {});
            }
          };
          shell.style.cssText = 'height: 100%; width: 100%;';
          mount.appendChild(shell);
        }
      }, 100);

      setTimeout(function () {
        clearInterval(check);
        if (!customElements.get('pages-builder-shell')) {
          mount.innerHTML =
            '<div style="padding: 24px; color: #d32f2f;">Builder component not available. Rebuild examples with: cd examples && yarn build</div>';
        }
      }, 5000);
    });
}
