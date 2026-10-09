import { chromium, devices } from 'playwright';
const URL = process.env.DEMO_URL || 'http://127.0.0.1:8731/';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(URL, { waitUntil: 'load' });
const bb = await page.$eval('#pad-b', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; });
const move = () => page.evaluate(() => document.getElementById('move').textContent.trim());
const results = [];

// Four plain taps = the no-branch 4-hit Dancing Blade.
for (let i = 1; i <= 4; i++) {
  await page.touchscreen.tap(bb.x, bb.y);
  await page.waitForTimeout(90);
  const want = `Dancing Blade ${i}` + (i === 1 ? '' : ' side');
  results.push([`tap ${i} -> DB${i}`, await move(), want]);
}
// A 5th tap must not go past 4.
await page.touchscreen.tap(bb.x, bb.y);
await page.waitForTimeout(90);
results.push(['tap 5 does not exceed DB4', await move(), 'Dancing Blade 4 side']);

// Chain lapses after 700ms, so a tap starts over at DB1.
await page.waitForTimeout(900);
await page.touchscreen.tap(bb.x, bb.y);
await page.waitForTimeout(90);
results.push(['chain lapses, tap restarts at DB1', await move(), 'Dancing Blade 1']);

// Hold from rest is Shield Breaker. Use real CDP touch, not a synthetic
// PointerEvent: setPointerCapture throws without a genuine active pointer.
await page.reload({ waitUntil: 'load' });
const cdp = await page.context().newCDPSession(page);
const pt = [{ x: bb.x, y: bb.y, radiusX: 10, radiusY: 10, force: 1 }];
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
await page.waitForTimeout(500);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(80);
results.push(['hold from rest = Shield Breaker', await move(), 'Shield Breaker (charged)']);

let fail = 0;
for (const [n, got, want] of results) {
  const ok = got === want; if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  got "${got}"${ok ? '' : ` want "${want}"`}`);
}
if (errs.length) { console.log('PAGE ERRORS:', errs); fail++; }
console.log(fail ? `\n${fail} FAILED` : `\n${results.length}/${results.length} pass`);
await browser.close();
process.exit(fail ? 1 : 0);
