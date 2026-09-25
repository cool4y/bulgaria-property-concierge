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
  'googleaca0568054ff53c5.html', // Google Search Console ownership verification - must stay reachable at the site root
]);
// Top-level directories whose entire contents may be served.
const ALLOWED_DIRS = ['css', 'js', 'images'];
// Photos written by tools/localize_images.py end in a content hash (photo-1f0594d2b5d9-1400-08ffeeca.avif), so a changed
// photo gets a new name and can be cached for a year. Everything else in these folders keeps the short TTL below.
const HASHED_IMAGE = /-[0-9a-f]{8}\.(?:avif|webp|jpg)$/;

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
  '.avif': 'image/avif',
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
    // Short TTL: long caching (e.g. 24h) means an edge cache like Cloudflare can keep serving a
    // stale css/js file for that whole window after a deploy, even though the origin already has
    // the fix (bit us once already - see CLAUDE.md). 5 minutes is enough to help repeat page loads
    // without making the next fix take most of a day to actually reach visitors.
    if (HASHED_IMAGE.test(filePath)) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    else if (ALLOWED_DIRS.includes(topDir)) headers['Cache-Control'] = 'public, max-age=300';
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Serving the public site on port ${PORT}`));
