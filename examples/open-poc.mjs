import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: ['--window-size=1200,900'],
});
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();
await page.goto('http://localhost:53839/poc/grid-drag-poc.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.click('#edit-btn');
console.log('POC open in edit mode. Ctrl+C to close.');
await new Promise(() => {});
