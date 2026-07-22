const express = require('express');
const { pool } = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/contacts?status=new|contacted|closed
router.get('/', async (req, res) => {
  const { status } = req.query;
  try {
    const { rows } = status
      ? await pool.query('SELECT * FROM contact_submissions WHERE status = $1 ORDER BY created_at DESC', [status])
      : await pool.query('SELECT * FROM contact_submissions ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

// PATCH /api/admin/contacts/:id — update status (new / contacted / closed)
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  if (!['new', 'contacted', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be one of: new, contacted, closed.' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE contact_submissions SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Submission not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update submission.' });
  }
});

module.exports = router;
