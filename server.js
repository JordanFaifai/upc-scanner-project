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
// server.js - Inside the 'if (data.status === 1 && data.product)' block

const product = data.product; // This line should already be there

const ingredientsText = product.ingredients_text || "No ingredient text available.";
const productName = product.product_name || "Unknown Product";

// --- NEW CODE FOR NOVA CLASSIFICATION ---
const novaGroup = product.nova_group || "Not Classified";
let novaExplanation = "Information not available.";
switch (novaGroup) {
    case 1:
        novaExplanation = "Group 1: Unprocessed or Minimally Processed Foods (e.g., fresh fruits, vegetables, meat, eggs).";
        break;
    case 2:
        novaExplanation = "Group 2: Processed Culinary Ingredients (e.g., oils, butter, sugar, salt, flour).";
        break;
    case 3:
        novaExplanation = "Group 3: Processed Foods (e.g., canned vegetables, simple cheeses, homemade bread, cured meats). Contain few ingredients.";
        break;
    case 4:
        novaExplanation = "Group 4: Ultra-Processed Foods (e.g., soft drinks, packaged snacks, instant noodles, industrial breads). Often contain many additives, flavors, colors, and emulsifiers, and are designed for convenience and hyper-palatability. Generally associated with negative health outcomes.";
        break;
    default:
        novaExplanation = "NOVA classification not available or unknown for this product.";
}

// --- NEW CODE FOR ADDITIVES ---
const additivesTags = product.additives_tags || []; // Get the raw tags
const additives = additivesTags.map(tag => {
    // Clean up the tag (e.g., "en:e100" -> "E100")
    // You can enhance this later to map E-numbers to common names if desired
    return tag.replace(/^en:/, '').toUpperCase();
});
            // Send the ingredient data back to your frontend
            res.json({
                 upc: upc,
    productName: productName,
    ingredients: ingredientsText,
    novaGroup: novaGroup,          // <-- NEW
    novaExplanation: novaExplanation, // <-- NEW
    additives: additives,         // <-- NEW
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