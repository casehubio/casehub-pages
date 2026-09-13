import { test, expect } from "@playwright/test";

/**
 * Visual builder e2e tests.
 *
 * Prerequisites: the examples build must include @casehubio/pages-builder
 * and @casehubio/pages-runtime with editMode support. The gallery app
 * needs a "Visual Builder" sample or a standalone builder.html page.
 *
 * To run: cd examples && npx playwright test tests/builder.spec.ts
 */

const SAMPLE_YAML = `pages:
- name: Overview
  components:
  - type: title
    properties:
      text: Hello World
  - type: bar-chart
    properties:
      subtype: column
datasets:
- uuid: sales_tx
  url: /api/sales
`;

async function mountBuilder(page: import("@playwright/test").Page, yaml: string) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();

  const builderAvailable = await page.evaluate(() => {
    return customElements.get("pages-builder-shell") !== undefined;
  });

  if (!builderAvailable) {
    test.skip(true, "pages-builder-shell not registered — examples build needs @casehubio/pages-builder");
    return;
  }

  await page.evaluate((yamlSource) => {
    const target = document.getElementById("sample-target") ?? document.body;
    target.innerHTML = "";
    const shell = document.createElement("pages-builder-shell") as any;
    shell.yaml = yamlSource;
    shell.style.cssText = "height: 600px; width: 100%;";
    target.appendChild(shell);
  }, yaml);

  await page.waitForFunction(() => {
    const shell = document.querySelector("pages-builder-shell");
    return shell?.shadowRoot?.querySelector('[role="tree"]') !== null;
  }, null, { timeout: 5000 });
}

test.describe("Visual Builder", () => {
  test("renders outline tree with document structure", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");
    await expect(shell).toBeVisible();

    const treeItems = shell.locator("pages-builder-tree").locator("[role='treeitem']");
    await expect(treeItems.first()).toBeVisible();

    const labels = await treeItems.allTextContents();
    expect(labels.some(l => l.includes("Pages"))).toBe(true);
    expect(labels.some(l => l.includes("Datasets"))).toBe(true);
  });

  test("adds a page via toolbar", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");
    const addPageBtn = shell.locator("button:has-text('+ Page')");
    await addPageBtn.click();

    const treeLabels = shell.locator("pages-builder-tree .label");
    await expect(treeLabels.filter({ hasText: "New Page" })).toBeVisible();
  });

  test("opens component palette", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");
    const addCompBtn = shell.locator("button:has-text('+ Component')");
    await addCompBtn.click();

    const palette = shell.locator("pages-builder-palette");
    const overlay = palette.locator(".palette-overlay");
    await expect(overlay).toBeVisible();

    const searchInput = overlay.locator(".palette-search");
    await expect(searchInput).toBeVisible();

    const tiles = overlay.locator(".palette-tile");
    await expect(tiles.first()).toBeVisible();
  });

  test("filters palette by search", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");
    await shell.locator("button:has-text('+ Component')").click();

    const palette = shell.locator("pages-builder-palette");
    const searchInput = palette.locator(".palette-search");
    await searchInput.fill("bar");

    const tiles = palette.locator(".palette-tile");
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);

    const firstLabel = await tiles.first().locator(".tile-label").textContent();
    expect(firstLabel).toContain("Bar");
  });

  test("toggles YAML pane", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");
    const toggle = shell.locator(".yaml-toggle");
    await toggle.click();

    const codeEditor = shell.locator("pages-code-editor");
    await expect(codeEditor).toBeVisible();
  });

  test("undo reverts add page", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");
    await shell.locator("button:has-text('+ Page')").click();

    const treeLabels = shell.locator("pages-builder-tree .label");
    await expect(treeLabels.filter({ hasText: "New Page" })).toBeVisible();

    await shell.locator("button:has-text('Undo')").click();
    await expect(treeLabels.filter({ hasText: "New Page" })).not.toBeVisible();
  });

  test("selects component and shows property panel", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");

    // Expand the Pages section and click the title component
    const titleItem = shell.locator("pages-builder-tree [data-node-type='component']").first();
    await titleItem.click();

    const propPanel = shell.locator("pages-property-palette");
    await expect(propPanel).toBeVisible();
  });

  test("edits YAML and tree updates", async ({ page }) => {
    await mountBuilder(page, SAMPLE_YAML);

    const shell = page.locator("pages-builder-shell");
    await shell.locator(".yaml-toggle").click();

    const codeEditor = shell.locator("pages-code-editor");
    await expect(codeEditor).toBeVisible();

    // Modify YAML via the code editor
    await page.evaluate(() => {
      const shell = document.querySelector("pages-builder-shell") as any;
      const newYaml = `pages:
- name: Modified Page
  components:
  - type: title
    properties:
      text: Updated
`;
      shell.yaml = newYaml;
    });

    const treeLabels = shell.locator("pages-builder-tree .label");
    await expect(treeLabels.filter({ hasText: "Modified Page" })).toBeVisible({ timeout: 2000 });
  });
});
