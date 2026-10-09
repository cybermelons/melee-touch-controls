function dir8(dx, dy) {
  if (Math.hypot(dx, dy) < 0.35) return null;
  if (dy < -0.5 && Math.abs(dx) < 0.8) return 'up';
  if (dy > 0.5 && Math.abs(dx) < 0.8) return 'down';
  return 'side';
}
const cases = [
  [0, 0, null], [0.1, 0.1, null], [0, -1, 'up'], [0, 1, 'down'],
  [1, 0, 'side'], [-1, 0, 'side'], [0.9, -0.9, 'side'],
];
let fail = 0;
for (const [dx, dy, want] of cases) {
  const got = dir8(dx, dy);
  if (got !== want) { console.error(`FAIL dir8(${dx},${dy}) = ${got}, want ${want}`); fail++; }
}
console.log(fail ? `${fail} FAILED` : `dir8: ${cases.length}/${cases.length} pass`);
process.exit(fail ? 1 : 0);
