import { test, expect } from "@playwright/test";

async function openSample(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();
  await page.locator(`.sample-item`, { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.waitForTimeout(2000);
}

const DARK_MODE_DASHBOARDS = [
  "DarkMode",
  "Fleet Monitor",
  "Quarkus Monitoring",
  "Kepler Metrics",
  "ModelMeshMetrics",
  "FIFA 2022 Goals",
];

test.describe("Theme consistency — gallery mode overrides YAML mode", () => {
  for (const name of DARK_MODE_DASHBOARDS) {
    test(`${name} — renders light when gallery is in light mode`, async ({ page }) => {
      await openSample(page, name);

      const sampleTheme = await page.evaluate(() => {
        const target = document.getElementById("sample-target")!;
        return {
          hasLight: target.classList.contains("pages-theme-light"),
          hasDark: target.classList.contains("pages-theme-dark"),
        };
      });

      expect(
        sampleTheme.hasLight,
        `${name} should have pages-theme-light on sample-target (gallery is in light mode)`
      ).toBe(true);
      expect(
        sampleTheme.hasDark,
        `${name} should NOT have pages-theme-dark on sample-target (gallery is in light mode)`
      ).toBe(false);
    });
  }

  test("Fleet Monitor — switches to dark when gallery toggles dark", async ({ page }) => {
    await openSample(page, "Fleet Monitor");

    // Toggle to dark
    await page.locator("#theme-toggle").click();

    const sampleTheme = await page.evaluate(() => {
      const target = document.getElementById("sample-target")!;
      return {
        hasLight: target.classList.contains("pages-theme-light"),
        hasDark: target.classList.contains("pages-theme-dark"),
      };
    });

    expect(sampleTheme.hasDark).toBe(true);
    expect(sampleTheme.hasLight).toBe(false);
  });

  test("Fleet Monitor — toggles back to light correctly", async ({ page }) => {
    await openSample(page, "Fleet Monitor");

    // Toggle dark then back to light
    await page.locator("#theme-toggle").click();
    await page.locator("#theme-toggle").click();

    const sampleTheme = await page.evaluate(() => {
      const target = document.getElementById("sample-target")!;
      return {
        hasLight: target.classList.contains("pages-theme-light"),
        hasDark: target.classList.contains("pages-theme-dark"),
      };
    });

    expect(sampleTheme.hasLight).toBe(true);
    expect(sampleTheme.hasDark).toBe(false);
  });
});
