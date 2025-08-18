const express = require('express'); // Import express for routing
const db = require('../db');
const router = express.Router(); // Create a new router instance
const jwt = require('jsonwebtoken'); // Import JWT for token handling
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const SECRET = 'your_secret_key'; // Define your secret key for JWT

// Login endpoint
router.post('/login', async (req, res) => { 
    const { email, password } = req.body;
    const [rows] = await db.pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// Logout endpoint (frontend simply deletes the token)
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out' });
});

/*

// Register endpoint
app.post('/register', async (req, res) => {
    const { email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await db.pool.query(
        'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
        [email, hashed, role]
    );
    res.status(201).json({ message: 'User registered' });
});

*/

module.exports = router; // Export the router for use in other files