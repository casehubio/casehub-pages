import { attachDockDrag } from "./dock-drag.js";
import type { ZoneLayoutEngine } from "./zone-layout-engine.js";

export interface DockBarItem {
  readonly icon: string;
  readonly label: string;
  readonly panelId: string;
  readonly defaultOpen?: boolean | undefined;
  readonly zone?: string | undefined;
}

export interface DockBarProps {
  readonly orientation?: string | undefined;
  readonly exclusive?: boolean | undefined;
  readonly side?: string | undefined;
  readonly items?: readonly DockBarItem[] | undefined;
}

export interface DockBarOptions {
  readonly zoneEngine?: ZoneLayoutEngine | undefined;
  readonly siteTarget?: HTMLElement | undefined;
}

function renderDockButtons(
  container: HTMLElement,
  items: readonly DockBarItem[],
  eventTarget: HTMLElement,
  exclusive: boolean,
  zoneName: string | undefined,
): void {
  for (const item of items) {
    const button = document.createElement("button");
    button.dataset.dockPanelId = item.panelId;
    if (zoneName) button.dataset.dockZone = zoneName;
    button.title = item.label;
    button.textContent = item.icon;
    button.style.border = "none";
    button.style.background = "transparent";
    button.style.cursor = "pointer";
    button.style.padding = "6px";
    button.style.borderRadius = "var(--pages-radius-sm, 4px)";
    button.style.fontSize = "16px";

    if (item.defaultOpen) {
      button.dataset.active = "";
    }

    button.addEventListener("click", () => {
      const isActive = button.dataset.active !== undefined;

      if (exclusive) {
        if (isActive) {
          delete button.dataset.active;
          eventTarget.dispatchEvent(new CustomEvent("pages-dock-toggle", {
            bubbles: true, composed: true,
            detail: { panelId: item.panelId, visible: false },
          }));
        } else {
          const myZone = button.dataset.dockZone;
          const scope = myZone
            ? eventTarget.querySelectorAll<HTMLElement>(`button[data-dock-zone="${myZone}"]`)
            : eventTarget.querySelectorAll<HTMLElement>("button[data-dock-panel-id]");
          for (const sibling of scope) {
            if (sibling.dataset.active !== undefined) {
              delete sibling.dataset.active;
              eventTarget.dispatchEvent(new CustomEvent("pages-dock-toggle", {
                bubbles: true, composed: true,
                detail: { panelId: sibling.dataset.dockPanelId!, visible: false },
              }));
            }
          }
          button.dataset.active = "";
          eventTarget.dispatchEvent(new CustomEvent("pages-dock-toggle", {
            bubbles: true, composed: true,
            detail: { panelId: item.panelId, visible: true },
          }));
        }
      } else {
        if (isActive) {
          delete button.dataset.active;
        } else {
          button.dataset.active = "";
        }
        eventTarget.dispatchEvent(new CustomEvent("pages-dock-toggle", {
          bubbles: true, composed: true,
          detail: { panelId: item.panelId, visible: !isActive },
        }));
      }
    });

    container.appendChild(button);
  }
}

export function renderDockBar(el: HTMLElement, props: DockBarProps, options?: DockBarOptions): void {
  const { orientation, items, exclusive } = props;
  if (!items) return;

  el.style.display = "flex";
  el.style.flexDirection = orientation === "horizontal" ? "row" : "column";
  el.style.gap = "0";
  el.style.padding = "4px";

  const hasZones = items.some(i => i.zone !== undefined);

  if (hasZones) {
    const topItems = items.filter(i => i.zone === "top");
    const middleItems = items.filter(i => i.zone === "top-second");
    const bottomItems = items.filter(i => i.zone === "bottom");
    const flexDir = orientation === "horizontal" ? "row" : "column";

    function makeGroup(zoneName: string, groupItems: readonly DockBarItem[]): HTMLElement {
      const group = document.createElement("div");
      group.dataset.dockZone = zoneName;
      group.style.display = "flex";
      group.style.flexDirection = flexDir;
      group.style.gap = "2px";
      group.style.minWidth = "24px";
      group.style.minHeight = "24px";
      renderDockButtons(group, groupItems, el, exclusive ?? false, zoneName);
      return group;
    }

    el.appendChild(makeGroup("top", topItems));

    const sep = document.createElement("div");
    sep.style[orientation === "horizontal" ? "borderLeft" : "borderTop"] = "1px solid var(--pages-neutral-5, #555)";
    sep.style.margin = orientation === "horizontal" ? "0 4px" : "4px 0";
    sep.style.alignSelf = "stretch";
    el.appendChild(sep);

    el.appendChild(makeGroup("middle", middleItems));

    const spacer = document.createElement("div");
    spacer.dataset.dockSpacer = "";
    spacer.style.flex = "1";
    el.appendChild(spacer);

    el.appendChild(makeGroup("bottom", bottomItems));
  } else {
    renderDockButtons(el, items, el, exclusive ?? false, undefined);
  }

  if (options?.zoneEngine && options?.siteTarget) {
    const buttons = el.querySelectorAll<HTMLElement>("button[data-dock-panel-id]");
    for (const btn of buttons) {
      attachDockDrag(btn, options.zoneEngine, options.siteTarget);
    }
  }
}
