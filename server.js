const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Needed for making HTTP requests to external APIs
const fs = require('fs');     // Needed to read local JSON file (efsa_additive_details.json)
const path = require('path'); // Needed for resolving file paths

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes, essential for frontend-backend communication
app.use(express.json()); // Enable JSON body parsing for incoming requests (good practice for API)

// --- Load EFSA Additive Details ---
// This will load the JSON file once when the server starts
let efsaAdditiveDetails = {};
try {
    const efsaPath = path.join(__dirname, 'efsa_additive_details.json');
    const rawData = fs.readFileSync(efsaPath);
    efsaAdditiveDetails = JSON.parse(rawData);
    console.log('[SERVER] EFSA Additive Details loaded successfully.');
} catch (error) {
    console.error('[SERVER] Error loading EFSA Additive Details:', error.message);
    // If the file is critical, you might want to exit the process or handle more robustly.
    // For now, we'll continue, but additive info will be incomplete.
}

// --- API Routes ---

// Simple test route (keep for basic server check)
app.get('/test', (req, res) => {
    console.log('[SERVER] /test route was hit!');
    res.json({ message: 'Hello from the simple Render backend!' });
});

// API route to get product information by UPC
app.get('/api/ingredients/:upc', async (req, res) => {
    const upc = req.params.upc;
    console.log(`[SERVER] Received request for UPC: ${upc}`);

    // Basic UPC validation
    if (!upc || typeof upc !== 'string' || upc.length < 8 || upc.length > 14) {
        console.warn(`[SERVER] Invalid UPC format received: ${upc}`);
        return res.status(400).json({ message: 'Invalid UPC format. Please provide an 8, 12, 13, or 14-digit UPC.' });
    }

    try {
        const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v0/product/${upc}.json`;
        console.log(`[SERVER] Fetching from Open Food Facts: ${openFoodFactsUrl}`);
        const response = await axios.get(openFoodFactsUrl);
        const productData = response.data.product;

        if (!productData) {
            console.log(`[SERVER] Product not found in Open Food Facts for UPC: ${upc}`);
            return res.status(404).json({ message: `Product not found for UPC: ${upc}` });
        }

        // --- Extract and Format Product Data ---
        const productName = productData.product_name || productData.product_name_en || 'Unknown Product';
        const ingredientsText = productData.ingredients_text || productData.ingredients_text_en || 'No ingredients listed.';
        const imageUrl = productData.image_front_url || productData.image_url || null;
        const allergens = productData.allergens_from_ingredients ?
            productData.allergens_from_ingredients.split(',').map(a => a.trim().replace(/^en:/, '').replace(/-/g, ' ')).filter(Boolean) : [];
        const novaGroup = productData.nova_group ? String(productData.nova_group) : null;

        let novaExplanation = '';
        if (novaGroup) {
            switch (novaGroup) {
                case '1':
                    novaExplanation = 'Unprocessed or minimally processed foods.';
                    break;
                case '2':
                    novaExplanation = 'Processed culinary ingredients.';
                    break;
                case '3':
                    novaExplanation = 'Processed foods.';
                    break;
                case '4':
                    novaExplanation = 'Ultra-processed food and drink products.';
                    break;
                default:
                    novaExplanation = 'Unknown processing level.';
            }
        }

        const nutritionFacts = {
            calories: productData.nutriments?.['energy-kcal_100g'], // Note the hyphen in 'energy-kcal_100g'
            protein: productData.nutriments?.proteins_100g,
            carbohydrates: productData.nutriments?.carbohydrates_100g,
            fat: productData.nutriments?.fat_100g,
            sugar: productData.nutriments?.sugars_100g,
            salt: productData.nutriments?.salt_100g,
            fiber: productData.nutriments?.fiber_100g,
        };

        // --- Extract and Enrich Additives with EFSA data ---
        const additives = productData.additives_tags ? productData.additives_tags.map(tag => {
            const eNumber = tag.replace('en:', '').toUpperCase(); // e.g., 'en:e330' -> 'E330'
            const additiveInfo = efsaAdditiveDetails[eNumber] || { name: 'Unknown Additive', type: 'N/A', status: 'Not banned in EU' };
            return {
                eNumber: eNumber,
                name: additiveInfo.name,
                type: additiveInfo.type,
                status: additiveInfo.status
            };
        }) : [];

        // Construct the final product object to send to the frontend
        const result = {
            upc: upc,
            name: productName,
            ingredients: ingredientsText,
            image: imageUrl,
            novaGroup: novaGroup,
            novaExplanation: novaExplanation,
            allergens: allergens,
            additives: additives,
            nutrition_facts: nutritionFacts,
            source: 'Open Food Facts'
        };

        console.log(`[SERVER] Successfully processed and sent data for UPC: ${upc}`);
        res.json(result);

    } catch (error) {
        console.error(`[SERVER] Error fetching or processing UPC ${upc}:`, error.message);
        if (axios.isAxiosError(error)) {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx (e.g., 404 from Open Food Facts)
                console.error(`[SERVER] Open Food Facts response error. Status: ${error.response.status}, Data:`, error.response.data);
                res.status(error.response.status).json({
                    message: `Error from Open Food Facts API: ${error.response.status} - ${error.response.data?.status_verbose || 'Unknown error'}`,
                });
            } else if (error.request) {
                // The request was made but no response was received (e.g., network error)
                console.error(`[SERVER] No response received from Open Food Facts API for UPC ${upc}.`);
                res.status(503).json({ message: 'No response received from external API. Open Food Facts might be down or unreachable.' });
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error(`[SERVER] Error setting up Axios request for UPC ${upc}:`, error.message);
                res.status(500).json({ message: `Server error creating API request: ${error.message}` });
            }
        } else {
            // Other non-Axios errors
            console.error(`[SERVER] Unexpected server error for UPC ${upc}:`, error);
            res.status(500).json({ message: `An unexpected server error occurred.` });
        }
    }
});

// --- 404 Catch-all Middleware ---
// THIS MUST BE PLACED *AFTER* ALL YOUR SPECIFIC ROUTES (like /test and /api/ingredients/:upc)
// Any request that doesn't match a route above will fall into this.
app.use((req, res) => {
    console.log(`[SERVER] No specific route found for: ${req.method} ${req.url}`);
    res.status(404).json({ message: 'API endpoint not found (simple test server)' });
});

// --- Start the Server ---
// Explicitly bind to '0.0.0.0' for Render deployments
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Backend API server listening on PORT: ${PORT}`);
});