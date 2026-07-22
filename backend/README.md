# Bulgaria Property Concierge — Backend

Node.js + Express + PostgreSQL API for the contact form, property listings, and a small admin panel to manage them.

## What's included

- **Public API**: property listings (with filters), a single "featured" endpoint for the homepage teaser, and the contact form endpoint (validates input, saves to the database, sends an email notification if SMTP is configured).
- **Admin API + panel**: JWT-protected login, full CRUD for listings, and a page to view/triage contact submissions. The panel lives at `/admin` once the server is running — plain HTML/JS, no build step, no framework.
- **Database**: PostgreSQL. Schema in `src/db/schema.sql`, applied via `npm run migrate`.
- **Seed data**: the 15 properties already on the live site, and a script to create your first admin login.

## 1. Local setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — a Postgres connection string (see hosting options below for where to get one)
- `JWT_SECRET` — generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — your admin login (only used once, by the seed script below)
- SMTP settings — optional; without them, contact submissions still save to the database, you just won't get an email alert

Then:

```bash
npm run migrate         # creates the tables
npm run seed:admin      # creates your admin login
npm run seed:listings   # loads the 15 existing properties
npm run dev              # starts the server on http://localhost:3000
```

Visit `http://localhost:3000/admin` and log in with the email/password you set in `.env`.

## 2. Deploying

Any host that runs Node.js and gives you a Postgres database works. Two easy options:

### Railway
1. Create a new project, add a **PostgreSQL** database (Railway provisions one and gives you a `DATABASE_URL` automatically — copy it).
2. Add a service from this repo/folder.
3. Set the environment variables from `.env.example` in the service's Variables tab (paste in the `DATABASE_URL` Railway gave you, plus `DB_SSL=true`, `JWT_SECRET`, SMTP settings, etc.)
4. Deploy. Railway runs `npm start` by default.
5. Run the migration and seed scripts once, either via Railway's shell/CLI (`railway run npm run migrate`, etc.) or by temporarily adding them to a one-off deploy command.

### Render
1. Create a **PostgreSQL** instance (free tier available) — copy the "External Database URL" it gives you.
2. Create a **Web Service** pointing at this folder. Build command: `npm install`. Start command: `npm start`.
3. Set the same environment variables as above (`DB_SSL=true` for Render's Postgres too).
4. After the first deploy, run `npm run migrate`, `npm run seed:admin`, `npm run seed:listings` via Render's shell.

## 3. Connecting the frontend

Once deployed, you'll have a live URL like `https://your-service.up.railway.app`. Two places need it:

1. **`index.html`** — find `const API_BASE = ''` near the bottom of the file and set it to your backend URL:
   ```js
   const API_BASE = 'https://your-service.up.railway.app';
   ```
2. **Backend's `ALLOWED_ORIGINS`** env var — set it to your GitHub Pages URL so the browser's CORS check allows the request:
   ```
   ALLOWED_ORIGINS=https://cool4y.github.io
   ```

Re-deploy/re-upload `index.html` after step 1, and restart the backend after changing env vars.

## 4. Admin panel

`https://your-backend-url/admin` — log in with the email/password from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. From there you can add, edit, publish/unpublish, or delete listings, and view/triage contact form submissions.

To change the admin password later, update `SEED_ADMIN_PASSWORD` in `.env` and re-run `npm run seed:admin` — it updates the existing account rather than creating a duplicate.

## 5. A note on `properties.html`

The current `properties.html` on the live site is static HTML by design — it was built that way so search engines and AI crawlers (which don't execute JavaScript) can index every listing. This backend's listings API is fully separate from that page for now; nothing about `properties.html` changes just by deploying this backend. See `properties-dynamic-example.html` for a working example of what a database-driven version would look like, if you want to make that trade-off later.

## Project structure

```
backend/
├── src/
│   ├── app.js              # Express app + route mounting
│   ├── server.js           # entry point
│   ├── email.js            # SMTP notification for new contact submissions
│   ├── validation.js       # zod schemas
│   ├── db/
│   │   ├── schema.sql
│   │   ├── pool.js
│   │   ├── migrate.js
│   │   ├── seedAdmin.js
│   │   └── seedListings.js
│   ├── middleware/auth.js  # JWT verification
│   └── routes/
│       ├── listings.js       # public
│       ├── contact.js        # public
│       ├── adminAuth.js
│       ├── adminListings.js
│       └── adminContacts.js
├── public/admin/index.html # admin panel (static, no build step)
├── .env.example
└── package.json
```
