import { test, expect } from "@playwright/test";

async function openSample(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();
  await page.locator(`.sample-item`, { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.waitForTimeout(2000);
}

test.describe("Sample content padding — no component touching another", () => {
  test("Sales Dashboard — card left edge has gap from sidebar separator", async ({
    page,
  }) => {
    await openSample(page, "Sales Dashboard");

    const gap = await page.evaluate(() => {
      const sidebarBorder = document.querySelector(".pages-sidebar, [data-tab-bar].pages-sidebar") as HTMLElement;
      if (!sidebarBorder) return -1;
      const sidebarRect = sidebarBorder.getBoundingClientRect();

      const metric = document.querySelector("[data-component-type='metric']") as HTMLElement;
      if (!metric) return -1;
      const metricRect = metric.getBoundingClientRect();

      return metricRect.left - sidebarRect.right;
    });

    expect(
      gap,
      `Card left edge must have >= 8px gap from sidebar separator (got ${gap}px)`
    ).toBeGreaterThanOrEqual(8);
  });

  test("Patient Tracker — card top edge has gap from tab bar bottom border", async ({
    page,
  }) => {
    await openSample(page, "Patient Tracker");

    const gap = await page.evaluate(() => {
      const tabBar = document.querySelector("[data-tab-bar]") as HTMLElement;
      if (!tabBar) return -1;
      const tabRect = tabBar.getBoundingClientRect();

      const metric = document.querySelector("[data-component-type='metric']") as HTMLElement;
      if (!metric) return -1;
      const metricRect = metric.getBoundingClientRect();

      return metricRect.top - tabRect.bottom;
    });

    expect(
      gap,
      `Card top edge must have >= 8px gap from tab bar border (got ${gap}px)`
    ).toBeGreaterThanOrEqual(8);
  });

  test("sample-target has sufficient padding for chart axis labels", async ({
    page,
  }) => {
    await openSample(page, "Sales Dashboard");

    const padding = await page.locator("#sample-target").evaluate((el) => {
      const style = getComputedStyle(el);
      return parseInt(style.paddingLeft, 10);
    });

    expect(
      padding,
      "Left padding must be >= 20px to prevent chart y-axis labels from clipping"
    ).toBeGreaterThanOrEqual(20);
  });
});
