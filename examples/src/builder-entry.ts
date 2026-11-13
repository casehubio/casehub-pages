import "@casehubio/pages-primitives";
import "@casehubio/pages-primitives/dock";
import "@casehubio/pages-builder";
import "@casehubio/pages-code-editor";
import "@casehubio/pages-property-palette";
import { loadSite } from "@casehubio/pages-runtime";
import { attachGridEditController } from "@casehubio/pages-component";
import type { GridItem } from "@casehubio/pages-component";
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
      const gridEl = container.querySelector('[data-component-type="page"][style*="display: grid"]') as HTMLElement;
      if (gridEl) {
        const childEls = Array.from(gridEl.children).filter(
          (c): c is HTMLElement => c instanceof HTMLElement && !!c.dataset.componentId
        );
        const gridItems: GridItem[] = childEls.map(el => {
          const col = el.style.gridColumn;
          const row = el.style.gridRow;
          const parseSpan = (v: string) => {
            const m = v.match(/(\d+)\s*\/\s*span\s+(\d+)/);
            return m ? { start: Number(m[1]) - 1, span: Number(m[2]) } : null;
          };
          const c = parseSpan(col);
          const r = parseSpan(row);
          return {
            at: c && r
              ? { mode: 'positioned' as const, x: c.start, y: r.start, w: c.span, h: r.span }
              : { mode: 'auto' as const, w: 1, h: 1 },
            component: { type: el.dataset.componentType ?? '', id: el.dataset.componentId! },
          };
        });
        if (gridItems.some(gi => gi.at.mode === 'positioned')) {
          attachGridEditController(gridEl, gridItems, 12);
        }
      }
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
