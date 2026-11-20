import puppeteer from 'puppeteer-core';

const outDir = '/opt/cursor/artifacts';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function login(page, email) {
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForSelector('input[type="email"], [data-testid="buy-screen"], [data-testid="manager-desk"]');
  const emailField = await page.$('input[type="email"]');
  if (emailField) {
    await emailField.type(email);
    await page.type('input[type="password"]', 'secret12');
    await page.click('button[type="submit"]');
  }
}

const manager = await browser.newPage();
manager.setDefaultTimeout(20000);
await manager.setViewport({ width: 1280, height: 900 });
await login(manager, 'jim@shop.test');
await manager.waitForSelector('[data-testid="buy-screen"], [data-testid="manager-desk"]');
await manager.goto('http://127.0.0.1:3000/#/manage/buys', { waitUntil: 'domcontentloaded' });
await manager.waitForFunction(() => document.body.innerText.includes('Sam Seller'));
await manager.screenshot({ path: `${outDir}/manager-desk.png`, fullPage: true });
console.log('saved manager-desk');

const staffContext = await browser.createBrowserContext();
const staff = await staffContext.newPage();
staff.setDefaultTimeout(20000);
await staff.setViewport({ width: 1280, height: 900 });
await login(staff, 'alex@shop.test');
try {
  await staff.waitForSelector('[data-testid="buy-screen"]');
} catch (error) {
  const text = await staff.evaluate(() => document.body.innerText);
  throw new Error(text.slice(0, 800));
}
const text = await staff.evaluate(() => document.body.innerText);
if (/Manager desk|Download these|Daily Summary|History/.test(text)) {
  throw new Error(`Staff view leaked tools: ${text.slice(0, 400)}`);
}
await staff.screenshot({ path: `${outDir}/staff-buy-screen.png`, fullPage: true });
console.log('saved staff-buy-screen');
await staff.goto('http://127.0.0.1:3000/#/manage', { waitUntil: 'domcontentloaded' });
await staff.waitForFunction(() => document.body.innerText.includes('Managers only'));
await staff.screenshot({ path: `${outDir}/staff-blocked.png`, fullPage: true });
console.log('saved staff-blocked');
await browser.close();
