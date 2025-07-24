const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Load EFSA Additive Details from a local JSON file (e.g., efsa_additive_details.json)
let efsaAdditiveDetailsCache = {};
try {
    const additivesFilePath = path.join(__dirname, 'efsa_additive_details.json'); // Updated filename here
    if (fs.existsSync(additivesFilePath)) {
        efsaAdditiveDetailsCache = JSON.parse(fs.readFileSync(additivesFilePath, 'utf8'));
        console.log(`[SERVER] EFSA Additive Details loaded from file: ${Object.keys(efsaAdditiveDetailsCache).length} additives.`);
    } else {
        console.error('[SERVER] ERROR: efsa_additive_details.json file not found.'); // Updated filename here
    }
} catch (error) {
    console.error('[SERVER] Error loading EFSA Additive Details from file:', error.message);
}

// --- CORS Configuration ---
const allowedOrigins = [
    'https://upc-scanner-project.onrender.com',
    'http://localhost:10000',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'https://purescan.net',
    'http://localhost:8081'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error(`The CORS policy for this site does not allow access from the specified Origin: ${origin}`), false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// --- API Routes ---

app.get('/test', (req, res) => {
    console.log('[SERVER] /test route was hit!');
    res.json({ message: 'Hello from the simple Render backend!' });
});

app.get('/', (req, res) => {
    console.log('[SERVER] Health check / route was hit!');
    res.send('Backend API is running!');
});

app.get('/api/product/:upc', async (req, res) => {
    const upc = req.params.upc;
    console.log(`[SERVER] Received request for UPC: ${upc}`);

    if (!upc || typeof upc !== 'string' || upc.length < 8 || upc.length > 14) {
        console.warn(`[SERVER] Invalid UPC format received: ${upc}`);
        return res.status(400).json({ message: 'Invalid UPC format. Please provide an 8, 12, 13, or 14-digit UPC.' });
    }

    try {
        const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v0/product/${upc}.json`;
        console.log(`[SERVER] Fetching from Open Food Facts: ${openFoodFactsUrl}`);
        const response = await axios.get(openFoodFactsUrl);
        
        if (response.data.status === 0) {
            console.log(`[SERVER] Open Food Facts API indicated product not found (status 0) or error for UPC: ${upc}`);
            return res.status(404).json({ message: `Product not found for UPC: ${upc}` });
        }
        
        const productData = response.data.product;

        if (!productData) {
            console.log(`[SERVER] Product not found in Open Food Facts for UPC: ${upc}`);
            return res.status(404).json({ message: `Product not found for UPC: ${upc}` });
        }

        const productName = productData.product_name_en || productData.product_name || 'Unknown Product';
        const ingredientsText = productData.ingredients_text_en || productData.ingredients_text || 'No ingredients listed.';
        const imageUrl = productData.image_front_url || productData.image_url || null;
        
        const allergens = productData.allergens_from_ingredients ?
            [...new Set(productData.allergens_from_ingredients
                .split(',')
                .map(a => a.trim().replace(/^en:/, '').replace(/-/g, ' ').toLowerCase())
                .filter(Boolean))]
            : [];
        
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

        const servingSize = productData.serving_size || null;
        const servingQuantity = productData.serving_quantity ? parseFloat(productData.serving_quantity) : null;

        const nutritionFacts = {
            calories: { per_serving: productData.nutriments?.['energy-kcal_100g'] || null },
            protein: { per_serving: productData.nutriments?.proteins_100g || null },
            carbohydrates: { per_serving: productData.nutriments?.carbohydrates_100g || null },
            fat: { per_serving: productData.nutriments?.fat_100g || null },
            sugar: { per_serving: productData.nutriments?.sugars_100g || null },
            salt: { per_serving: productData.nutriments?.salt_100g || null },
            fiber: { per_serving: productData.nutriments?.fiber_100g || null },
        };

        const additives = productData.additives_tags ? productData.additives_tags.map(tag => {
            const fullENumber = tag.replace('en:', '').toUpperCase();
            const baseENumber = fullENumber.match(/^E\d+/)?.[0] || fullENumber;
            const additiveInfo = efsaAdditiveDetailsCache[baseENumber];
            
            const name = additiveInfo ? additiveInfo.name : `${fullENumber} (Details Not Available)`;
            const type = additiveInfo ? additiveInfo.type : 'N/A';
            const status = additiveInfo ? additiveInfo.status : 'Unknown Status';

            return {
                eNumber: fullENumber,
                name: name,
                type: type,
                status: status
            };
        }) : [];

        const result = {
            barcode: upc,
            product_name: productName,
            ingredients: ingredientsText,
            image_url: imageUrl,
            nova_group: novaGroup,
            nova_group_description: novaExplanation,
            allergens: allergens,
            additives: additives,
            nutrition_facts: nutritionFacts,
            serving_size: servingSize,
            serving_quantity: servingQuantity,
            source: 'Open Food Facts'
        };

        console.log(`[SERVER] Successfully processed and sent data for UPC: ${upc}`);
        res.json(result);

    } catch (error) {
        console.error(`[SERVER] Error fetching or processing UPC ${upc}:`, error.message);
        if (axios.isAxiosError(error)) {
            if (error.response) {
                console.error(`[SERVER] Open Food Facts response error. Status: ${error.response.status}, Data:`, error.response.data);
                res.status(error.response.status).json({
                    message: `Error from Open Food Facts API: ${error.response.status} - ${error.response.data?.status_verbose || 'Unknown error'}`,
                });
            } else if (error.request) {
                console.error(`[SERVER] No response received from Open Food Facts API for UPC ${upc}.`);
                res.status(503).json({ message: 'No response received from external API. Open Food Facts might be down or unreachable.' });
            } else {
                console.error(`[SERVER] Error setting up Axios request for UPC ${upc}:`, error.message);
                res.status(500).json({ message: `Server error creating API request: ${error.message}` });
            }
        } else {
            console.error(`[SERVER] Unexpected server error for UPC ${upc}:`, error);
            res.status(500).json({ message: `An unexpected server error occurred.` });
        }
    }
});

app.use((req, res) => {
    console.log(`[SERVER] No specific route found for: ${req.method} ${req.url}`);
    res.status(404).json({ message: 'API endpoint not found.' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Backend API server listening on PORT: ${PORT}`);
});