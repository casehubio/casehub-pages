import type { Component, PermissionContext } from "../model/types.js";
import { ALLOW_ALL } from "../model/types.js";
import { generateId } from "./id.js";
import { checkAccess } from "./access.js";
import { applyGridPlacement } from "./grid.js";
import { getSlotNames, getSlotChildren } from "./slots.js";
import { isLayoutType, applyLayoutCSS } from "./layout.js";
import { isGrid } from "../model/type-guards.js";
import { wireInteractivity } from "./interactive.js";

// Subset of INTERACTIVE_TYPES (navigation.ts, runtime package). All lazy types
// are interactive; accordion is interactive but not lazy (all sections start expanded).
const LAZY_TYPES = new Set(["tabs", "pills", "sidebar", "carousel", "stack", "tree", "menu", "tiles", "deferred"]);

export interface RenderOptions {
  readonly permissions?: PermissionContext;
  readonly document?: Document;
  readonly onNode?: (el: HTMLElement, component: Component) => void;
}

export function renderComponent(
  target: HTMLElement,
  component: Component,
  options?: RenderOptions,
): void {
  const doc = options?.document ?? globalThis.document;
  const permissions = options?.permissions ?? ALLOW_ALL;
  const onNode = options?.onNode;
  target.innerHTML = "";
  renderNode(target, component, undefined, undefined, undefined, permissions, doc, onNode);
}

function renderNode(
  parent: HTMLElement,
  component: Component,
  parentId: string | undefined,
  slotOrX: string | number | undefined,
  indexOrY: number | undefined,
  permissions: PermissionContext,
  doc: Document,
  onNode: ((el: HTMLElement, component: Component) => void) | undefined,
): void {
  // 1. Access control — skip if denied
  if (!checkAccess(component.access, permissions)) return;

  // 2. Create container with data attributes
  const el = doc.createElement("div");
  const id = component.id ?? generateId(parentId, slotOrX, indexOrY);
  el.dataset.componentType = component.type;
  el.dataset.componentId = id;
  if (component.props) {
    el.dataset.componentProps = JSON.stringify(component.props);
  }

  // 3. Apply layout CSS
  if (isLayoutType(component.type)) {
    applyLayoutCSS(el, component);
  }

  // 3b. Page-level padding and height propagation
  if (component.type === "page") {
    el.style.padding = "var(--pages-space-4, 16px)";
    el.style.height = "100%";
    el.style.boxSizing = "border-box";
    if (component.grid && component.grid.length > 0) {
      el.style.display = "grid";
      const columns = isGrid(component) ? (component.props?.columns ?? 12) : 12;
      el.style.gridTemplateColumns = `repeat(${String(columns)}, 1fr)`;
    } else {
      el.style.display = "flex";
      el.style.flexDirection = "column";
    }
  }

  // 4. Apply Component.style — runs AFTER layout CSS so author overrides win
  if (component.style) {
    for (const [prop, value] of Object.entries(component.style)) {
      el.style.setProperty(prop, value);
    }
  }

  // 5. Panel title + grid wrapper
  let gridTarget = el;
  if (component.type === "panel" && component.props) {
    const { title } = component.props;
    if (typeof title === "string" && title) {
      const titleEl = doc.createElement("div");
      titleEl.dataset.panelTitle = "";
      titleEl.textContent = title;
      titleEl.style.fontWeight = "600";
      titleEl.style.fontSize = "1.1em";
      titleEl.style.padding = "8px 0";
      if (component.grid && component.grid.length > 0) {
        el.style.display = "flex";
        el.style.flexDirection = "column";
        el.appendChild(titleEl);
        const wrapper = doc.createElement("div");
        wrapper.style.flex = "1";
        wrapper.dataset.gridWrapper = "";
        el.appendChild(wrapper);
        gridTarget = wrapper;
      } else {
        titleEl.style.gridColumn = "1 / -1";
        el.appendChild(titleEl);
      }
    }
  }

  parent.appendChild(el);

  // onNode fires after appendChild, before children

  onNode?.(el, component);

  // 6. Render children — items take precedence over slots
  if (component.grid && component.grid.length > 0) {
    gridTarget.style.display = "grid";
    const columns = isGrid(component) ? (component.props?.columns ?? 12) : 12;
    gridTarget.style.gridTemplateColumns = `repeat(${String(columns)}, 1fr)`;
    const rowHeight = isGrid(component) ? component.props?.rowHeight : undefined;
    if (rowHeight === undefined) {
      gridTarget.style.gridAutoRows = "min-content";
    }
    gridTarget.style.alignContent = "start";
    gridTarget.style.gap = "var(--pages-space-3, 12px)";

    const hasAutoItems = component.grid.some(item => item.at.mode === "auto");
    if (hasAutoItems) {
      gridTarget.style.gridAutoFlow = "row";
    }

    const positioned = component.grid
      .map((item, i) => ({ item, originalIndex: i }))
      .filter(e => e.item.at.mode === "positioned");
    const auto = component.grid
      .map((item, i) => ({ item, originalIndex: i }))
      .filter(e => e.item.at.mode === "auto");

    positioned.sort((a, b) => {
      const ap = a.item.at as { mode: "positioned"; x: number; y: number; w: number; h: number };
      const bp = b.item.at as { mode: "positioned"; x: number; y: number; w: number; h: number };
      return ap.y !== bp.y ? ap.y - bp.y : ap.x - bp.x;
    });

    const ordered = [...positioned, ...auto];
    for (const { item, originalIndex } of ordered) {
      if (!item.component) {
        const empty = document.createElement("div");
        empty.className = "pages-empty-container";
        gridTarget.appendChild(empty);
      } else if (item.at.mode === "positioned") {
        renderNode(gridTarget, item.component, id, item.at.x, item.at.y, permissions, doc, onNode);
      } else {
        renderNode(gridTarget, item.component, id, "auto", originalIndex, permissions, doc, onNode);
      }
      const child = gridTarget.lastElementChild;
      if (child instanceof HTMLElement) {
        child.dataset.itemId = String(originalIndex);
        child.style.position = "relative";
        applyGridPlacement(child, item.at);
        if (rowHeight !== undefined) {
          child.style.overflow = "hidden";
        }
      }
    }
  } else if (component.slots) {
    const slotNames = getSlotNames(component);
    const panels = new Map<string, HTMLElement>();
    const isLazy = LAZY_TYPES.has(component.type);

    const isFlexColumn = el.style.flexDirection === "column";
    for (const slotName of slotNames) {
      const slotContainer = doc.createElement("div");
      slotContainer.dataset.slot = slotName;
      if (isFlexColumn) {
        slotContainer.style.flex = "1";
        slotContainer.style.minHeight = "0";
        slotContainer.style.display = "flex";
        slotContainer.style.flexDirection = "column";
      }
      el.appendChild(slotContainer);
      panels.set(slotName, slotContainer);

      if (!isLazy) {
        const children = getSlotChildren(component, slotName);
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child === undefined) continue;
          renderNode(slotContainer, child, id, slotName, i, permissions, doc, onNode);
        }
      }
    }

    wireInteractivity(el, component.type, slotNames, panels, doc,
      isLazy
        ? {
            slotChildren: component.slots,
            renderSlot: (parent: HTMLElement, children: readonly Component[], slot: string) => {
              for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child === undefined) continue;
                renderNode(parent, child, id, slot, i, permissions, doc, onNode);
              }
            },
          }
        : undefined,
    );
  }
}
