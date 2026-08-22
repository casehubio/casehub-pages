import { test, expect } from "@playwright/test";

async function openSandbox(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForSelector("#sample-count");
  await page.click('.sample-item:has-text("Frame Sandbox")');
  await page.waitForSelector("[data-frame-sandbox='mounted']", {
    timeout: 10000,
  });
}

const SAMPLE = "#sample-container";

test.describe("Frame Sandbox", () => {
  test("example page loads with sandbox mounted", async ({ page }) => {
    await openSandbox(page);
    const sandbox = page.locator(
      `${SAMPLE} [data-frame-sandbox='mounted']`,
    ).first();
    await expect(sandbox).toBeVisible();
  });

  test("tab switching shows correct content", async ({ page }) => {
    await openSandbox(page);

    const editor = page.locator("[data-frame-key='editor']");
    await expect(editor).toBeVisible();

    await editor.locator("[data-tab-key='output']").click();
    await expect(
      editor.locator("text=Output panel"),
    ).toBeVisible();

    await editor.locator("[data-tab-key='code']").click();
    await expect(
      editor.locator("text=Code Editor"),
    ).toBeVisible();
  });

  test("accordion sections expand and collapse", async ({ page }) => {
    await openSandbox(page);

    const editor = page.locator("[data-frame-key='editor']");
    await editor.locator("[data-tab-key='nested-accordion']").click();

    const accordion = editor.locator("[data-accordion-section]");
    await expect(accordion).toHaveCount(2);

    await expect(
      editor.locator("text=x = 42"),
    ).toBeVisible();

    await editor.locator("[data-section-key='vars']").click();
    await expect(
      editor.locator("text=x = 42"),
    ).not.toBeVisible();

    await editor.locator("[data-section-key='vars']").click();
    await expect(
      editor.locator("text=x = 42"),
    ).toBeVisible();
  });

  test("frame drag changes position", async ({ page }) => {
    await openSandbox(page);

    const frame = page.locator("[data-frame-key='preview']");
    const titlebar = frame.locator("[data-frame-titlebar]");
    const box = await frame.boundingBox();
    if (!box) {
      test.skip(true, "Frame not visible");
      return;
    }

    await titlebar.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + 50 + 80, box.y + 10 + 40);
    await page.mouse.up();

    const newBox = await frame.boundingBox();
    expect(newBox!.x).not.toBe(box.x);
  });

  test("frame resize changes dimensions", async ({ page }) => {
    await openSandbox(page);

    const frame = page.locator("[data-frame-key='preview']");
    const box = await frame.boundingBox();
    if (!box) {
      test.skip(true, "Frame not visible");
      return;
    }
    const handle = frame.locator("[data-resize-handle='se']");

    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width + 50,
      box.y + box.height + 30,
    );
    await page.mouse.up();

    const newBox = await frame.boundingBox();
    expect(newBox!.width).toBeGreaterThan(box.width);
    expect(newBox!.height).toBeGreaterThan(box.height);
  });

  test("3-level nesting renders", async ({ page }) => {
    await openSandbox(page);

    const editor = page.locator("[data-frame-key='editor']");
    await editor.locator("[data-tab-key='nested-accordion']").click();
    await expect(
      editor.locator("[data-section-key='vars']"),
    ).toBeVisible();
    await expect(
      editor.locator("[data-section-key='stack']"),
    ).toBeVisible();
  });
});
