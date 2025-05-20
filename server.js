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

    console.log(`[SERVER] Received request for UPC: ${upc}`);
    console.log(`[SERVER] Querying Open Food Facts API: ${OF_API_URL}`);

    try {
        const response = await fetch(OF_API_URL);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SERVER] Open Food Facts API response not OK (HTTP status: ${response.status}). Error text: ${errorText.substring(0, 200)}`);
            return res.status(response.status).json({ message: `Error from Open Food Facts API: ${response.status} - ${errorText.substring(0, 100)}...` });
        }

        const data = await response.json();
        // --- CRUCIAL LOG: See the raw data your server receives from OFF ---
        console.log('[SERVER] Raw data from Open Food Facts API:', JSON.stringify(data, null, 2));

        if (data.status !== 1 || !data.product) {
            console.warn(`[SERVER] Product not found (status: ${data.status}) or 'product' object missing for UPC: ${upc}`);
            return res.status(404).json({ message: `No product found for UPC: ${upc} on Open Food Facts. It might not be in the database.` });
        }

        const product = data.product;
        // --- CRUCIAL LOG: See the specific 'product' object extracted ---
        console.log('[SERVER] Extracted product object from OFF response:', JSON.stringify(product, null, 2));


        // --- DATA EXTRACTION FOR CLIENT ---
        const productName = product.product_name || product.product_name_en || 'Product Name Not Available';
        const ingredientsText = product.ingredients_text || product.ingredients_text_en || 'No ingredient text available.';
        const imageUrl = product.image_front_url || product.image_url || 'no_image.png'; // Default image if none

        // --- NOVA CLASSIFICATION ---
        // Ensure novaGroup is a string before sending (for client-side .replace() safety)
        const novaGroup = product.nova_group ? String(product.nova_group) : "Unknown";
        let novaExplanation = "Information not available.";

        switch (novaGroup) { // Note: novaGroup is now a string here, but switch handles it
            case "1": // Use string "1" for comparison
                novaExplanation = "Group 1: **Unprocessed or Minimally Processed Foods.** These foods are typically consumed in their natural state or with minor alterations like drying, crushing, roasting, or pasteurization. They are free from added sugars, fats, or industrial food additives. They represent the basis of a healthy diet.";
                break;
            case "2": // Use string "2"
                novaExplanation = "Group 2: **Processed Culinary Ingredients.** These are substances like oils, butter, sugar, salt, and flour, obtained directly from Group 1 foods by processes such as pressing, grinding, pulverizing, or refining. They are not meant to be consumed on their own but are used in kitchens to prepare Group 1 foods into meals.";
                break;
            case "3": // Use string "3"
                novaExplanation = "Group 3: **Processed Foods.** These are relatively simple products made by adding Group 2 ingredients (like salt, sugar, oil) to Group 1 foods. Examples include canned vegetables, simple cheeses, and cured meats. They are processed to increase shelf life or palatability, but typically contain few ingredients and no 'cosmetic' additives.";
                break;
            case "4": // Use string "4"
                let baseNova4Explanation = "Group 4: **Ultra-Processed Foods.** These are industrial formulations often containing many ingredients including industrial additives and substances extracted from foods. They are designed for convenience, hyper-palatability, and long shelf-life, and are generally associated with adverse health outcomes due to high levels of added sugar, unhealthy fats, and sodium.";

                const rawAdditivesTags = product.additives_tags || [];
                const detectedAdditiveNames = new Set();
                rawAdditivesTags.forEach(tag => {
                    const eNumber = tag.toUpperCase().replace(/^EN:/, ''); // Clean up tag, e.g., "en:e100" -> "E100"
                    const additiveInfo = additiveMap[eNumber];
                    if (additiveInfo) {
                        detectedAdditiveNames.add(additiveInfo.name);
                    } else if (eNumber) { // Add unknown E-numbers if present
                        detectedAdditiveNames.add(`Unknown Additive (${eNumber})`);
                    }
                });

                let namesList = Array.from(detectedAdditiveNames).filter(name => !name.includes("Unknown Additive")).join(', ');
                if (namesList) {
                    novaExplanation = `Group 4: **Ultra-Processed Foods.** This product is classified as ultra-processed, primarily due to the presence of industrial food additives such as **${namesList}**. ${baseNova4Explanation.replace('Group 4: **Ultra-Processed Foods.** ', '')}`;
                } else if (detectedAdditiveNames.size > 0) { // If only unknown additives were found
                    novaExplanation = `Group 4: **Ultra-Processed Foods.** This product is classified as ultra-processed, likely due to the presence of various industrial food additives including: ${Array.from(detectedAdditiveNames).join(', ')}. ${baseNova4Explanation.replace('Group 4: **Ultra-Processed Foods.** ', '')}`;
                } else {
                    novaExplanation = baseNova4Explanation;
                }
                break;
            default:
                novaExplanation = "NOVA Classification information is not available for this product, or it is not classified.";
        }

        // --- ALLERGENS ---
        // Allergens come as an array of tags (e.g., ["en:milk", "en:gluten"])
        const allergens = product.allergens_tags || []; // Pass as is, client will process

        // --- ADDITIVES ---
        // Your existing additive mapping is good. We need to pass the processed list to the client.
        const processedAdditives = (product.additives_tags || []).map(tag => {
            const eNumber = tag.toUpperCase().replace(/^EN:/, '');
            const additiveInfo = additiveMap[eNumber];
            return additiveInfo
                ? {
                    name: additiveInfo.name,
                    e_number: eNumber,
                    risk_level: 'Unknown', // Your map doesn't provide risk, set as unknown
                    type: additiveInfo.type || 'Unknown Type',
                    explanation: '' // No explanation in your map, so leave empty
                }
                : {
                    name: `E${eNumber}`, // Use E-number as name if not in map
                    e_number: eNumber,
                    risk_level: 'Unknown',
                    type: 'Unknown Type',
                    explanation: 'Details for this additive are not in our database.'
                };
        });

        // --- NUTRITION FACTS ---
        // Nutrition facts are typically nested under 'nutriments'
        const nutriments = product.nutriments || {};
        const nutrition_facts = {
            calories: nutriments.energy_value || nutriments['energy-kcal_100g'] || 'N/A', // Try both common keys
            protein: nutriments.proteins_100g || 'N/A',
            carbohydrates: nutriments.carbohydrates_100g || 'N/A',
            fat: nutriments.fat_100g || 'N/A',
            // Add more if needed, e.g., fiber, sugar, salt
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
    console.log(`[SERVER] Server running on port ${PORT}`);
});