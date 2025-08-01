const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Thesis Management System API',
        endpoints: [
            { method: 'GET', path: '/', description: 'API info' },
            { method: 'GET', path: '/theses', description: 'List all theses' },
            { method: 'POST', path: '/theses', description: 'Create a new thesis' },
            // Πρόσθεσε εδώ όσα endpoints έχεις ή θα προσθέσεις
        ],
        documentation: 'Για περισσότερες πληροφορίες, επικοινωνήστε με τον διαχειριστή.'
    });
});

// Επιστρέφει όλα τα theses
app.get('/thesis', async (req, res) => {
    try {
        const [rows] = await db.pool.query('SELECT * FROM thesis');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Επιστρέφει όλους τους users
app.get('/users', async (req, res) => {
    try {
        const [rows] = await db.pool.query('SELECT * FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Connect to the database
db.connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });