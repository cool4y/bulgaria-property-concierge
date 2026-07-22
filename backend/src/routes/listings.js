const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

function rowToListing(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    city: row.city,
    area: row.area,
    type: row.type,
    bedrooms: row.bedrooms,
    tier: row.tier,
    price: row.price,
    year: row.year,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    description: row.description,
    featured: row.featured,
  };
}

// GET /api/listings?category=completed|listing&city=&type=&beds=
router.get('/', async (req, res) => {
  const { category, city, type, beds } = req.query;
  const conditions = ['published = true'];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (city) {
    params.push(city);
    conditions.push(`city = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }
  if (beds) {
    params.push(Number(beds));
    conditions.push(`bedrooms = $${params.length}`);
  }

  const sql = `SELECT * FROM listings WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, created_at DESC`;
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(rowToListing));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch listings.' });
  }
});

// GET /api/listings/featured — homepage teaser (max 3, per site design)
router.get('/featured', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM listings WHERE published = true AND featured = true
       ORDER BY sort_order ASC LIMIT 3`
    );
    res.json(rows.map(rowToListing));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch featured listings.' });
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM listings WHERE id = $1 AND published = true',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Listing not found.' });
    res.json(rowToListing(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch listing.' });
  }
});

module.exports = router;
