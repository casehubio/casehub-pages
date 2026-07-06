import { test, expect } from "@playwright/test";

async function openSample(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();
  await page.locator(`.sample-item`, { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.waitForTimeout(2000);
}

function getSelectorOptions(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const selector = document.querySelector("pages-selector");
    const select = selector?.shadowRoot?.querySelector("select") as HTMLSelectElement | null;
    if (!select) return { count: 0, options: [] as string[], selectedText: "" };
    return {
      count: select.options.length,
      options: Array.from(select.options).map(o => o.textContent ?? ""),
      selectedText: select.options[select.selectedIndex]?.textContent ?? "",
    };
  });
}

function selectFilterOption(page: import("@playwright/test").Page, text: string) {
  return page.evaluate((targetText) => {
    const selector = document.querySelector("pages-selector");
    const select = selector?.shadowRoot?.querySelector("select") as HTMLSelectElement | null;
    if (!select) return false;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i]!.textContent === targetText) {
        select.selectedIndex = i;
        select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return true;
      }
    }
    return false;
  }, text);
}

test.describe("Selector dropdown preserves options after filter", () => {
  test("Patient Tracker — all ward options remain after selecting ICU", async ({ page }) => {
    await openSample(page, "Patient Tracker");

    const before = await getSelectorOptions(page);
    console.log("Before filter:", JSON.stringify(before));
    expect(before.count).toBeGreaterThanOrEqual(4);

    await selectFilterOption(page, "ICU");
    await page.waitForTimeout(2000);

    const after = await getSelectorOptions(page);
    console.log("After ICU filter:", JSON.stringify(after));

    expect(
      after.count,
      `Dropdown should still have ${before.count} options after filtering (got ${after.count})`
    ).toBe(before.count);

    expect(
      after.options,
      "All original options should be preserved"
    ).toEqual(before.options);

    expect(after.selectedText).toBe("ICU");
  });

  test("Patient Tracker — can switch from ICU to General", async ({ page }) => {
    await openSample(page, "Patient Tracker");

    await selectFilterOption(page, "ICU");
    await page.waitForTimeout(2000);

    const afterICU = await getSelectorOptions(page);
    expect(afterICU.selectedText).toBe("ICU");

    await selectFilterOption(page, "General");
    await page.waitForTimeout(2000);

    const afterGeneral = await getSelectorOptions(page);
    expect(afterGeneral.selectedText).toBe("General");
    expect(afterGeneral.count).toBe(afterICU.count);
  });

  test("Patient Tracker — can reset to All after filtering", async ({ page }) => {
    await openSample(page, "Patient Tracker");

    await selectFilterOption(page, "ICU");
    await page.waitForTimeout(2000);

    await selectFilterOption(page, "All");
    await page.waitForTimeout(2000);

    const after = await getSelectorOptions(page);
    expect(after.selectedText).toBe("All");
  });
});
