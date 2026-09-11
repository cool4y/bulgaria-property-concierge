# Bulgaria Property Concierge — Project Context

Boutique full-cycle property investment & relocation service, Sofia, Bulgaria. This file exists so Claude Code can pick up this project without re-deriving context that was built up over a long claude.ai session.

**Live site:** https://cool4y.github.io/bulgaria-property-concierge/
**Repo:** github.com/cool4y/bulgaria-property-concierge (public, GitHub Pages, deploys from `main`)

---

## ⚠️ Critical rule before touching these files

`index.html` embeds several images as base64 data URIs (hero photo, a site-visit photo, 7 execution-tier photos, 5 partner logos). **Never `cat`, `grep` without `-o`/bounded patterns, or otherwise print full lines from this file to the terminal** — several of those lines are 50–100KB+ of base64 text. Always use `grep -o` with narrow patterns, `sed`/`awk` on tightly bounded line ranges after confirming (via `grep -n "base64"`) that the range doesn't include an image line, or Python scripts that read/write files without printing their content. This bit me repeatedly during the claude.ai session this file was written from — take it seriously.

---

## Structure

```
index.html              — homepage (was preview.html, renamed for GitHub Pages)
properties.html          — listings/properties browse page
backend/                — Express + PostgreSQL API (see backend/README.md)
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

- **Images**: mix of base64-embedded (hero, site-visit, 7 tier photos, 5 partner logos — all as separate `<img>` `src="data:image/...;base64,..."`) and hotlinked Unsplash URLs (most of `properties.html`, some homepage sections). Relative file paths do **not** work when previewing this HTML as a standalone file — only base64 or absolute URLs render correctly in that context. Once actually deployed via GitHub Pages, relative paths *would* work (real server), but nothing currently relies on that.

- **Icon system**: Services, Why Bulgaria, and Why Choose Us sections all share one icon language — a filled gold-tint circle badge (`bg-gold/10`) that inverts to solid gold + ivory icon on `group-hover`, plus a thin gold underline beneath each heading that grows on hover. Process section uses distinct navy numbered circles (numbered steps). Execution Tiers uses distinct gold check-badges (it's a checklist, not a feature list). Keep these visually distinct — they're different UI patterns, not inconsistency to fix.

- **Section header pattern**: every major section uses a centered `eyebrow-lg` (flanking gold hairlines + number + label, e.g. `<span>02</span><span class="h-px w-8 bg-gold/60"></span><span>Full-Cycle Service</span>`) → centered `display-sm` `<h2>` → centered supporting paragraph. Match this if adding new sections.

- **JS**: single `<script>` block near the end of `<body>` (plus two `<script type="application/ld+json">` blocks for SEO schema markup, don't confuse these when counting `<script>` tags). Contains: mobile menu toggle, header scroll-shadow, sticky mobile CTA bar, hero/CTA parallax (respects `prefers-reduced-motion`), stats count-up animation, tier photo sliders, contact form submit handler, VIP CTA pre-fill.

## Content notes

- **Contact form** (`#contact` section) — Full name / Email / Phone (with a country-code `<select>` grouped into EU / Other European / Rest of World optgroups) / 5 required dropdowns (apartment type, investment goal, purchase timeline, budget, finish tier) / optional message. Submits via `fetch()` to `API_BASE + '/api/contact'`. **`API_BASE` is currently an empty string** (`const API_BASE = ''` near the bottom of the script) — set it once the backend is actually deployed somewhere.

- **VIP Package section** (`#vip-tour`) — navy background with layered gradient + radial gold glow + corner accents (deliberately not flat navy, see CSS comments). Linked from a fixed vertical side-tab (`.vip-tab`), not from primary nav (was in nav, removed per feedback — don't re-add it there). CTA pre-fills the contact form's message field via `vipCta` click handler, doesn't otherwise touch the backend schema.

- **`properties.html` is intentionally static HTML**, not database-driven, so search engines/AI crawlers that don't execute JS can index every listing. `backend/properties-dynamic-example.html` is a working demo of what an API-driven version would look like, kept separate on purpose — converting the real page would reverse a deliberate earlier decision; only do it if explicitly asked, and flag the SEO trade-off again when it comes up.

## Backend (`/backend`)

Node.js + Express + PostgreSQL (via `pg`, not Prisma or `better-sqlite3` — both were tried and abandoned because their native/engine binaries couldn't download in the sandbox this was built in; irrelevant on a normal dev machine, but `pg`/plain SQL is what's actually built and tested).

- **Not yet deployed anywhere.** It's complete, tested code sitting in the repo. See `backend/README.md` for full setup + Railway/Render deployment steps.
- Schema: `admin_users`, `listings`, `contact_submissions` (`backend/src/db/schema.sql`).
- `npm run migrate`, `npm run seed:admin`, `npm run seed:listings` — the listings seed has the **real** 15 properties migrated from `properties.html`, not placeholder data.
- Admin panel at `/admin` (plain HTML/JS, JWT auth via `backend/public/admin/index.html`).
- Once deployed: set `index.html`'s `API_BASE`, set the backend's `ALLOWED_ORIGINS` to the GitHub Pages origin, and replace the test `JWT_SECRET`/`SEED_ADMIN_PASSWORD`/SMTP credentials with real ones — everything currently in `.env.example` is documented but unset.

## Known outstanding items (as of last session)

- [ ] Backend not deployed — contact form has nowhere to actually send data yet
- [ ] Placeholder contact info still live sitewide: phone `+359 88 234 5678` / `+359881234567`, domain `bulgariapropertyconcierge.com` (canonical URLs, OG tags, JSON-LD)
- [ ] Real photography still needed in a few spots (some Unsplash stock remains — tier-card photos and partner logos are real, uploaded by the client)
- [ ] No privacy policy / GDPR notice, despite the form collecting name/email/phone/budget from an EU-focused audience
- [ ] No real Lighthouse/PageSpeed audit has been run against the live deployment
- [ ] `properties.html`'s static-vs-dynamic tradeoff (see above) — open decision, not a bug

## Working conventions from the previous session

- User prefers being asked before large/expensive passes (a full responsive audit, a full visual redesign, etc.) rather than assuming scope — check in first if a request could balloon.
- When editing, verify Tailwind classes actually compiled and check embedded images survived byte-identical before calling something done — don't just assume a str_replace worked.
- Git pushes were done from Claude's sandbox using a short-lived, narrowly-scoped fine-grained PAT the user generated and revoked immediately after each push. You (Claude Code) have the user's own local git credentials instead, so this workaround is no longer needed — just use normal `git add/commit/push`.
