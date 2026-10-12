import { test, expect } from "@playwright/test";

async function openDockWorkbench(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();
  await page.evaluate(() => localStorage.clear());
  await page.locator('.sample-item:has-text("Dock Workbench")').first().click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.waitForSelector("pages-dock-workbench", { timeout: 10000 });
  await page.waitForSelector("button[data-dock-panel-id]", { timeout: 5000 });
}

function buttonPositions(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const result: Record<string, { side: string; zone: string }> = {};
    document.querySelectorAll("button[data-dock-panel-id]").forEach((b) => {
      const el = b as HTMLElement;
      const bar = el.closest("[data-component-type='dock-bar']") as HTMLElement;
      const side = bar ? JSON.parse(bar.getAttribute("data-component-props") || "{}").side : "?";
      const zone = el.closest("[data-dock-zone]") as HTMLElement;
      result[el.dataset.dockPanelId!] = { side, zone: zone ? zone.getAttribute("data-dock-zone")! : "?" };
    });
    return result;
  });
}

async function dragPanel(
  page: import("@playwright/test").Page,
  panelId: string,
  targetSide: "left" | "right",
  targetArea: "top" | "middle" | "bottom",
) {
  await page.evaluate(
    ({ panelId, targetSide, targetArea }) => {
      const btn = document.querySelector(`button[data-dock-panel-id="${panelId}"]`) as HTMLElement;
      const bar = document.querySelector(
        `[data-component-type="dock-bar"][data-component-props*="${targetSide}"]`,
      ) as HTMLElement;
      if (!btn || !bar) throw new Error(`Missing btn=${!!btn} bar=${!!bar}`);
      const c = btn.getBoundingClientRect();
      const r = bar.getBoundingClientRect();
      let targetY: number;
      if (targetArea === "top") targetY = r.top + 20;
      else if (targetArea === "bottom") targetY = r.bottom - 20;
      else {
        const emptyZone = bar.querySelector("[data-dock-empty]") as HTMLElement;
        targetY = emptyZone ? emptyZone.getBoundingClientRect().top + 30 : r.top + r.height / 2;
      }
      btn.dispatchEvent(new MouseEvent("mousedown", { clientX: c.left + 14, clientY: c.top + 16, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: r.left + 14, clientY: targetY, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: r.left + 14, clientY: targetY, bubbles: true }));
    },
    { panelId, targetSide, targetArea },
  );
  await page.waitForTimeout(2000);
}

async function dragToBottomZone(
  page: import("@playwright/test").Page,
  panelId: string,
  targetSide: "left" | "right",
) {
  await page.evaluate(
    ({ panelId, targetSide }) => {
      const btn = document.querySelector(`button[data-dock-panel-id="${panelId}"]`) as HTMLElement;
      const bar = document.querySelector(
        `[data-component-type="dock-bar"][data-component-props*="${targetSide}"]`,
      ) as HTMLElement;
      if (!btn || !bar) throw new Error(`Missing elements`);
      const c = btn.getBoundingClientRect();
      const r = bar.getBoundingClientRect();
      const bottomZone = bar.querySelector('[data-dock-zone="bottom"]') as HTMLElement;
      const targetY = bottomZone ? bottomZone.getBoundingClientRect().top + 10 : r.bottom - 20;
      btn.dispatchEvent(new MouseEvent("mousedown", { clientX: c.left + 14, clientY: c.top + 16, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: r.left + 14, clientY: targetY, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: r.left + 14, clientY: targetY, bubbles: true }));
    },
    { panelId, targetSide },
  );
  await page.waitForTimeout(2000);
}

