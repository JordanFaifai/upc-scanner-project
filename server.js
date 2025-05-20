// server.js
const express = require('express');
const fetch = require('node-fetch'); // Used to make requests to the Open Food Facts API
const path = require('path'); // Node.js built-in module for path manipulation

const app = express();
const PORT = process.env.PORT || 3000; // Your server will run on port 3000 by default

// Serve static files (your HTML, CSS, client-side JS) from the current directory
// This makes your index.html and client.js available to the browser
app.use(express.static(__dirname));

// API endpoint to fetch ingredients based on UPC
// When your frontend asks for /api/ingredients/12345, this code runs
app.get('/api/ingredients/:upc', async (req, res) => {
    const upc = req.params.upc; // Get the UPC number from the URL
    const OF_API_URL = `https://world.openfoodfacts.org/api/v0/product/${upc}.json`;

    console.log(`Received request for UPC: ${upc}`);
    console.log(`Querying Open Food Facts API: ${OF_API_URL}`);

    try {
        // Make a request to the Open Food Facts API
        const response = await fetch(OF_API_URL);
        const data = await response.json(); // Parse the JSON response

        // Check if product data was found
        if (data.status === 1 && data.product) {
            const product = data.product;
            const ingredientsText = product.ingredients_text || "No ingredient text available.";
            const productName = product.product_name || "Unknown Product";

            // Send the ingredient data back to your frontend
            res.json({
                upc: upc,
                productName: productName,
                ingredients: ingredientsText,
                source: "Open Food Facts"
            });
        } else {
            console.log(`Product not found for UPC: ${upc}`);
            // Send a 404 Not Found status if product data isn't there
            res.status(404).json({ message: `Product not found or no data for UPC: ${upc}.` });
        }

    } catch (error) {
        console.error(`Error fetching data for UPC ${upc}:`, error);
        // Send a 500 Internal Server Error if something goes wrong
        res.status(500).json({ message: 'Error fetching ingredients from external API.', error: error.message });
    }
});

// Start the server and listen for incoming requests
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to use the scanner.`);
});