// Development server for src/www: serves dev.html at / and reloads open pages
// when a file under src/www changes (Server-Sent Events on /__reload). Uses
// only Node's standard library. `npm run dev` restarts it when it changes.

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, 'www');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// Open pages waiting to be told to reload
const listeners = new Set();

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch (error) {
    res.writeHead(400).end();
    return;
  }
  if (pathname === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return;
  }
  const file = path.join(ROOT, pathname === '/' ? 'dev.html' : pathname);
  // Never serve anything outside src/www
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

// Editors often save a file in several writes; send one reload per burst
let pending;
fs.watch(ROOT, { recursive: true }, () => {
  clearTimeout(pending);
  pending = setTimeout(() => {
    for (const res of listeners) res.write('data: reload\n\n');
  }, 100);
});

server.listen(PORT, HOST, () => {
  console.log(`Serving src/www at http://localhost:${PORT}/`);
});
