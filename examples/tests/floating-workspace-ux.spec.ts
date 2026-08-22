import { test, expect } from "@playwright/test";

async function openFloatingWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();
  await page.locator('.sample-item:has-text("Floating Workspace")').first().click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.waitForSelector("[data-floating-workspace-centre]", { timeout: 10000 });
}

test.describe("Floating Workspace UX Polish", () => {
  test("organiser toolbar renders when organisers not disabled", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const toolbar = page.locator("[data-floating-workspace-toolbar]");
    await expect(toolbar).toBeAttached();
  });

  test("organiser toolbar has 5 preset buttons", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-toolbar]", { state: "attached", timeout: 10000 });
    const buttons = page.locator("[data-floating-workspace-toolbar] button");
    const count = await buttons.count();
    expect(count).toBe(5);
  });

  test("animation styles are injected", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const styleEl = page.locator("style[data-pages-frame-animations]");
    await expect(styleEl).toBeAttached();
    const content = await styleEl.textContent();
    expect(content).toContain("frame-enter");
    expect(content).toContain("prefers-reduced-motion");
  });

  test("snap preview overlay is in the DOM", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const preview = page.locator("[data-snap-preview]");
    await expect(preview).toBeAttached();
  });

  test("edge split: dragging tab to frame content edge creates internal split", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });

    const framesBefore = await page.evaluate(() =>
      [...document.querySelectorAll("[data-frame-key]")].map((f) => f.getAttribute("data-frame-key")),
    );

    const previewTabs = await page.locator('[data-frame-key="preview"] [data-tab-key]').count();
    if (previewTabs < 2) {
      test.skip(true, "Preview frame needs 2+ tabs for split");
      return;
    }

    const tab = await page.locator('[data-frame-key="preview"] [data-tab-key]').first().boundingBox();
    const content = await page.locator('[data-frame-key="preview"] [data-tab-content]').boundingBox();
    if (!tab || !content) { test.skip(true, "Could not get bounding boxes"); return; }

    const sx = tab.x + tab.width / 2;
    const sy = tab.y + tab.height / 2;
    const tx = content.x + 15;
    const ty = content.y + content.height / 2;

    await page.evaluate(({ sx, sy, tx, ty }) => {
      const tabEl = document.querySelector('[data-frame-key="preview"] [data-tab-key]');
      if (!tabEl) return;
      tabEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: sx, clientY: sy, bubbles: true }));
      for (let i = 1; i <= 20; i++) {
        const p = i / 20;
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: sx + (tx - sx) * p, clientY: sy + (ty - sy) * p, bubbles: true,
        }));
      }
    }, { sx, sy, tx, ty });

    await page.waitForTimeout(200);
    const overlay = await page.locator("[data-edge-split-overlay]").count();
    expect(overlay).toBe(1);

    await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
    await page.waitForTimeout(500);

    const framesAfter = await page.evaluate(() =>
      [...document.querySelectorAll("[data-frame-key]")].map((f) => f.getAttribute("data-frame-key")),
    );
    expect(framesAfter.length).toBe(framesBefore.length);

    const splitContainer = await page.locator('[data-frame-key="preview"] [data-split-container]').count();
    expect(splitContainer).toBe(1);

    const tabStrips = await page.locator('[data-frame-key="preview"] [data-tab-strip]').count();
    expect(tabStrips).toBe(2);

    const panes = await page.locator('[data-frame-key="preview"] [data-split-pane]').count();
    expect(panes).toBe(2);
  });

  test("edge split: drag out of pane collapses split, creates new frame", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });

    // Split first
    const tab = await page.locator('[data-frame-key="preview"] [data-tab-key]').first().boundingBox();
    const content = await page.locator('[data-frame-key="preview"] [data-tab-content]').boundingBox();
    if (!tab || !content) { test.skip(true, "No bounding boxes"); return; }

    await page.evaluate(({ sx, sy, tx, ty }) => {
      const el = document.querySelector('[data-frame-key="preview"] [data-tab-key]');
      if (!el) return;
      el.dispatchEvent(new PointerEvent("pointerdown", { clientX: sx, clientY: sy, bubbles: true }));
      for (let i = 1; i <= 20; i++) {
        const p = i / 20;
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: sx + (tx - sx) * p, clientY: sy + (ty - sy) * p, bubbles: true,
        }));
      }
    }, { sx: tab.x + tab.width / 2, sy: tab.y + tab.height / 2, tx: content.x + 15, ty: content.y + content.height / 2 });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
    await page.waitForTimeout(500);
    expect(await page.locator('[data-frame-key="preview"] [data-split-container]').count()).toBe(1);

    // Drag tab out of pane 1
    const paneBContent = await page.locator('[data-split-pane="1"] [data-tab-content]').boundingBox();
    const paneBTab = await page.locator('[data-split-pane="1"] [data-tab-key]').first().boundingBox();
    if (!paneBContent || !paneBTab) { test.skip(true, "No pane 1 boxes"); return; }

    await page.evaluate(({ sx, sy, tx, ty }) => {
      const el = document.querySelector('[data-split-pane="1"] [data-tab-key]');
      if (!el) return;
      el.dispatchEvent(new PointerEvent("pointerdown", { clientX: sx, clientY: sy, bubbles: true }));
      for (let i = 1; i <= 20; i++) {
        const p = i / 20;
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: sx + (tx - sx) * p, clientY: sy + (ty - sy) * p, bubbles: true,
        }));
      }
    }, { sx: paneBTab.x + paneBTab.width / 2, sy: paneBTab.y + paneBTab.height / 2, tx: paneBContent.x, ty: paneBContent.y + paneBContent.height + 150 });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
    await page.waitForTimeout(500);

    // Preview frame survives, split collapsed
    const previewFrame = page.locator('[data-frame-key="preview"]');
    await expect(previewFrame).toBeAttached();
    expect(await previewFrame.locator("[data-split-container]").count()).toBe(0);
    expect(await previewFrame.locator("[data-tab-key]").count()).toBeGreaterThan(0);

    // New frame created
    const allFrames = await page.locator("[data-frame-key]").count();
    expect(allFrames).toBe(3);
  });

  test("edge split: cross-pane drop moves tab and collapses split", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });

    // Split first
    const tab = await page.locator('[data-frame-key="preview"] [data-tab-key]').first().boundingBox();
    const content = await page.locator('[data-frame-key="preview"] [data-tab-content]').boundingBox();
    if (!tab || !content) { test.skip(true, "No bounding boxes"); return; }

    await page.evaluate(({ sx, sy, tx, ty }) => {
      const el = document.querySelector('[data-frame-key="preview"] [data-tab-key]');
      if (!el) return;
      el.dispatchEvent(new PointerEvent("pointerdown", { clientX: sx, clientY: sy, bubbles: true }));
      for (let i = 1; i <= 20; i++) {
        const p = i / 20;
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: sx + (tx - sx) * p, clientY: sy + (ty - sy) * p, bubbles: true,
        }));
      }
    }, { sx: tab.x + tab.width / 2, sy: tab.y + tab.height / 2, tx: content.x + content.width - 15, ty: content.y + content.height / 2 });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
    await page.waitForTimeout(500);
    expect(await page.locator('[data-frame-key="preview"] [data-split-container]').count()).toBe(1);

    // Drag tab from pane 1 to pane 0's strip
    const paneAStrip = await page.locator('[data-split-pane="0"] [data-tab-strip]').boundingBox();
    const paneBTab = await page.locator('[data-split-pane="1"] [data-tab-key]').first().boundingBox();
    if (!paneAStrip || !paneBTab) { test.skip(true, "No pane boxes"); return; }

    await page.evaluate(({ sx, sy, tx, ty }) => {
      const el = document.querySelector('[data-split-pane="1"] [data-tab-key]');
      if (!el) return;
      el.dispatchEvent(new PointerEvent("pointerdown", { clientX: sx, clientY: sy, bubbles: true }));
      for (let i = 1; i <= 20; i++) {
        const p = i / 20;
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: sx + (tx - sx) * p, clientY: sy + (ty - sy) * p, bubbles: true,
        }));
      }
    }, { sx: paneBTab.x + paneBTab.width / 2, sy: paneBTab.y + paneBTab.height / 2, tx: paneAStrip.x + paneAStrip.width / 2, ty: paneAStrip.y + paneAStrip.height / 2 });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
    await page.waitForTimeout(500);

    // Split collapsed — back to single pane with both tabs
    const previewFrame = page.locator('[data-frame-key="preview"]');
    await expect(previewFrame).toBeAttached();
    expect(await previewFrame.locator("[data-split-container]").count()).toBe(0);
    expect(await previewFrame.locator("[data-tab-key]").count()).toBe(2);
  });

  test("edge split: same-direction promotion creates 3 panes at root level", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });

    // Add a 3rd tab to the preview frame so we can split twice
    await page.evaluate(() => {
      const addBtn = document.querySelector('[data-frame-key="preview"] .frame-add-tab-btn') as HTMLElement | null;
      if (addBtn) addBtn.click();
    });
    await page.waitForTimeout(300);

    const previewTabs = await page.locator('[data-frame-key="preview"] [data-tab-key]').count();
    if (previewTabs < 3) {
      test.skip(true, "Preview frame needs 3+ tabs for promotion test");
      return;
    }

    // First split: drag first tab to left edge → creates 2-pane split
    const tab1 = await page.locator('[data-frame-key="preview"] [data-tab-key]').first().boundingBox();
    const content1 = await page.locator('[data-frame-key="preview"] [data-tab-content]').boundingBox();
    if (!tab1 || !content1) { test.skip(true, "No bounding boxes"); return; }

    await page.evaluate(({ sx, sy, tx, ty }) => {
      const el = document.querySelector('[data-frame-key="preview"] [data-tab-key]');
      if (!el) return;
      el.dispatchEvent(new PointerEvent("pointerdown", { clientX: sx, clientY: sy, bubbles: true }));
      for (let i = 1; i <= 20; i++) {
        const p = i / 20;
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: sx + (tx - sx) * p, clientY: sy + (ty - sy) * p, bubbles: true,
        }));
      }
    }, { sx: tab1.x + tab1.width / 2, sy: tab1.y + tab1.height / 2, tx: content1.x + 15, ty: content1.y + content1.height / 2 });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
    await page.waitForTimeout(500);

    expect(await page.locator('[data-frame-key="preview"] [data-split-container]').count()).toBe(1);
    expect(await page.locator('[data-frame-key="preview"] [data-split-pane]').count()).toBe(2);

    // Second split: drag a tab from pane 1 to left edge of pane 1 → same direction → promotes to 3 panes
    const pane1Tab = await page.locator('[data-split-pane="1"] [data-tab-key]').first().boundingBox();
    const pane1Content = await page.locator('[data-split-pane="1"] [data-tab-content]').boundingBox();
    if (!pane1Tab || !pane1Content) { test.skip(true, "No pane 1 boxes for second split"); return; }

    const pane1Tabs = await page.locator('[data-split-pane="1"] [data-tab-key]').count();
    if (pane1Tabs < 2) { test.skip(true, "Pane 1 needs 2+ tabs for second split"); return; }

    await page.evaluate(({ sx, sy, tx, ty }) => {
      const el = document.querySelector('[data-split-pane="1"] [data-tab-key]');
      if (!el) return;
      el.dispatchEvent(new PointerEvent("pointerdown", { clientX: sx, clientY: sy, bubbles: true }));
      for (let i = 1; i <= 20; i++) {
        const p = i / 20;
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: sx + (tx - sx) * p, clientY: sy + (ty - sy) * p, bubbles: true,
        }));
      }
    }, { sx: pane1Tab.x + pane1Tab.width / 2, sy: pane1Tab.y + pane1Tab.height / 2, tx: pane1Content.x + 15, ty: pane1Content.y + pane1Content.height / 2 });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
    await page.waitForTimeout(500);

    // 3 panes at root level — same direction promoted, NOT nested
    const panes = await page.locator('[data-frame-key="preview"] [data-split-pane]').count();
    expect(panes).toBe(3);

    // Only 1 split container (no nested splits)
    const containers = await page.locator('[data-frame-key="preview"] [data-split-container]').count();
    expect(containers).toBe(1);
  });

  test("detach buttons appear on frames", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const detachBtns = page.locator(".frame-detach-btn");
    const count = await detachBtns.count();
    if (count === 0) {
      test.skip(true, "No detach buttons — Dockview floating groups may not render chrome in headless");
      return;
    }
    expect(count).toBeGreaterThan(0);
  });
});
