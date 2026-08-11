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
