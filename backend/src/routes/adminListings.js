const express = require('express');
const { pool } = require('../db/pool');
const { listingSchema } = require('../validation');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

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
    published: row.published,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/admin/listings — includes unpublished, for management
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM listings ORDER BY sort_order ASC, created_at DESC');
    res.json(rows.map(rowToListing));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch listings.' });
  }
});

// POST /api/admin/listings
router.post('/', async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid listing.', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  try {
    const { rows } = await pool.query(
      `INSERT INTO listings
        (title, category, status, city, area, type, bedrooms, tier, price, year,
         image_url, image_alt, description, featured, published, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        d.title, d.category, d.status, d.city, d.area, d.type, d.bedrooms,
        d.tier || null, d.price || null, d.year || null,
        d.imageUrl, d.imageAlt, d.description || null,
        d.featured ?? false, d.published ?? true, d.sortOrder ?? 0,
      ]
    );
    res.status(201).json(rowToListing(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create listing.' });
  }
});

// PUT /api/admin/listings/:id
router.put('/:id', async (req, res) => {
  const parsed = listingSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid listing.', details: parsed.error.flatten() });
  }
  const d = parsed.data;

  const fieldMap = {
    title: 'title', category: 'category', status: 'status', city: 'city', area: 'area',
    type: 'type', bedrooms: 'bedrooms', tier: 'tier', price: 'price', year: 'year',
    imageUrl: 'image_url', imageAlt: 'image_alt', description: 'description',
    featured: 'featured', published: 'published', sortOrder: 'sort_order',
  };

  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(fieldMap)) {
    if (d[key] !== undefined) {
      params.push(d[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });

  sets.push('updated_at = now()');
  params.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE listings SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Listing not found.' });
    res.json(rowToListing(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update listing.' });
  }
});

// DELETE /api/admin/listings/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Listing not found.' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

module.exports = router;
