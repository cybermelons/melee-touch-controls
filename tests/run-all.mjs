// Run every check. Three of the four drive a real browser against the demo
// over HTTP, so this starts the server itself rather than assuming one is up:
// a test suite that silently needs a background process is a trap.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
// Port 0 = let the OS pick a free one, so the suite runs even while a demo
// server holds the default port.
const PORT = Number(process.env.PORT || 0);

const server = http.createServer((q, s) => {
  s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  s.end(fs.readFileSync(path.join(ROOT, 'index.html')));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/`;

const SUITES = ['t_dir8.mjs', 't_layout.mjs', 't_pads.mjs', 't_chain.mjs'];
let failed = 0;
for (const suite of SUITES) {
  console.log(`\n=== ${suite} ===`);
  const code = await new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(HERE, suite)], {
      stdio: 'inherit',
      env: { ...process.env, DEMO_URL: URL },
    });
    p.on('close', resolve);
  });
  if (code !== 0) failed++;
}

server.close();
console.log(failed ? `\n${failed} suite(s) FAILED` : '\nall suites pass');
process.exit(failed ? 1 : 0);
