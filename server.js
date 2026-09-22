// Static file server for the public site only. Deployed as its own Railway service, separate
// from backend/ (the API service) — this process never touches or exposes that source code.
//
// Deliberately NOT a generic "serve the whole folder" server: only an explicit allowlist of
// top-level files and directories is servable. Everything else (backend/, tools/, .git,
// CLAUDE.md, package.json, this file, ...) 404s, even though it sits in the same repo checkout.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

// Exact top-level files that may be served from the repo root.
const ALLOWED_FILES = new Set([
  'index.html',
  'properties.html',
  'llms.txt',
  'robots.txt',
  'sitemap.xml',
]);
// Top-level directories whose entire contents may be served.
const ALLOWED_DIRS = ['css', 'js', 'images'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function resolveServablePath(urlPath) {
  // Decode + strip query string, collapse any ".." traversal.
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const clean = path.posix.normalize(decoded).replace(/^\/+/, '');

  if (clean === '' || clean === 'index.html') return path.join(ROOT, 'index.html');
  if (ALLOWED_FILES.has(clean)) return path.join(ROOT, clean);

  const topDir = clean.split('/')[0];
  if (ALLOWED_DIRS.includes(topDir) && !clean.includes('..')) {
    return path.join(ROOT, clean);
  }
  return null;
}

const server = http.createServer((req, res) => {
  const filePath = resolveServablePath(req.url);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    const topDir = path.relative(ROOT, filePath).split(path.sep)[0];
    if (ALLOWED_DIRS.includes(topDir)) headers['Cache-Control'] = 'public, max-age=86400';
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Serving the public site on port ${PORT}`));
