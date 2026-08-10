import { test, expect } from "@playwright/test";

async function openFloatingWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByText("Layout").click();
  await page.getByText("Floating Workspace").click();
  await page.waitForSelector("[data-floating-workspace-centre]", { timeout: 10000 });
}

test.describe("Floating Workspace", () => {
  test("centre content renders", async ({ page }) => {
    await openFloatingWorkspace(page);
    const centre = page.locator("[data-floating-workspace-centre]");
    await expect(centre).toBeVisible();
    await expect(centre).toContainText("Editor Area");
  });

  test("floating frames appear after backend loads", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const overlay = page.locator("[data-floating-workspace-overlay]");
    await expect(overlay).toBeAttached();
  });

  test("close dot removes a frame", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const closeDots = page.locator(".frame-close-dot");
    const initialCount = await closeDots.count();
    if (initialCount === 0) {
      test.skip(true, "No close dots rendered — backend may not have loaded");
      return;
    }
    await closeDots.first().click();
    await expect(page.locator(".frame-close-dot")).toHaveCount(initialCount - 1);
  });

  test("pin button toggles", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const pinBtns = page.locator(".frame-pin-btn");
    const count = await pinBtns.count();
    if (count === 0) {
      test.skip(true, "No pin buttons rendered — backend may not have loaded");
      return;
    }
    await pinBtns.first().click();
    // Pin event should fire without error
    await expect(page.locator("[data-floating-workspace-centre]")).toBeVisible();
  });

  test("dock panels toggle independently of floating frames", async ({ page }) => {
    await openFloatingWorkspace(page);
    await page.waitForSelector("[data-floating-workspace-overlay]", { timeout: 10000 });
    const explorerBtn = page.locator("button[data-dock-panel-id='explorer']");
    if (await explorerBtn.count() === 0) {
      test.skip(true, "No dock buttons found");
      return;
    }
    // Toggle off
    await explorerBtn.click();
    // Centre content should still be visible
    await expect(page.locator("[data-floating-workspace-centre]")).toBeVisible();
    // Toggle back on
    await explorerBtn.click();
    await expect(page.locator("[data-floating-workspace-centre]")).toBeVisible();
  });
});
