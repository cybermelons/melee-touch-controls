import http from 'http';
import fs from 'fs';
const FILE = '/tmp/marth-demo/marth-controls.html';
http.createServer((q, s) => {
  s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  s.end(fs.readFileSync(FILE));
}).listen(8731, '0.0.0.0', () => console.log('up on 8731'));
