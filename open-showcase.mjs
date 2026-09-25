import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:9090/');
await page.waitForSelector('#categories-nav');
await page.waitForTimeout(1500);
await page.click('text=Flow Control');

console.log('Browser open — showing Flow Control. Close the window when done.');
await new Promise(() => {});
