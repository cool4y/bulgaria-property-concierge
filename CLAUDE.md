# Bulgaria Property Concierge — Project Context

Boutique full-cycle property investment & relocation service, Sofia, Bulgaria. This file exists so Claude Code can pick up this project without re-deriving context that was built up over a long claude.ai session.

**Live site:** https://bulgariapropertyconcierge.com/ (Railway; the real, canonical domain — see Deployment below)
**Also live (mirror):** https://cool4y.github.io/bulgaria-property-concierge/ — same repo, same `main` branch, deploys automatically alongside Railway. **It serves the entire repo**, including `backend/` source, `CLAUDE.md`, etc. (confirmed: `backend/package.json` is publicly fetchable there). The Railway frontend (`server.js`) does not have this problem — it allowlists only the public files. Do not rely on the GitHub Pages copy as "the" site; it is a side effect of GitHub Pages serving the whole repo root, kept as a free backup mirror. GitHub Pages also stops working outright if the repo is ever made private (GitHub Free has no Pages-from-private-repo) — it needs re-enabling by hand in repo Settings -> Pages afterward, going private/public does not restore it automatically.
**Repo:** github.com/cool4y/bulgaria-property-concierge (public — keep it public; see above — deploys from `main` to GitHub Pages and to Railway)

---

## ⚠️ Critical rule before touching these files

`index.html` embeds several images as base64 data URIs (hero photo, a site-visit photo, 7 execution-tier photos, 5 partner logos). **Never `cat`, `grep` without `-o`/bounded patterns, or otherwise print full lines from this file to the terminal** — several of those lines are 50–100KB+ of base64 text. Always use `grep -o` with narrow patterns, `sed`/`awk` on tightly bounded line ranges after confirming (via `grep -n "base64"`) that the range doesn't include an image line, or Python scripts that read/write files without printing their content. This bit me repeatedly during the claude.ai session this file was written from — take it seriously.

---

## Structure

```
index.html              — homepage (was preview.html, renamed for GitHub Pages)
properties.html          — listings/properties browse page
blog.html               — Journal index: cards for the articles (same shell as properties.html, i18n via the dictionary)
journal/                — the articles, one standalone page per language (slug.html = BG, slug-en.html = EN)
backend/                — Express + PostgreSQL API (see backend/README.md)
js/i18n.js, js/i18n-bg.js — EN/BG language switcher and the Bulgarian dictionary (see Languages below)
css/article.css        — brings the standalone articles to site standard (header, footer, no dark theme)
css/brand.css          — brand layer from the brand guidebook, loaded after the page styles (see Brand below)
llms.txt, robots.txt, sitemap.xml — AI/search discoverability files at the site root (see SEO / GEO below)
tools/i18n_tool.py      — tags new text for translation and checks the dictionary
tools/localize_images.py — self-hosts photos as AVIF + WebP and rewrites the HTML (see Images below)
images/                 — served photos and logos; photos are content-hashed AVIF/WebP pairs; the hero is hero-*.avif + .jpg fallback
images-src/             — originals of re-encoded photos (NOT served: not on server.js's allowlist)
```

## Frontend architecture

- **Tailwind CSS is precompiled**, not CDN. Each HTML file has two `<style>` tags:
  1. First = Tailwind-generated utility CSS (huge, minified, one line). Any **new** Tailwind class used in the HTML won't render until this is regenerated.
  2. Second = hand-written custom CSS (`.eyebrow`, `.eyebrow-lg`, `.display-sm`, `.ease-lux`, `.navlink`, `.header-scrolled`, `.mobile-cta-bar`, `.mobile-menu`, `.fab`, `.vip-tab`, `.vip-glow`, `.vip-corner`, `.reveal`/`.delay-N` scroll-in animation, `[hidden]{display:none!important}` override, etc.)

