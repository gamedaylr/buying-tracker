import puppeteer from 'puppeteer-core';
import fs from 'fs';

const outDir = '/opt/cursor/artifacts';
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
page.setDefaultTimeout(20000);
await page.evaluateOnNewDocument(() => {
  window.print = () => {};
});
page.on('pageerror', (error) => console.log('PAGE', error.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE', msg.text());
});

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log('saved', name);
}

await page.setViewport({ width: 1280, height: 900 });
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
await page.waitForSelector('h1');
await shot('setup-screen');

const setup = await page.$$('form input');
await setup[1].type('Jim');
await setup[2].type('jim@shop.test');
await setup[3].type('secret12');
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="buy-screen"]');

await page.type('input[placeholder="Start typing a name or phone"]', 'Sam Seller');
const comp = await page.$('input[inputmode="decimal"]');
await comp.click({ clickCount: 3 });
await comp.type('200');
await page.waitForFunction(() => document.body.innerText.includes('$140.00') && document.body.innerText.includes('$160.00'));
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Cash') && el.textContent.includes('%'));
  button.click();
});
await shot('buy-screen-offers');

await page.setViewport({ width: 820, height: 1100 });
await shot('buy-screen-tablet');
await page.setViewport({ width: 390, height: 844 });
await shot('buy-screen-phone');
await page.setViewport({ width: 1280, height: 900 });

await page.click('button.btn-save');
try {
  await page.waitForSelector('[data-testid="saved-buy"]');
} catch (error) {
  const text = await page.evaluate(() => document.body.innerText);
  throw new Error(`Save did not finish.\n${text.slice(0, 1200)}`);
}
await page.goto('http://127.0.0.1:3000/#/manage/buys', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.body.innerText.includes('Sam Seller'));
await shot('manager-desk');

await page.goto('http://127.0.0.1:3000/#/manage/people', { waitUntil: 'networkidle0' });
await page.waitForSelector('h2');
const people = await page.$$('form input');
await people[0].type('Alex');
await people[1].type('alex@shop.test');
await people[2].type('secret12');
await page.click('button[type="submit"]');
await page.waitForFunction(() => document.body.innerText.includes('can sign in now'));
await shot('manager-people');

await page.click('button::-p-text(Sign out)');
await page.waitForSelector('h1');
const login = await page.$$('form input');
await login[0].type('alex@shop.test');
await login[1].type('secret12');
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="buy-screen"]');
const staffText = await page.evaluate(() => document.body.innerText);
if (staffText.includes('Manager desk') || staffText.includes('History') || staffText.includes('Download')) {
  throw new Error(`Staff screen leaked manager tools:\n${staffText.slice(0, 500)}`);
}
await shot('staff-buy-screen');

await page.goto('http://127.0.0.1:3000/#/manage', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.body.innerText.includes('Managers only'));
await shot('staff-blocked');

await browser.close();
console.log('done');
