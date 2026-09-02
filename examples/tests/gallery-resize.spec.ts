import { test, expect } from "@playwright/test";

async function openSample(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();
  await page.fill('input[type="text"]', name);
  await page.waitForTimeout(300);
  await page.locator(`.sample-item:has-text("${name}")`).first().click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.waitForTimeout(1500);
}

test.describe("Gallery shell — responsive layout", () => {
  test.describe("full-bleed samples (graph canvas) fill viewport and resize", () => {
    test("graph canvas fills available space", async ({ page }) => {
      await openSample(page, "Multi Select");
      const canvas = page.locator("pages-graph-canvas");
      await expect(canvas).toBeVisible({ timeout: 10000 });

      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(400);
      expect(box!.height).toBeGreaterThan(200);
    });

    test("graph canvas resizes when viewport shrinks", async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await openSample(page, "Multi Select");
      const canvas = page.locator("pages-graph-canvas");
      await expect(canvas).toBeVisible({ timeout: 10000 });

      const before = await canvas.boundingBox();
      expect(before).not.toBeNull();

      await page.setViewportSize({ width: 900, height: 600 });
      await page.waitForTimeout(500);

      const after = await canvas.boundingBox();
      expect(after).not.toBeNull();
      expect(after!.width).toBeLessThan(before!.width);
      expect(after!.height).toBeLessThan(before!.height);
    });

    test("graph canvas resizes when viewport grows", async ({ page }) => {
      await page.setViewportSize({ width: 1000, height: 700 });
      await openSample(page, "Multi Select");
      const canvas = page.locator("pages-graph-canvas");
      await expect(canvas).toBeVisible({ timeout: 10000 });

      const before = await canvas.boundingBox();
      expect(before).not.toBeNull();

      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.waitForTimeout(500);

      const after = await canvas.boundingBox();
      expect(after).not.toBeNull();
      expect(after!.width).toBeGreaterThan(before!.width);
      expect(after!.height).toBeGreaterThan(before!.height);
    });
  });

  test.describe("scrollable samples still scroll", () => {
    test("table sample content is scrollable", async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await openSample(page, "Data Table");

      const sampleArea = page.locator(".sample-content-with-code");
      const overflow = await sampleArea.evaluate(
        (el) => getComputedStyle(el).overflow,
      );
      expect(overflow).toBe("auto");
    });
  });

  test.describe("overflow toggle — full-bleed vs scrollable", () => {
    test("sample-content-with-code is hidden for full-bleed, auto for normal", async ({ page }) => {
      // Load graph sample (full-bleed)
      await openSample(page, "Multi Select");
      const sampleArea = page.locator(".sample-content-with-code");
      const overflowFullBleed = await sampleArea.evaluate(
        (el) => getComputedStyle(el).overflow,
      );
      expect(overflowFullBleed).toBe("hidden");

      // Load table sample (normal)
      await page.fill('input[type="text"]', "Data Table");
      await page.waitForTimeout(300);
      await page.locator('.sample-item:has-text("Data Table")').first().click();
      await page.waitForTimeout(1500);
      const overflowNormal = await sampleArea.evaluate(
        (el) => getComputedStyle(el).overflow,
      );
      expect(overflowNormal).toBe("auto");
    });
  });
});
