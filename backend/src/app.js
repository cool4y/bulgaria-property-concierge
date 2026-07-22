require('dotenv').config();
const express = require('express');
const cors = require('cors');

const listingsRoutes = require('./routes/listings');
const contactRoutes = require('./routes/contact');
const adminAuthRoutes = require('./routes/adminAuth');
const adminListingsRoutes = require('./routes/adminListings');
const adminContactsRoutes = require('./routes/adminContacts');

const app = express();

app.use(express.json({ limit: '1mb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true, // permissive if not configured (dev convenience)
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/listings', listingsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin/listings', adminListingsRoutes);
app.use('/api/admin/contacts', adminContactsRoutes);

app.use(express.static('public')); // serves /admin panel

// Central error handler — last resort, keeps stack traces out of responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

module.exports = app;
