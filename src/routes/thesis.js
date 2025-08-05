const express = require('express');
const router = express.Router();
const db = require('../db');

// Επιστρέφει όλες τις εργασίες
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.pool.query('SELECT * FROM thesis');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Μπορείς να προσθέσεις και άλλα endpoints για thesis εδώ

module.exports = router;