test.describe("Dock Workbench drag-and-drop", () => {
  test.beforeEach(async ({ page }) => {
    await openDockWorkbench(page);
  });

  test("initial layout: panels in correct zones", async ({ page }) => {
    const pos = await buttonPositions(page);
    expect(pos.navigator).toEqual({ side: "left", zone: "top" });
    expect(pos.files).toEqual({ side: "left", zone: "top" });
    expect(pos.bookmarks).toEqual({ side: "left", zone: "top-second" });
    expect(pos.console).toEqual({ side: "left", zone: "bottom" });
    expect(pos.output).toEqual({ side: "left", zone: "bottom" });
    expect(pos.agent).toEqual({ side: "right", zone: "top" });
    expect(pos.inspector).toEqual({ side: "right", zone: "top" });
  });

  test("fixed panel (navigator) refuses drag", async ({ page }) => {
    const before = await buttonPositions(page);
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-dock-panel-id="navigator"]') as HTMLElement;
      const c = btn.getBoundingClientRect();
      btn.dispatchEvent(new MouseEvent("mousedown", { clientX: c.left + 14, clientY: c.top + 16, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: c.left + 100, clientY: c.top + 100, bubbles: true }));
      const ghost = document.querySelector("[data-drag-ghost]");
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: c.left + 100, clientY: c.top + 100, bubbles: true }));
      return !ghost;
    });
    const after = await buttonPositions(page);
    expect(after.navigator).toEqual(before.navigator);
  });

  test("drag Files from left-top to right-top", async ({ page }) => {
    await dragPanel(page, "files", "right", "top");
    const pos = await buttonPositions(page);
    expect(pos.files.side).toBe("right");
    expect(pos.files.zone).toBe("top");
  });

  test("drag Files to right second zone via placeholder", async ({ page }) => {
    await dragPanel(page, "files", "right", "middle");
    const pos = await buttonPositions(page);
    expect(pos.files.side).toBe("right");
    expect(pos.files.zone).toBe("top-second");
  });

  test("drag Output to right second zone", async ({ page }) => {
    await dragPanel(page, "output", "right", "middle");
    const pos = await buttonPositions(page);
    expect(pos.output.side).toBe("right");
    expect(pos.output.zone).toBe("top-second");
    const zm = await page.evaluate(() => {
      const dwb = document.querySelector("pages-dock-workbench") as any;
      return dwb.zoneMap ? Object.fromEntries(dwb.zoneMap) : {};
    });
    expect(zm.output).toBe("right-bottom");
  });

  test("drag Bookmarks from left-bottom to right-top", async ({ page }) => {
    await dragPanel(page, "bookmarks", "right", "top");
    const pos = await buttonPositions(page);
    expect(pos.bookmarks.side).toBe("right");
    expect(pos.bookmarks.zone).toBe("top");
  });

  test("bottom panels in same zone are mutually exclusive", async ({ page }) => {
    await page.evaluate(() => {
      const dwb = document.querySelector("pages-dock-workbench") as any;
      dwb.showPanel("console");
    });
    const state1 = await page.evaluate(() => {
      const dwb = document.querySelector("pages-dock-workbench") as any;
      return { c: dwb.dockState.console, o: dwb.dockState.output };
    });
    expect(state1.c).toBe(true);

    await page.evaluate(() => {
      const dwb = document.querySelector("pages-dock-workbench") as any;
      dwb.showPanel("output");
    });
    const state2 = await page.evaluate(() => {
      const dwb = document.querySelector("pages-dock-workbench") as any;
      return { c: dwb.dockState.console, o: dwb.dockState.output };
    });
    expect(state2.o).toBe(true);
    expect(state2.c).toBe(false);
  });

  test("moving panel back to same zone removes split", async ({ page }) => {
    await dragPanel(page, "console", "right", "bottom");
    await dragToBottomZone(page, "console", "left");
    const pos = await buttonPositions(page);
    expect(pos.console.side).toBe("left");
    expect(pos.console.zone).toBe("bottom");
    const sep = await page.evaluate(() => {
      const bz = document.querySelector(".dock-zone-bottom");
      return !!bz?.querySelector("[data-bottom-separator]");
    });
    expect(sep).toBe(false);
  });

  test("panel content renders immediately after drop", async ({ page }) => {
    await dragPanel(page, "console", "right", "bottom");
    const content = await page.evaluate(() => {
      const bz = document.querySelector(".dock-zone-bottom");
      return bz?.textContent?.trim() || "";
    });
    expect(content).toContain("Console");
  });

  test("second zone placeholder has separator and accepts drops", async ({ page }) => {
    const hasPlaceholder = await page.evaluate(() => {
      const rb = document.querySelector('[data-component-type="dock-bar"][data-component-props*="right"]');
      const sep = rb?.querySelector('[style*="border-top"]');
      const empty = rb?.querySelector("[data-dock-empty]");
      return { hasSep: !!sep, hasEmpty: !!empty };
    });
    expect(hasPlaceholder.hasSep).toBe(true);
    expect(hasPlaceholder.hasEmpty).toBe(true);
  });

  test("no indicator accumulation on repeated drops", async ({ page }) => {
    await dragPanel(page, "files", "right", "top");
    await dragPanel(page, "files", "left", "top");
    await dragPanel(page, "files", "right", "top");

    await page.evaluate(() => {
      const btn = document.querySelector('button[data-dock-panel-id="bookmarks"]') as HTMLElement;
      const rb = document.querySelector('[data-component-type="dock-bar"][data-component-props*="right"]') as HTMLElement;
      const c = btn.getBoundingClientRect();
      const r = rb.getBoundingClientRect();
      btn.dispatchEvent(new MouseEvent("mousedown", { clientX: c.left + 14, clientY: c.top + 16, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: r.left + 14, clientY: r.top + 20, bubbles: true }));
    });

    const count = await page.evaluate(() => document.querySelectorAll("[data-drop-indicator]").length);
    expect(count).toBe(1);

    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 0, clientY: 0, bubbles: true }));
    });
  });

  test("full-bleed class applied to dock workbench samples", async ({ page }) => {
    const hasFullBleed = await page.evaluate(() => {
      return document.getElementById("sample-target")?.classList.contains("full-bleed") ?? false;
    });
    expect(hasFullBleed).toBe(true);
  });

  test("dock workbench fills available height", async ({ page }) => {
    const heights = await page.evaluate(() => {
      const target = document.getElementById("sample-target");
      const dwb = document.querySelector("pages-dock-workbench");
      return {
        target: target?.getBoundingClientRect().height ?? 0,
        dwb: dwb?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(heights.dwb).toBeGreaterThan(heights.target * 0.8);
  });
});
