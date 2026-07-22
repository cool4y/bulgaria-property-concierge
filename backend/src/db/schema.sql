-- Bulgaria Property Concierge — database schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('completed', 'listing')),
  status       TEXT NOT NULL,               -- e.g. "Delivered", "For Sale"
  city         TEXT NOT NULL,
  area         TEXT NOT NULL,
  type         TEXT NOT NULL,               -- "Apartment" | "House" | "Villa" | ...
  bedrooms     INTEGER NOT NULL,
  tier         TEXT,                        -- "Essential" | "Signature" | "Bespoke"
  price        TEXT,                        -- display string, listings only
  year         TEXT,
  image_url    TEXT NOT NULL,
  image_alt    TEXT NOT NULL,
  description  TEXT,
  featured     BOOLEAN NOT NULL DEFAULT false,
  published    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone_code         TEXT NOT NULL,
  phone              TEXT NOT NULL,
  apartment_type     TEXT NOT NULL,
  investment_goal    TEXT NOT NULL,
  purchase_timeline  TEXT NOT NULL,
  budget             TEXT NOT NULL,
  finish_tier        TEXT NOT NULL,
  message            TEXT,
  status             TEXT NOT NULL DEFAULT 'new', -- "new" | "contacted" | "closed"
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_published ON listings(published);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_submissions(status);
