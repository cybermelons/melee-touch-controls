// Verify the play area really is the whole viewport and the overlay floats on
// top without stealing space or covering a pad.
import { chromium, devices } from 'playwright';
const URL = process.env.DEMO_URL || 'http://127.0.0.1:8731/';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--no-sandbox'],
});

const VIEWS = [
  ['iPhone 13 landscape', { width: 844, height: 390 }],
  ['iPhone 13 portrait',  { width: 390, height: 844 }],
  ['tablet landscape',    { width: 1180, height: 820 }],
];

const results = [];
for (const [label, viewport] of VIEWS) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });

  const m = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const r = s => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    const screen = r('#screen');
    const hud = document.getElementById('hud');
    const cs = getComputedStyle(hud);
    return {
      vw, vh, screen,
      // The play area must cover the full viewport.
      coversViewport: screen.w >= vw - 0.5 && screen.h >= vh - 0.5 && screen.x <= 0.5 && screen.y <= 0.5,
      // The HUD must have no opaque backing panel.
      hudBg: cs.backgroundColor,
      hudBorder: cs.borderBottomWidth,
      pads: Object.fromEntries(['#pad-stick','#pad-cstick','#pad-a','#pad-b','#pad-y','#pad-l','#pad-z']
        .map(s => [s, r(s)])),
      hudBox: r('#hud'), log: r('#log'), tiers: r('#tiers'),
    };
  });

  results.push([`${label}: play area covers full viewport`, String(m.coversViewport), 'true']);
  results.push([`${label}: HUD has no opaque panel`, m.hudBg, 'rgba(0, 0, 0, 0)']);
  results.push([`${label}: HUD has no bottom border`, m.hudBorder, '0px']);

  // Every pad must be fully on screen, or it cannot be pressed.
  const off = Object.entries(m.pads).filter(([, p]) =>
    !p || p.x < -1 || p.y < -1 || p.r > m.vw + 1 || p.b > m.vh + 1).map(([k]) => k);
  results.push([`${label}: all pads fully on screen`, off.join(',') || 'none', 'none']);

  // Pads must clear the viewport edge with real margin, not merely touch it.
  // The earlier "fully on screen" check passed at exactly the edge while the
  // stick ring was visibly clipped on a 390px-tall landscape phone.
  const tight = Object.entries(m.pads).filter(([, p]) =>
    p && (p.x < 4 || p.y < 4 || p.r > m.vw - 4 || p.b > m.vh - 4)).map(([k]) => k);
  results.push([`${label}: pads clear the edges by 4px`, tight.join(',') || 'none', 'none']);

  // Text overlays must not sit on top of a pad -- a readout that covers the
  // stick is worse than no readout.
  const hit = (a, b) => a && b && a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y;
  const clashes = [];
  for (const [name, box] of [['hud', m.hudBox], ['log', m.log], ['tiers', m.tiers]])
    for (const [ps, p] of Object.entries(m.pads))
      if (hit(box, p)) clashes.push(`${name}/${ps}`);
  results.push([`${label}: no text over a pad`, clashes.join(',') || 'none', 'none']);

  // Pads must not overlap each other. Enlarging them to fill the screen is
  // exactly the change that can make two touch targets share pixels, and a
  // tap in the shared area goes to whichever is on top.
  const padHit = await page.evaluate(() => {
    const pads = [...document.querySelectorAll('.pad')];
    const bad = [];
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) {
        const a = pads[i].getBoundingClientRect(), b = pads[j].getBoundingClientRect();
        // A inside the C ring is intended; skip a pad wholly inside another.
        const inside = (x, y) => x.left >= y.left - 1 && x.right <= y.right + 1 &&
                                 x.top >= y.top - 1 && x.bottom <= y.bottom + 1;
        if (inside(a, b) || inside(b, a)) continue;
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
          bad.push(`${pads[i].id}/${pads[j].id}`);
      }
    }
    return bad;
  });
  results.push([`${label}: no two pads overlap`, padHit.join(',') || 'none', 'none']);

  // A pad's own label must not land on a DIFFERENT pad. Two offset attempts
  // for the C ring label hit the A pad and then the Y pad in turn, and the
  // geometry checks above could not see either.
  const labelClash = await page.evaluate(() => {
    const pads = [...document.querySelectorAll('.pad')];
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const bad = [];
    for (const p of pads) {
      for (const lab of p.querySelectorAll('.ring-label, small')) {
        const lb = lab.getBoundingClientRect();
        if (!lb.width) continue;
        for (const other of pads) {
          if (other === p || other.contains(p) || p.contains(other)) continue;
          // A sits inside the C ring by design, so its label over that ring is
          // intended. Skip any pad whose box is wholly inside the other's.
          const pb = p.getBoundingClientRect(), ob = other.getBoundingClientRect();
          if (pb.left >= ob.left - 1 && pb.right <= ob.right + 1 &&
              pb.top >= ob.top - 1 && pb.bottom <= ob.bottom + 1) continue;
          if (hit(lb, other.getBoundingClientRect())) bad.push(`${p.id}-label/${other.id}`);
        }
      }
    }
    return [...new Set(bad)];
  });
  results.push([`${label}: no pad label over another pad`, labelClash.join(',') || 'none', 'none']);

  if (errs.length) results.push([`${label}: page errors`, errs.join('|'), '']);
  await page.screenshot({ path: `/tmp/marth-demo/shot-${label.replace(/\s+/g,'-')}.png` });
  await ctx.close();
}

let fail = 0;
for (const [n, got, want] of results) {
  const ok = got === want; if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}\n      got "${got}"${ok ? '' : ` want "${want}"`}`);
}
console.log(fail ? `\n${fail} FAILED` : `\n${results.length}/${results.length} pass`);
await browser.close();
process.exit(fail ? 1 : 0);
