import "@casehubio/pages-primitives";
import "@casehubio/pages-primitives/dock";
import "@casehubio/pages-builder";
import "@casehubio/pages-code-editor";
import "@casehubio/pages-property-palette";
import { loadSite } from "@casehubio/pages-runtime";
import { applyTheme, getTheme } from "@casehubio/pages-ui-tokens";

applyTheme('casehub-dark');

const yaml = document.getElementById('grid-yaml')?.textContent?.trim() ?? '';
const shell = document.querySelector('pages-builder-shell') as any;
if (shell && yaml) {
  shell.renderPreview = (container: HTMLElement, yamlText: string) => {
    container.innerHTML = '';
    return loadSite(container, yamlText, {}).then(site => {
      const theme = getTheme() || 'casehub-dark';
      site.setTheme(theme.endsWith('-dark') ? 'dark' : 'light');
      applyTheme(theme, container);
    }).catch(() => {});
  };
  shell.yaml = yaml;
  shell.updateComplete.then(() => {
    if (shell._document?.getPages?.()?.length === 0) {
      shell._document = shell._parseDocument(yaml);
      shell._syncViews('editor');
      shell.requestUpdate();
    }
  });
}
