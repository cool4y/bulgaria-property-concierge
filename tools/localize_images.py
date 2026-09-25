#!/usr/bin/env python3
"""Self-host the site's photos in modern formats (AVIF with a WebP fallback).

Run from anywhere:  python tools/localize_images.py     (needs Pillow: pip install pillow)

What it does to index.html and properties.html:

  1. <img src="https://images.unsplash.com/...">   ->  downloads an AVIF and a WebP, saves both in images/
     and rewrites the tag to  <picture><source ... type="image/avif"><img src="images/....webp"></picture>
  2. <img src="images/big-photo.jpg"> over 100 KB   ->  same treatment from the local file; the original
     moves to images-src/ (not served) so it can be re-encoded later.
  3. og:image / twitter:image on another host       ->  saved as a 1200x630 JPEG (social crawlers want a plain
     JPEG at an absolute URL, not AVIF/WebP)
  4. <link rel="preconnect"> to those hosts         ->  removed, nothing connects to them any more.
  5. <img src="data:image/jpeg;base64,...">          ->  (the hero) moved out of the HTML into images/hero-*.avif at full
     native resolution, the original JPEG kept as the fallback, plus a <link rel="preload"> in <head> when the
     tag has fetchpriority="high".

Why AVIF and not just WebP: Unsplash already serves AVIF to browsers that accept it. Hosting plain WebP would
have made the pages ~47% heavier, so a WebP-only self-host would have been slower, not faster. What
self-hosting does buy is one origin (no extra DNS+TLS connection), long-lived caching, and independence from
a third party that can move or delete a photo.

File names carry a content hash (photo-<id>-<width>-<hash>.avif) so server.js can cache them for a year;
changing a photo changes its name. Safe to re-run: once a URL is localized it is no longer in the HTML.
"""
import base64
import hashlib
import html
import io
import math
import re
import shutil
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import parse_qsl

from PIL import Image, ImageChops, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'images'
SOURCES = ROOT / 'images-src'           # originals of re-encoded local photos; not on server.js's allowlist
PAGES = ['index.html', 'properties.html']
SITE = 'https://bulgariapropertyconcierge.com'

REMOTE_HOSTS = r'images\.(?:unsplash|pexels)\.com'
LOCAL_MIN_BYTES = 100 * 1024            # local <img> photos above this get re-encoded
LOCAL_MAX_SIDE = 1400
LOCAL_AVIF_Q, LOCAL_WEBP_Q = 55, 74
# A remote image requested wider than this is a full-bleed decorative backdrop (the call-to-action block
# behind the contact form, shown at 25% opacity): no need for photo quality there.
WIDE_FROM, WIDE_WIDTH, WIDE_AVIF_Q, WIDE_WEBP_Q = 1200, 1400, 35, 40
OG_SIZE = (1200, 630)
# Inline base64 <img> (the hero): kept at native size. q65 measured ~40 dB PSNR vs the source JPEG at ~93% of its size.
INLINE_MIN_BYTES = 20 * 1024
INLINE_AVIF_Q = 65

IMG_TAG = re.compile(r'<img\b[^>]*>')
META_IMAGE = re.compile(r'(<meta\b[^>]*\bcontent=")(https://' + REMOTE_HOSTS + r'/[^"]+)(")')
PRECONNECT = re.compile(r'[ \t]*<link rel="(?:preconnect|dns-prefetch)" href="https://' + REMOTE_HOSTS + r'/?"[^>]*>[ \t]*\r?\n?')

_done = {}                              # source URL or path -> file stem, so a photo used twice is encoded once
report = []                             # (stem, avif bytes, webp bytes)
preloads = []                           # hero stems that need a <link rel="preload"> in the current page's <head>


