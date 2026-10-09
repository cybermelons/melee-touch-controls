// Verify the zoom-blocking listeners did not suppress the pad gestures.
// A touchend preventDefault can cancel the pointer events that follow, which
// would leave every pad dead while the page still looked correct.
import { chromium, devices } from 'playwright';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));

const URL = process.env.DEMO_URL || 'http://127.0.0.1:8731/';
await page.goto(URL, { waitUntil: 'load' });

const read = () => page.evaluate(() => ({
  move: document.getElementById('move').textContent.trim(),
  call: document.getElementById('call').textContent.trim(),
}));

const centre = sel => page.$eval(sel, el => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});

// Playwright's tap() dispatches a real touchstart/touchend pair.
const tap = async (sel) => {
  const { x, y } = await centre(sel);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(120);
};

const results = [];

await tap('#pad-b');
results.push(['B single tap fires DB1', (await read()).move, 'Dancing Blade 1']);

// Fast double tap: BOTH taps must register (DB1 then DB2). If the touchend
// zoom blocker eats the second tap, this is the test that catches it.
await page.reload({ waitUntil: 'load' });
const bb = await centre('#pad-b');
await page.touchscreen.tap(bb.x, bb.y);
await page.waitForTimeout(80);
await page.touchscreen.tap(bb.x, bb.y);
await page.waitForTimeout(120);
results.push(['B fast double tap advances chain', (await read()).move, 'Dancing Blade 2 side']);

// The page must not have zoomed from that double tap.
results.push(['visualViewport.scale stays 1',
  String(await page.evaluate(() => window.visualViewport.scale)), '1']);

await page.reload({ waitUntil: 'load' });
await tap('#pad-y');
results.push(['Y tap fires Jump', (await read()).move, 'Jump']);

await page.reload({ waitUntil: 'load' });
await tap('#pad-z');
results.push(['Z tap fires Grab', (await read()).move, 'Grab']);

// The tier checkbox must still toggle: it is touch-action:manipulation, not
// none, and it is excluded from the touchend blocker.
await page.reload({ waitUntil: 'load' });
const before = await page.$eval('#t3', el => el.checked);
const t3 = await centre('#t3');
await page.touchscreen.tap(t3.x, t3.y);
await page.waitForTimeout(100);
const after = await page.$eval('#t3', el => el.checked);
results.push(['T3 checkbox still toggles', String(before !== after), 'true']);

// Every element must declare a touch-action, or a double tap there zooms.
await page.reload({ waitUntil: 'load' });
const zoomable = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('body, body *')) {
    const ta = getComputedStyle(el).touchAction;
    if (ta === 'auto') bad.push(el.id || el.tagName);
  }
  return bad;
});
results.push(['no element left touch-action:auto', zoomable.join(',') || 'none', 'none']);

let fail = 0;
for (const [name, got, want] of results) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      got  "${got}"\n      want "${want}"`);
}
if (errs.length) { console.log('PAGE ERRORS:', errs); fail++; }
console.log(fail ? `\n${fail} FAILED` : `\n${results.length}/${results.length} pass`);
await browser.close();
process.exit(fail ? 1 : 0);
