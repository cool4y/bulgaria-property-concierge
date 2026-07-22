const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db/pool');
const { contactSchema } = require('../validation');
const { sendContactNotification } = require('../email');

const router = express.Router();

// Basic abuse protection: 5 submissions per 15 minutes per IP.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

router.post('/', contactLimiter, async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid submission.', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  try {
    const { rows } = await pool.query(
      `INSERT INTO contact_submissions
        (name, email, phone_code, phone, apartment_type, investment_goal, purchase_timeline, budget, finish_tier, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        data.name,
        data.email,
        data.phoneCode,
        data.phone,
        data.apartmentType,
        data.investmentGoal,
        data.purchaseTimeline,
        data.budget,
        data.finishTier,
        data.message || null,
      ]
    );

    // Email notification failure shouldn't fail the request — the submission is
    // already safely stored either way, and admins can still see it in the panel.
    const emailResult = await sendContactNotification(data);

    res.status(201).json({ id: rows[0].id, emailSent: emailResult.sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save submission.' });
  }
});

module.exports = router;
