import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

interface Sample {
  name: string;
  path: string;
  category: string;
  file: string;
}

interface SamplesData {
  totalSamples: number;
  categories: Array<{
    category: string;
    samples: Sample[];
  }>;
}

const samplesPath = join(__dirname, "../dist/samples.json");
const samples: SamplesData = JSON.parse(readFileSync(samplesPath, "utf-8"));

test.describe("Navigation tree — all categories and samples visible", () => {
  test("total sample count matches", async ({ page }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();
    await expect(page.locator("#sample-count")).toHaveText(
      `${samples.totalSamples} samples`
    );
  });

  test("all categories are present", async ({ page }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    for (const cat of samples.categories) {
      const header = page.locator(
        `.category-header:has-text("${cat.category}")`
      );
      await expect(
        header,
        `Category "${cat.category}" should be visible in sidebar`
      ).toBeVisible();
    }
  });

  for (const cat of samples.categories) {
    test.describe(`Category: ${cat.category}`, () => {
      for (const sample of cat.samples) {
        test(`"${sample.name}" is visible in sidebar`, async ({ page }) => {
          await page.goto("/");
          await page.locator("#sample-count").waitFor();

          const item = page.locator(`.sample-item`, { hasText: new RegExp(`^${sample.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
          await expect(
            item,
            `Sample "${sample.name}" should be visible under "${cat.category}"`
          ).toBeVisible();
        });

        test(`"${sample.name}" can be selected`, async ({ page }) => {
          await page.goto("/");
          await page.locator("#sample-count").waitFor();

          const item = page.locator(`.sample-item`, { hasText: new RegExp(`^${sample.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
          await item.click();

          await expect(
            page.locator("#sample-container"),
            `Sample container should be visible after clicking "${sample.name}"`
          ).toBeVisible();

          await expect(
            page.locator("#current-sample-name"),
            `Sample name "${sample.name}" should appear in header`
          ).toHaveText(sample.name);

          await expect(
            item,
            `"${sample.name}" should have active class after click`
          ).toHaveClass(/active/);
        });
      }
    });
  }
});

test.describe("Navigation tree — layout indentation", () => {
  test("sample item text starts further right than category header text", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    const [headerPL, itemPL] = await page.evaluate(() => {
      const header = document.querySelector(".category-header") as HTMLElement;
      const item = document.querySelector(".sample-item") as HTMLElement;
      return [
        parseInt(getComputedStyle(header).paddingLeft, 10),
        parseInt(getComputedStyle(item).paddingLeft, 10),
      ];
    });

    expect(
      itemPL,
      `Sample item text indent (${itemPL}px) must exceed category header indent (${headerPL}px) — child must be visually nested under parent`
    ).toBeGreaterThan(headerPL);
  });

  test("all sample items have left padding greater than category headers", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    const headerPaddingLeft = await page
      .locator(".category-header")
      .first()
      .evaluate((el) => parseInt(getComputedStyle(el).paddingLeft, 10));

    const itemPaddingLeft = await page
      .locator(".sample-item")
      .first()
      .evaluate((el) => parseInt(getComputedStyle(el).paddingLeft, 10));

    expect(
      itemPaddingLeft,
      `Sample item padding-left (${itemPaddingLeft}px) must exceed category header padding-left (${headerPaddingLeft}px)`
    ).toBeGreaterThan(headerPaddingLeft);
  });

  test("category headers have non-zero left padding", async ({ page }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    const headers = page.locator(".category-header");
    const count = await headers.count();

    for (let i = 0; i < count; i++) {
      const paddingLeft = await headers
        .nth(i)
        .evaluate((el) => parseInt(getComputedStyle(el).paddingLeft, 10));
      expect(
        paddingLeft,
        `Category header ${i} must have non-zero padding-left`
      ).toBeGreaterThan(0);
    }
  });

  test("sample items have non-zero left padding", async ({ page }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    const items = page.locator(".sample-item:not(.hidden)");
    const count = await items.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const paddingLeft = await items
        .nth(i)
        .evaluate((el) => parseInt(getComputedStyle(el).paddingLeft, 10));
      expect(
        paddingLeft,
        `Sample item ${i} must have non-zero padding-left`
      ).toBeGreaterThan(0);
    }
  });
});

test.describe("Navigation tree — theme and density toggles", () => {
  test("theme toggle switches to dark mode", async ({ page }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    await expect(page.locator("html")).toHaveClass(/pages-theme-light/);

    await page.locator("#theme-toggle").click();

    await expect(page.locator("html")).toHaveClass(/pages-theme-dark/);
    await expect(page.locator("html")).not.toHaveClass(/pages-theme-light/);
  });

  test("theme toggle switches back to light mode", async ({ page }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/pages-theme-dark/);

    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/pages-theme-light/);
  });

  test("density toggle adds compact class", async ({ page }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    await expect(page.locator("html")).not.toHaveClass(/pages-density-compact/);

    await page.locator("#density-toggle").click();

    await expect(page.locator("html")).toHaveClass(/pages-density-compact/);
  });

  test("density toggle removes compact class on second click", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#sample-count").waitFor();

    await page.locator("#density-toggle").click();
    await expect(page.locator("html")).toHaveClass(/pages-density-compact/);

    await page.locator("#density-toggle").click();
    await expect(page.locator("html")).not.toHaveClass(
      /pages-density-compact/
    );
  });
});
