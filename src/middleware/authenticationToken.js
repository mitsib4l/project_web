const jwt = require('jsonwebtoken'); // Import JWT for token handling
const SECRET = 'your_secret_key'; // Define your secret key for JWT

// Middleware to parse JSON requests
app.use(express.json());

// Middleware for JWT authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401); // Unauthorized if no token is provided
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden if token is invalid
        req.user = user; // Attach user info to request
        next(); // Proceed to the next middleware or route handler
    });
}

module.exports = authenticateToken; // Export the middleware for use in other files