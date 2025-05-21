const express = require('express');
const cors = require('cors'); // We'll keep CORS just in case it's a factor with Render's proxy

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Enable CORS for testing

// A very simple test route. This should ALWAYS log if it's hit.
app.get('/test', (req, res) => {
    console.log('[SERVER] /test route was hit!');
    res.json({ message: 'Hello from the simple Render backend!' });
});

// If no other route matches, this will catch it and log it.
app.use((req, res) => {
    console.log(`[SERVER] No specific route found for: ${req.method} ${req.url}`);
    res.status(404).json({ message: 'API endpoint not found (simple test server)' });
});

// Start the server, explicitly binding to 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Simple test server listening on PORT: ${PORT}`);
});