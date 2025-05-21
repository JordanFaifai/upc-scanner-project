const express = require('express');
const fetch = require('node-fetch'); // Used to make requests to the Open Food Facts API
const path = require('path'); // Node.js built-in module for path manipulation
const cors = require('cors'); // <--- ADD THIS LINE

const app = express();
const PORT = process.env.PORT || 3000; // Your server will run on port 3000 by default

// Serve static files (your HTML, CSS, client-side JS) from the current directory
// This makes your index.html and client.js available to the browser
// NOTE: For your setup with separate frontend/backend, this `app.use(express.static(__dirname));`
// line in the backend server is technically not needed if the frontend is hosted separately on Render
// as a Static Site, but it doesn't hurt anything.
app.use(express.static(__dirname));

// Load your enriched additive data from the generated JSON file
// Ensure efsa_additive_details.json exists and is in the same directory as server.js
const efsaAdditiveDetails = require('./efsa_additive_details.json');

// Use this loaded data as your additiveMap
const additiveMap = {
    ...efsaAdditiveDetails
};

// Enable CORS for all origins. This allows your frontend (on a different domain/port)
// to make requests to this backend.
app.use(cors()); // <--- ADD THIS LINE - PLACE IT AFTER app = express(); and before app.get(...)

// API endpoint to fetch ingredients based on UPC
// When your frontend asks for /api/ingredients/12345, this code runs
app.get('/api/ingredients/:upc', async (req, res) => {
    const upc = req.params.upc;
    const OF_API_URL = `https://world.openfoodfacts.org/api/v2/product/${upc}.json`;

    try {
        console.log(`[SERVER] Fetching product data for UPC: ${upc} from ${OF_API_URL}`);
        const response = await fetch(OF_API_URL);

        if (!response.ok) {
            // Log full error response for debugging
            const errorText = await response.text();
            console.error(`[SERVER] Open Food Facts API responded with status ${response.status}: ${errorText}`);
            return res.status(response.status).json({ message: `Failed to fetch product data from Open Food Facts: ${response.statusText}` });
        }

        const data = await response.json();
        console.log(`[SERVER] Received data for UPC ${upc}. Product found: ${!!data.product}`);

        if (!data.product) {
            console.log(`[SERVER] No product found in Open Food Facts for UPC: ${upc}`);
            return res.status(404).json({ message: 'Product not found.' });
        }

        const product = data.product;

        // ... (rest of your product processing logic, which looks fine) ...

        res.json(simplifiedProduct); // This will send the data to your frontend

    } catch (error) {
        console.error('[SERVER] Caught server error fetching product data:', error);
        res.status(500).json({ message: 'Internal server error fetching product data. Please check server logs.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});