- **To add a new Tailwind class**, set up the build pipeline (if not already present):
  ```bash
  mkdir -p tw-build/content
  cd tw-build && npm install -D tailwindcss@3
  ```
  `tailwind.config.js` needs: a custom `xs: '480px'` breakpoint (added mid-project, sits between base and `sm`), brand colors (`ivory #FAF8F4`, `cream #F3EFE7`, `beige #E8E1D3`, `gold` #B8935A/light #D9BE8A/dark #8F6F3E, `navy` #0F1B2E/light #1B2A44), a `maxWidth.container: '80rem'` extension, and a safelist for 3 arbitrary shadow values whose embedded commas break Tailwind's scanner:
  ```
  'shadow-[0_10px_30px_-10px_rgba(15,27,46,0.35)]'
  'shadow-[0_25px_60px_-25px_rgba(184,147,90,0.45)]'
  'shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]'
  ```
  Build process: strip base64 to a placeholder before scanning (regex: `data:image/(jpeg|png|svg\+xml);base64,[A-Za-z0-9+/=]+` → replace payload with `X`) or the compiler chokes/slows drastically. Then `npx tailwindcss -i input.css -o output.css --minify` and splice `output.css` into the **first** `<style>` block only.

- **Verifying a class actually compiled**: don't trust naive `grep`/`in` checks — Tailwind CSS-escapes special characters in class selectors (e.g. `text-[.72rem]` → `.text-\[\.72rem\]`, commas inside arbitrary values → `\2c`). Parse the compiled CSS properly or check for the underlying property value (e.g. search for `rgba(15,27,46,.35)` rather than the escaped class name) before concluding a class is "missing."

- **Images**: no photo is hotlinked any more (Unsplash/Pexels are gone from the HTML, og:image included). Every photo is a self-hosted
  `<picture><source srcset="images/X.avif" type="image/avif"><img src="images/X.webp" ...></picture>` (`picture{display:contents}` in
  `brand.css` keeps layout identical to a bare `<img>`). File names end in a content hash, so `server.js` caches them for a year (`immutable`);
  a changed photo gets a new name. **To add or swap a photo**: put a `https://images.unsplash.com/photo-...?auto=format&fit=crop&w=800&q=70` URL,
  or a local `images/name.jpg` over 100 KB, in an `<img src>`, then run `python tools/localize_images.py` (needs `pip install pillow`); it
  downloads/encodes, rewrites the tag, and moves local originals to `images-src/`. Small local files (logos, the tier photos) are left alone.
  **Why AVIF, not just WebP**: Unsplash already served AVIF to Chrome, so plain WebP would have been ~47% *heavier* (measured: 2065 KB vs
  3039 KB for the same 15 photos). Full-bleed decorative backdrops (requested wider than 1200px, e.g. the 25%-opacity call-to-action image)
  are re-encoded at 1400px/q35: 1074 KB -> 197 KB. og:image / twitter:image are 1200x630 JPEGs at absolute URLs (crawlers want JPEG).
  **The hero photo** used to be inline base64 in `index.html` (~270 KB of the file); the tool now moves any inline `data:image/jpeg` <img> out to
  `images/hero-<w>-<hash>.avif` (native 1145x1280, q65, ~40 dB PSNR, visually identical) with the *original* JPEG bytes as the fallback
  (never re-compressed), and adds `<link rel="preload" as="image" type="image/avif" fetchpriority="high">` in `<head>`. To change the hero, put a
  new base64 JPEG (or just an `images/name.jpg`) back in that `<img>` and re-run the tool. Only Unsplash (free) photos, never Unsplash+ (`plus.unsplash.com`, paid), belong here.

- **Icon system**: Services, Why Bulgaria, and Why Choose Us sections all share one icon language — a filled gold-tint circle badge (`bg-gold/10`) that inverts to solid gold + ivory icon on `group-hover`, plus a thin gold underline beneath each heading that grows on hover. Process section uses distinct navy numbered circles (numbered steps). Execution Tiers uses distinct gold check-badges (it's a checklist, not a feature list). Keep these visually distinct — they're different UI patterns, not inconsistency to fix. All headings in this family (`h3`, e.g. "Strategy Call", "Residential Property") share the same weight, `font-medium` — keep new ones consistent.

- **Section header pattern**: every major section uses a centered `eyebrow-lg` (flanking gold hairlines + number + label, e.g. `<span>02</span><span class="h-px w-8 bg-gold/60"></span><span>Full-Cycle Service</span>`) → centered `display-sm` `<h2>` → centered supporting paragraph. Match this if adding new sections.

- **JS**: single `<script>` block near the end of `<body>` (plus two `<script type="application/ld+json">` blocks for SEO schema markup, don't confuse these when counting `<script>` tags). Contains: mobile menu toggle, header scroll-shadow, sticky mobile CTA bar, hero/CTA parallax (respects `prefers-reduced-motion`), stats count-up animation, tier photo sliders, contact form submit handler, VIP CTA pre-fill.

## Languages (EN / BG)

Both pages are bilingual. The English text in the HTML is the source of truth; Bulgarian is applied in the browser, instantly, with no reload.

- **Switcher**: an `EN | BG` segmented control in a hairline gold frame (active language filled navy, no flags), in the header next to the button. `js/i18n.js` remembers the choice (localStorage), honours `?lang=bg` / `?lang=en`, and **defaults to Bulgarian for every visitor**, regardless of browser language (`detect()` in `js/i18n.js` and the inline snippet in each `<head>` both just fall through to `'bg'` — deliberate, not browser-language detection). A small inline snippet in each `<head>` hides the page for Bulgarian visitors until the text is swapped, so English never flashes.
- **Dictionary**: `js/i18n-bg.js`, `"key": "Bulgarian"`, each entry preceded by a `// EN:` comment with the English original. Elements carry `data-i18n="key"` (`data-i18n-html` when the text contains inline markup; `data-i18n-alt` / `-title` / `-placeholder` / `-aria-label` / `-content` for attributes; `data-no-i18n` to opt out, e.g. the logo).
- **After changing or adding English text** in a page: `python tools/i18n_tool.py tag` (tags the new text and adds empty dictionary entries), translate the empty entries, then `python tools/i18n_tool.py check` (must report 0 untagged / 0 untranslated). `python tools/i18n_tool.py import file.json` bulk-fills translations. The tool never re-serialises the HTML, it only inserts attributes.
- **Text produced by JavaScript** (form messages, the "N properties" counter, the VIP prefill) goes through `tr('key', 'English')`, declared at the top of each page's inline script. The tool finds these calls too.
- **`<select>` options keep English `value`s** (the tool adds them): the contact form posts them to the backend and the properties filters compare against them. Never let them become Bulgarian.
- **Hero headline** (`data-i18n-words`) is rebuilt word by word from the translated sentence, so the fade-in animation still works.
- **Typography**: Fraunces has no Cyrillic glyphs, so Lora follows it in the `.font-serif` stack and supplies the Bulgarian headings (the page declares `lang="bg"`, which switches on the proper Bulgarian letterforms). `tidy()` in `js/i18n.js` joins one- and two-letter words to the next word so they never dangle at a line end. Bulgarian runs ~20% longer than English: check header, buttons and headings at 390px and 1280px after adding text.
- **Header**: full navigation from 1280px up, the menu button below that; nothing in the header may wrap. `properties.html` has its own copy of the menu.
- **Known trade-off**: Bulgarian is client-side only, so search engines index the English text. If Bulgarian search traffic matters, add real `/bg/` pages with `hreflang` (the dictionary can generate them).
- The pages and images are also previewed by opening them from a folder, so the files need `css/`, `js/` and `images/` next to `index.html`.

## Brand (guidebook v1.0)

The site follows `bpc-brand-guidebook.pdf` (the guidebook and the logo kit, SVG/PNG, live outside the repo in `Desktop\BPC`). `css/brand.css` is the brand layer: it loads after each page's inline styles, so it wins, and it is where new brand rules go (new Tailwind classes would not render, see above).

- **Palette**: Navy `#0F1B2E`, Navy Light `#1B2A44`, Gold `#B8935A`, Gold Dark `#8F6F3E`, Gold Light `#D9BE8A`, Ivory `#FAF8F4`, Cream `#F3EFE7`, Beige `#E8E1D3`; status colours only for states (success `#2F7A4F`, error `#A8402F`). No other hex values. There is no neutral grey: secondary text is a tint of Navy (Ivory on navy) and lines are Beige, which `brand.css` enforces by remapping the compiled `stone-*` classes.
- **60 / 30 / 10**: Ivory dominates, Navy structures, Gold is the accent (about 10% of any screen).
- **Type**: Fraunces for Latin display, Lora for Cyrillic display (Fraunces has no Cyrillic), Inter for text and UI. Eyebrows and labels are Inter caps with `.14em` tracking; the gold hairline is `<span class="hairline">` (44px).
- **Logo**: arch over two columns (`.brand` + inline `svg.brand-mark` + `.brand-word` with `.brand-name` / `.brand-sub`, add `.brand--reversed` on navy). Only on ivory, navy or white; never below 20px; the lockup's font and tracking are fixed, so the wordmark is `data-no-i18n`. Favicon and touch icon: `images/favicon.svg`, `images/apple-touch-icon.png` (from the kit).
- **Header**: a solid Ivory bar with a Beige hairline (`#site-header` in `brand.css`), on both pages, at the top and when scrolled, so the navigation stays readable over the hero photo. It only tightens its padding on scroll; no transparency or blur.
- **Hero eyebrow / stat frame**: the label and the "10 Years Experience" box sit directly on the hero photo, where the palette's usual Beige border/backing is too low-contrast. `.hero-eyebrow` gives the label an Ivory backing; `.stat-frame` gives the stat box a stronger Navy-tint border. Both are scoped overrides in `brand.css`, not a change to the Beige rule used everywhere else (cards, dividers on solid backgrounds keep Beige).
- **Chat buttons** (Viber / WhatsApp): kept the apps' own purple `#7360F2` and green `#25D366` (tried a navy-outline brand treatment; the user asked for the original colours back — don't re-apply the outline).
- Not covered yet: the admin panel under `backend/public/admin` is not restyled.

## Blog (Journal)

- **Pages**: `blog.html` (index, 3 cards, translated through the normal dictionary) and `journal/<slug>.html` + `journal/<slug>-en.html`. Articles are standalone pages with their own reading styles inline (from the content team's exports), plus `../css/brand.css` (logo, language switch) and `../css/article.css` (site header/footer, square buttons, no dark theme, no eyebrow hairline). They have no i18n system: BG and EN are two files, and the BG|EN switch in the article header links to the other file. `server.js` serves `journal/` and `blog.html`.
- **Cards** (blog.html and the preview on the homepage `#journal`) carry `data-href-bg` / `data-href-en`; `js/i18n.js` swaps the `href` when the language changes, so BG visitors open the BG article and EN visitors the EN one. `tools/i18n_tool.py` now covers `blog.html` too.
- **Adding an article**: copy an existing pair in `journal/` (fix title, description, canonical, og tags, hreflang, JSON-LD, `related` links), add a cover (`blog-<name>-<hash>.avif/.webp` 1200x800 + `og-blog-<name>-<hash>.jpg` 1200x630 in `images/`, Unsplash free photos only), add a card in both `blog.html` and the homepage (keep 3 there, newest first), run `python tools/i18n_tool.py tag`, translate the new keys, add the URLs to `sitemap.xml` (with hreflang pairs) and `llms.txt`.
- **Links in the articles are relative** (`../index.html#contact`, `../blog.html?lang=bg`, sibling file names for related articles), never `/...` or full URLs: a root link breaks when the file is opened from disk (`file:///`) or on the GitHub Pages mirror. Only canonical, hreflang and og tags are absolute.
- **Sizes** follow the guidebook ladder but are set for reading: article body 18.5px, labels never below ~12px; headings (H1/H2/H3, card titles) deliberately keep their original, smaller sizes (the client found larger titles too big) (`css/article.css`, journal block at the end of `css/brand.css`).
- **Keywords / SEO**: the articles, the blog description and the homepage FAQ deliberately carry the premium terms (BG: луксозни имоти, премиум сегмент, висок клас, пентхаус; EN: luxury property, premium segment, high-end, penthouse), each article has a section about that segment plus two extra FAQ entries (visible and in the FAQPage JSON-LD). Keep new claims qualitative (no invented figures). **No gold hairline anywhere** (tried beside the label, then above it on the blog: the client removed it both times; do not reintroduce without asking).
- **Cover photos** are graded gently on purpose (saturation lowered, the office shot warmed) to follow the guidebook's photography rules; regenerate through the same recipe if a photo is replaced.
- **One column standard**: in an article, the title block, cover photo, body text, tables, call-to-action and related articles all share the same edges (760px + gutter, `.wrap` and `.wrap-wide` are both 760px in `css/article.css`). Never put a wider element in `.wrap-wide`; if something must be wider, change the standard for everything. Cover: 16:9.
- Cover photos are free Unsplash photos (Sofia at sunset from above, Sofia street at sunset supplied by the client, two people signing a document), chosen for the guidebook's photography rules (real architecture, warm light).

## SEO / GEO (AI discoverability)

Three files at the site root, served as-is by GitHub Pages (no build step touches them):

- **`robots.txt`**: explicitly `Allow: /` for every crawler, including the AI ones (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, meta-externalagent...) — the opposite of a publisher blocking training bots, because this business wants AI assistants to recommend it. Points to `sitemap.xml`.
- **`sitemap.xml`**: one `<url>` per indexable page (currently `index.html`, `properties.html`) with `hreflang` alternates for `en`/`bg`. Bump `<lastmod>` when a page's content meaningfully changes — add a `<url>` block for every future Journal/blog article (template is commented in the file).
- **`llms.txt`**: an emerging (unproven) convention some AI crawlers read for a plain-language summary — low-cost, not a substitute for the schema/robots/sitemap work above.

The FAQ section (`#faq` in `index.html`) doubles as a `FAQPage` JSON-LD block in `<head>` (~line 276) — **keep both in sync**: every visible `<details class="faq">` question needs a matching `Question`/`acceptedAnswer` entry (the schema wording can be slightly more formal/complete than the page copy, e.g. naming "Bulgaria Property Concierge" instead of "we"). The canonical domain used throughout (`www.bulgariapropertyconcierge.com`, in `<link rel="canonical">`, OG tags, JSON-LD and now these three files) is still a placeholder — see Known outstanding items.

## Content notes

- **Contact form** (`#contact` section) — Full name / Email / Phone (with a country-code `<select>` grouped into EU / Other European / Rest of World optgroups) / 5 required dropdowns (apartment type, investment goal, purchase timeline, budget, finish tier) / optional message. Submits via `fetch()` to `API_BASE + '/api/contact'`. **`API_BASE` is currently an empty string** (`const API_BASE = ''` near the bottom of the script) — set it once the backend is actually deployed somewhere.

- **VIP Package section** (`#vip-tour`) — navy background with layered gradient + radial gold glow + corner accents (deliberately not flat navy, see CSS comments). Linked from a fixed vertical side-tab (`.vip-tab`), not from primary nav (was in nav, removed per feedback — don't re-add it there). CTA pre-fills the contact form's message field via `vipCta` click handler, doesn't otherwise touch the backend schema.

- **`properties.html` is intentionally static HTML**, not database-driven, so search engines/AI crawlers that don't execute JS can index every listing. `backend/properties-dynamic-example.html` is a working demo of what an API-driven version would look like, kept separate on purpose — converting the real page would reverse a deliberate earlier decision; only do it if explicitly asked, and flag the SEO trade-off again when it comes up.

## Backend (`/backend`)

Node.js + Express + PostgreSQL (via `pg`, not Prisma or `better-sqlite3` — both were tried and abandoned because their native/engine binaries couldn't download in the sandbox this was built in; irrelevant on a normal dev machine, but `pg`/plain SQL is what's actually built and tested).

- **Deployed and live on Railway** (see Deployment below). `index.html`'s `API_BASE` already points at `https://bulgaria-property-concierge-production.up.railway.app`; do not set it back to `''`. Verified end-to-end (a real POST to `/api/contact` returned `{"id":2,...}`, i.e. row 2 — there was already a real submission before that test).
- Schema: `admin_users`, `listings`, `contact_submissions` (`backend/src/db/schema.sql`).
- `npm run migrate`, `npm run seed:admin`, `npm run seed:listings` — the listings seed has the **real** 15 properties migrated from `properties.html`, not placeholder data.
- Admin panel at `/admin` (plain HTML/JS, JWT auth via `backend/public/admin/index.html`).
- `emailSent: false` on a real submission — SMTP is still the placeholder from `.env.example`, notification emails do not actually go out yet.
- Real `JWT_SECRET`/`SEED_ADMIN_PASSWORD`/SMTP credentials: check with the user whether Railway's variables still hold the test values from `.env.example` before treating this as done.

## Deployment (Railway)

`railway status` from anywhere in the repo (CLI is authenticated as epavlov.bg@gmail.com) links to project **pure-commitment**. Three resources, one `production` environment:

- **`bulgaria-property-concierge`** — the API (`/backend`, root directory set to `backend/` in Railway's service settings). Free domain `bulgaria-property-concierge-production.up.railway.app` (this is what `API_BASE` uses — stable, keep using it). No custom domain attached (deliberately — the API does not need one, and Trial/Hobby plans cap custom domains **per service**, so spending the slot here would block the frontend below).
- **`web`** — the public site. Root directory is the repo root; deploys via `package.json` -> `node server.js`. **`server.js` is a hand-rolled allowlist server**, not a generic static-file server: it only serves `index.html`, `properties.html`, `llms.txt`, `robots.txt`, `sitemap.xml`, and everything under `css/`, `js/`, `images/`. Everything else in the repo (`backend/`, `tools/`, `CLAUDE.md`, `package.json`, `server.js` itself, `.git`) 404s. If you add a new top-level public file or directory, add it to the `ALLOWED_FILES`/`ALLOWED_DIRS` lists in `server.js` or it will not be servable. Custom domain: `bulgariapropertyconcierge.com` (apex; no `www.` — that subdomain has no DNS record and is not set up).
- **`Postgres`** — the database, used by the backend service. `railway variables --service Postgres` has the connection details; `DATABASE_URL` there is `postgres.railway.internal`, only reachable from inside Railway's network (not from a local machine, and not via `railway run` either — that does not tunnel it). Querying the DB from outside needs `railway connect` with `psql` installed locally, or a public proxy domain added in Railway's Postgres settings.

**Both Railway services and GitHub Pages deploy from the same `main` branch push** — one `git push` updates all three. There is no separate deploy step. If an auto-deploy seems not to have landed, `railway redeploy --service web --from-source --yes` (or `--service bulgaria-property-concierge`) forces a fresh pull and rebuild from the latest commit — useful for confirming what is *actually* live, since Railway can report a service "Online" while it is still serving an older deployment's content for a few seconds after a push.

**Cache gotcha — check this before trusting any "is the fix live" test**: `server.js` sets `Cache-Control: public, max-age=300` on everything under `css/`, `js/`, `images/` except content-hashed photos (`...-<8 hex>.avif/.webp/.jpg`: one year, immutable) (5 minutes — it used to be 24 hours, which once left a fixed bug looking live on the origin but stale for anyone hitting Cloudflare's edge cache for the custom domain; `curl` the direct Railway service domain, e.g. `https://web-production-ce40af.up.railway.app/js/i18n-bg.js`, to bypass Cloudflare and see the real origin content, and check the `cf-cache-status` response header — `HIT` means you are looking at a possibly-stale cached copy, not the origin). If something is confirmed fixed at the origin but still wrong on `bulgariapropertyconcierge.com`, the fix is real — it is a Cloudflare edge cache still holding the old file until its TTL expires; ask the user to purge it (Cloudflare dashboard -> Caching -> Configuration -> Purge Everything, or purge just the affected URLs) rather than re-debugging the deploy.

**DNS**: managed by the user in Cloudflare. The apex `bulgariapropertyconcierge.com` is a CNAME to a Railway-provided target (get the current one with `railway domain status bulgariapropertyconcierge.com --service web`); Railway resolves it internally by which service currently claims that domain name, so the exact CNAME target value matters less than which service owns the domain in Railway. `ALLOWED_ORIGINS` on the backend includes `https://bulgariapropertyconcierge.com`, the Railway-generated `web` domain, and `https://cool4y.github.io` (the GitHub Pages mirror) — keep all three if you touch it.

**Changing DNS, custom domains, or certificates requires the user's explicit permission each time** — Claude Code's auto-mode classifier blocks these `railway domain ...` actions by default, and it does so per-action (an earlier "yes" for one domain command did not cover a later `delete`).

## Known outstanding items (as of last session)

- [ ] Placeholder contact info still live sitewide: phone `+359 88 234 5678` / `+359881234567` — the domain itself is now real and fixed (see Deployment), but the phone numbers are not
- [ ] SMTP not configured for real — contact form submissions save to the DB fine but no notification email goes out (`emailSent: false`)
- [ ] GitHub Pages mirror exposes the whole repo (`backend/` source, `CLAUDE.md`, ...) — not fixed there, only avoided on the Railway `web` service. Options if this needs closing: stop deploying `backend/` to Pages (e.g. a `.github/workflows` step that publishes only the public subset), or drop the Pages mirror once the Railway domain has been live long enough to trust
- [ ] `www.bulgariapropertyconcierge.com` has no DNS record — only the apex works. Add a CNAME if `www` traffic needs to resolve
- [ ] Real photography still needed in a few spots (some Unsplash stock remains — tier-card photos and partner logos are real, uploaded by the client)
- [ ] No privacy policy / GDPR notice, despite the form collecting name/email/phone/budget from an EU-focused audience
- [ ] No real Lighthouse/PageSpeed audit has been run against the live deployment
- [ ] `properties.html`'s static-vs-dynamic tradeoff (see above) — open decision, not a bug

## Working conventions from the previous session

- User prefers being asked before large/expensive passes (a full responsive audit, a full visual redesign, etc.) rather than assuming scope — check in first if a request could balloon.
- When editing, verify Tailwind classes actually compiled and check embedded images survived byte-identical before calling something done — don't just assume a str_replace worked.
- Git pushes were done from Claude's sandbox using a short-lived, narrowly-scoped fine-grained PAT the user generated and revoked immediately after each push. You (Claude Code) have the user's own local git credentials instead, so this workaround is no longer needed — just use normal `git add/commit/push`.
