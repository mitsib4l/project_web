const express = require('express'); // Import express for routing
const db = require('./db'); // Import database connection
const authenticateToken = require('./middleware/authenticationToken'); // Import authentication middleware

const authRoutes = require('./routes/auth'); // Import authentication routes
const userRoutes = require('./routes/users'); // Import user routes
const thesisRoutes = require('./routes/thesis'); // Import thesis routes
const professorRoutes = require('./routes/professor');

const app = express(); // Create an Express application
const PORT = process.env.PORT || 3000; // Set the port for the server


app.use(express.json()); 

// Route usage
app.use('/auth', authRoutes); // Use authentication routes
app.use('/users', authenticateToken, userRoutes); // Use user routes with authentication
app.use('/thesis', authenticateToken, thesisRoutes); // Use thesis routes with authentication
app.use('/professor', authenticateToken, professorRoutes); // Use professor routes with authentication

// Παράδειγμα προστατευμένου route
app.get('/profile', authenticateToken, async (req, res) => {
    const [rows] = await db.pool.query(
        'SELECT id, username, role FROM users WHERE id = ?',
        [req.user.id]
    );
    res.json(rows[0]);
});

// Health check route
app.get('/', (req, res) => {
    res.send('API is running');
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