def download(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            data = urllib.request.urlopen(req, timeout=90).read()
            if len(data) < 1000:
                raise ValueError('suspiciously small response (%d bytes)' % len(data))
            return data
        except Exception as e:
            if attempt == 2:
                raise
            print('  retrying %s (%s)' % (url[:70], e))
            time.sleep(3)


def save_pair(name, avif, webp):
    """Write name-<hash>.avif/.webp into images/ and return the stem."""
    stem = '%s-%s' % (name, hashlib.sha1(avif + webp).hexdigest()[:8])
    IMAGES.mkdir(exist_ok=True)
    (IMAGES / (stem + '.avif')).write_bytes(avif)
    (IMAGES / (stem + '.webp')).write_bytes(webp)
    report.append((stem, len(avif), len(webp)))
    return stem


def encode(im, fmt, quality):
    buf = io.BytesIO()
    im.save(buf, fmt, quality=quality)
    return buf.getvalue()


def localize_remote(url):
    """images.unsplash.com photo used in an <img>: fetch AVIF + WebP at the size the page asked for."""
    if url in _done:
        return _done[url]
    base, _, query = url.partition('?')
    params = dict(parse_qsl(html.unescape(query)))
    width, quality = int(params.get('w', 800)), int(params.get('q', 70))
    avif_q = webp_q = quality
    if width > WIDE_FROM:
        width, avif_q, webp_q = WIDE_WIDTH, WIDE_AVIF_Q, WIDE_WEBP_Q
    fetch = lambda fmt, q: download('%s?fm=%s&fit=crop&w=%d&q=%d' % (base, fmt, width, q))
    photo = re.search(r'photo-[0-9a-f]+-([0-9a-f]+)$', base)
    name = 'photo-%s-%d' % (photo.group(1) if photo else hashlib.sha1(base.encode()).hexdigest()[:12], width)
    stem = save_pair(name, fetch('avif', avif_q), fetch('webp', webp_q))
    print('  %s  %s' % (stem, url[:70]))
    _done[url] = stem
    return stem


def localize_local(path):
    """A big local photo: re-encode as AVIF + WebP, cap the size, park the original in images-src/."""
    if path in _done:
        return _done[path]
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    im.thumbnail((LOCAL_MAX_SIDE, LOCAL_MAX_SIDE), Image.LANCZOS)
    stem = save_pair(path.stem, encode(im, 'AVIF', LOCAL_AVIF_Q), encode(im, 'WEBP', LOCAL_WEBP_Q))
    print('  %s  <- %s (%d KB)' % (stem, path.name, path.stat().st_size // 1024))
    _done[path] = stem
    return stem


def localize_social(url):
    """og:image / twitter:image: a 1200x630 JPEG at an absolute URL."""
    if url in _done:
        return _done[url]
    src = url
    if 'unsplash' in url:
        src = '%s?fm=jpg&w=1600&q=85' % url.partition('?')[0]
    im = ImageOps.fit(Image.open(io.BytesIO(download(src))).convert('RGB'), OG_SIZE, Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
    data = buf.getvalue()
    stem = 'og-%s' % hashlib.sha1(data).hexdigest()[:8]
    (IMAGES / (stem + '.jpg')).write_bytes(data)
    print('  %s.jpg (%d KB)  %s' % (stem, len(data) // 1024, url[:70]))
    _done[url] = '%s/images/%s.jpg' % (SITE, stem)
    return _done[url]


def localize_inline(data_uri):
    """An inline base64 JPEG (the hero): AVIF at full native resolution, plus the ORIGINAL JPEG bytes as the
    fallback. Nothing is downscaled and the JPEG is never re-compressed, so the only lossy step is one
    AVIF encode, printed with its PSNR against the original so the quality claim is checkable."""
    key = hashlib.sha1(data_uri.encode()).hexdigest()
    if key in _done:
        return _done[key]
    jpeg = base64.b64decode(data_uri.partition(',')[2])
    im = Image.open(io.BytesIO(jpeg)).convert('RGB')
    avif = encode(im, 'AVIF', INLINE_AVIF_Q)
    back = Image.open(io.BytesIO(avif)).convert('RGB')
    mse = sum(ImageStat.Stat(ImageChops.difference(im, back).point(lambda v: v * v)).mean) / 3
    stem = 'hero-%d-%s' % (im.width, hashlib.sha1(jpeg + avif).hexdigest()[:8])
    IMAGES.mkdir(exist_ok=True)
    (IMAGES / (stem + '.avif')).write_bytes(avif)
    (IMAGES / (stem + '.jpg')).write_bytes(jpeg)
    print('  %s  inline %d KB base64 -> AVIF %d KB (+ JPEG fallback %d KB), %dx%d, PSNR %.1f dB'
          % (stem, len(data_uri) // 1024, len(avif) // 1024, len(jpeg) // 1024, im.width, im.height,
             10 * math.log10(255 * 255 / mse) if mse else 99))
    _done[key] = stem
    return stem


def picture(tag, old_src, stem, ext='webp'):
    img = tag.replace(old_src, 'images/%s.%s' % (stem, ext))
    return '<picture><source srcset="images/%s.avif" type="image/avif">%s</picture>' % (stem, img)


def rewrite_img(m):
    tag = m.group(0)
    src = re.search(r'\bsrc="([^"]+)"', tag)
    if not src:
        return tag
    src = src.group(1)
    if src.startswith('data:image/jpeg;base64,') and len(src) > INLINE_MIN_BYTES:
        stem = localize_inline(src)
        if 'fetchpriority="high"' in tag:
            preloads.append(stem)           # the above-the-fold photo: start fetching it from <head>
        return picture(tag, src, stem, 'jpg')
    if re.match(r'https://images\.unsplash\.com/', src):
        return picture(tag, src, localize_remote(src))
    local = ROOT / src
    if re.match(r'images/[^/]+\.(?:jpe?g|png)$', src) and local.is_file() and local.stat().st_size > LOCAL_MIN_BYTES:
        return picture(tag, src, localize_local(local))
    return tag


def main():
    originals = set()
    for name in PAGES:
        path = ROOT / name
        text = path.read_text(encoding='utf-8', newline='')
        print('== %s' % name)
        before = set(_done)
        text = IMG_TAG.sub(rewrite_img, text)
        text = META_IMAGE.sub(lambda m: m.group(1) + localize_social(m.group(2)) + m.group(3), text)
        text = PRECONNECT.sub('', text)
        for stem in preloads:
            nl = '\r\n' if '\r\n' in text else '\n'
            link = '  <link rel="preload" as="image" href="images/%s.avif" type="image/avif" fetchpriority="high">%s' % (stem, nl)
            text = text.replace('</head>', link + '</head>', 1)
        del preloads[:]
        path.write_text(text, encoding='utf-8', newline='')
        originals |= {k for k in _done if k not in before and isinstance(k, Path)}
    for original in originals:
        SOURCES.mkdir(exist_ok=True)
        shutil.move(str(original), str(SOURCES / original.name))

    if report:
        avif, webp = sum(r[1] for r in report), sum(r[2] for r in report)
        print('\n%d photos -> AVIF %d KB total, WebP fallback %d KB total' % (len(report), avif // 1024, webp // 1024))
    else:
        print('\nNothing to do: no remote or oversized local photos left.')


if __name__ == '__main__':
    sys.exit(main())
