const express = require('express');
const fetch = require('node-fetch'); // Used to make requests to the Open Food Facts API
const path = require('path'); // Node.js built-in module for path manipulation

const app = express();
const PORT = process.env.PORT || 3000; // Your server will run on port 3000 by default

// Serve static files (your HTML, CSS, client-side JS) from the current directory
// This makes your index.html and client.js available to the browser
app.use(express.static(__dirname));

// Load your enriched additive data from the generated JSON file
// Ensure efsa_additive_details.json exists and is in the same directory as server.js
const efsaAdditiveDetails = require('./efsa_additive_details.json');

// Use this loaded data as your additiveMap
const additiveMap = {
    ...efsaAdditiveDetails
};


// API endpoint to fetch ingredients based on UPC
// When your frontend asks for /api/ingredients/12345, this code runs
app.get('/api/ingredients/:upc', async (req, res) => {
    const upc = req.params.upc;
    // IMPORTANT: Open Food Facts API v2 is recommended.
    // Your code uses v0, which is deprecated and might have missing fields.
    // Change to v2:
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

        // Extract key product information
        const productName = product.product_name || product.product_name_en || 'Unknown Product';
        const ingredientsText = product.ingredients_text || product.ingredients_text_en || 'No ingredients text available.';
        const novaGroup = product.nova_group || 'Unknown';
        const novaExplanation = product.nova_groups_tags && product.nova_groups_tags[0] ?
            product.nova_groups_tags[0].replace('en:', '').replace('-', ' Group ').toUpperCase() + ' Food Classification' :
            'No NOVA group explanation available.';
        const imageUrl = product.image_front_url || product.image_url || null;


        // Process allergens
        // The API returns allergens as tags, e.g., "en:gluten", "en:milk"
        const allergens = product.allergens_tags ?
            product.allergens_tags.map(tag => tag.replace('en:', '').replace(/-/g, ' ')) : [];


        // Process additives
        const rawAdditives = product.additives_tags || [];
        const processedAdditives = rawAdditives.map(additive => {
            const additiveId = additive.replace('en:', '').toUpperCase(); // e.g., E330
            const efsaDetails = additiveMap[additiveId]; // Look up in your efsa_additive_details.json

            return {
                name: efsaDetails ? efsaDetails.name : (additiveId.startsWith('E') ? `Additive ${additiveId}` : additiveId),
                eNumber: additiveId.startsWith('E') ? additiveId : 'N/A', // Ensure E-number format
                type: efsaDetails ? efsaDetails.type : 'N/A',
                status: efsaDetails ? efsaDetails.status : 'N/A' // e.g., 'Not banned in EU', 'Banned in EU', 'Requires warning'
            };
        });

        // --- Process Nutrition Facts ---
        const nutriments = product.nutriments || {};

        let calories = 'N/A';
        // Check for common calorie keys
        if (nutriments['energy-kcal_100g']) {
            calories = nutriments['energy-kcal_100g'];
        } else if (nutriments.energy_kcal_100g) { // Sometimes uses underscore
            calories = nutriments.energy_kcal_100g;
        } else if (nutriments['energy-kj_100g']) { // Convert kJ to kcal if only kJ is available
            calories = (parseFloat(nutriments['energy-kj_100g']) / 4.184).toFixed(0); // Rough conversion
        }

        const nutrition_facts = {
            calories: calories, // Now handles different keys and kJ conversion
            protein: nutriments.proteins_100g || 'N/A',
            carbohydrates: nutriments.carbohydrates_100g || 'N/A',
            fat: nutriments.fat_100g || 'N/A',
            sugar: nutriments.sugars_100g || 'N/A',
            salt: nutriments.salt_100g || 'N/A',
            fiber: nutriments.fiber_100g || 'N/A'
        };


        // --- CONSTRUCT THE FINAL OBJECT TO SEND TO CLIENT ---
        const simplifiedProduct = {
            name: productName,
            ingredients: ingredientsText,
            novaGroup: novaGroup, // Send as string
            novaExplanation: novaExplanation,
            image: imageUrl,
            source: product.product_url ? `Open Food Facts (${product.product_url})` : "Open Food Facts",
            allergens: allergens, // Send raw tags, client will process
            additives: processedAdditives, // Send processed additive objects
            nutrition_facts: nutrition_facts // Send the nutrition object
        };

        // --- CRUCIAL LOG: See what your server is sending to the client ---
        console.log('[SERVER] Sending simplified product to client:', JSON.stringify(simplifiedProduct, null, 2));

        res.json(simplifiedProduct);

    } catch (error) {
        console.error('[SERVER] Caught server error fetching product data:', error);
        res.status(500).json({ message: 'Internal server error fetching product data. Please check server logs.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});