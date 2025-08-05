const express = require('express');
const router = express.Router();
const db = require('../db');

// Επιστρέφει όλους τους users
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.pool.query('SELECT * FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Παράδειγμα προστατευμένου route για profile
router.get('/profile', async (req, res) => {
    const [rows] = await db.pool.query(
        'SELECT id, username, role FROM users WHERE id = ?',
        [req.user.id]
    );
    res.json(rows[0]);
});

module.exports = router;