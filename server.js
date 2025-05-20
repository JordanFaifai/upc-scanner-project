// server.js
const express = require('express');
const fetch = require('node-fetch'); // Used to make requests to the Open Food Facts API
const path = require('path'); // Node.js built-in module for path manipulation

const app = express();
const PORT = process.env.PORT || 3000; // Your server will run on port 3000 by default

// Serve static files (your HTML, CSS, client-side JS) from the current directory
// This makes your index.html and client.js available to the browser
app.use(express.static(__dirname));

const additiveMap = {
    "E100": { name: "Curcumin", type: "Color" },
    "E101": { name: "Riboflavin", type: "Color" },
    "E101A": { name: "Riboflavin-5'-phosphate", type: "Color" },
    "E102": { name: "Tartrazine (Yellow 5)", type: "Color" },
    "E104": { name: "Quinoline Yellow", type: "Color" },
    "E110": { name: "Sunset Yellow FCF (Yellow 6)", type: "Color" },
    "E120": { name: "Cochineal, Carminic Acid", type: "Color" },
    "E122": { name: "Carmoisine", type: "Color" },
    "E123": { name: "Amaranth", type: "Color" },
    "E124": { name: "Ponceau 4R", type: "Color" },
    "E127": { name: "Erythrosine", type: "Color" },
    "E129": { name: "Allura Red AC (Red 40)", type: "Color" },
    "E131": { name: "Patent Blue V", type: "Color" },
    "E132": { name: "Indigotine (Indigo carmine)", type: "Color" },
    "E133": { name: "Brilliant Blue FCF (Blue 1)", type: "Color" },
    "E140": { name: "Chlorophylls", type: "Color" },
    "E141": { name: "Copper complexes of chlorophylls", type: "Color" },
    "E142": { name: "Green S", type: "Color" },
    "E150A": { name: "Plain Caramel", type: "Color" },
    "E150B": { name: "Caustic Sulphite Caramel", type: "Color" },
    "E150C": { name: "Ammonia Caramel", type: "Color" },
    "E150D": { name: "Sulphite Ammonia Caramel", type: "Color" },
    "E153": { name: "Vegetable Carbon", type: "Color" },
    "E155": { name: "Brown HT", type: "Color" },
    "E160A": { name: "Carotenes", type: "Color" },
    "E160B": { name: "Annatto, Bixin, Norbixin", type: "Color" },
    "E160C": { name: "Paprika Extract, Capsanthin, Capsorubin", type: "Color" },
    "E160D": { name: "Lycopene", type: "Color" },
    "E160E": { name: "Beta-apo-8'-carotenal (C30)", type: "Color" },
    "E161G": { name: "Canthaxanthin", type: "Color" },
    "E162": { name: "Beetroot Red, Betanin", type: "Color" },
    "E163": { name: "Anthocyanins", type: "Color" },
    "E170": { name: "Calcium Carbonate", type: "Color, Anti-caking agent" },
    "E171": { name: "Titanium Dioxide", type: "Color" },
    "E172": { name: "Iron Oxides and Hydroxides", type: "Color" },
    "E200": { name: "Sorbic Acid", type: "Preservative" },
    "E202": { name: "Potassium Sorbate", type: "Preservative" },
    "E210": { name: "Benzoic Acid", type: "Preservative" },
    "E211": { name: "Sodium Benzoate", type: "Preservative" },
    "E212": { name: "Potassium Benzoate", type: "Preservative" },
    "E213": { name: "Calcium Benzoate", type: "Preservative" },
    "E214": { name: "Ethylparaben", type: "Preservative" },
    "E215": { name: "Sodium ethyl para-hydroxybenzoate", type: "Preservative" },
    "E216": { name: "Propylparaben", type: "Preservative" },
    "E218": { name: "Methylparaben", type: "Preservative" },
    "E220": { name: "Sulphur Dioxide", type: "Preservative" },
    "E221": { name: "Sodium Sulphite", type: "Preservative" },
    "E222": { name: "Sodium Hydrogen Sulphite", type: "Preservative" },
    "E223": { name: "Sodium Metabisulphite", type: "Preservative" },
    "E224": { name: "Potassium Metabisulphite", type: "Preservative" },
    "E225": { name: "Potassium Sulphite", type: "Preservative" },
    "E226": { name: "Calcium Sulphite", type: "Preservative" },
    "E227": { name: "Calcium Hydrogen Sulphite", type: "Preservative" },
    "E228": { name: "Potassium Hydrogen Sulphite", type: "Preservative" },
    "E234": { name: "Nisin", type: "Preservative" },
    "E235": { name: "Natamycin", type: "Preservative" },
    "E250": { name: "Sodium Nitrite", type: "Preservative" },
    "E251": { name: "Sodium Nitrate", type: "Preservative" },
    "E252": { name: "Potassium Nitrate", type: "Preservative" },
    "E260": { name: "Acetic Acid", type: "Acidity Regulator" },
    "E261": { name: "Potassium Acetate", type: "Acidity Regulator" },
    "E262": { name: "Sodium Acetate", type: "Acidity Regulator" },
    "E263": { name: "Calcium Acetate", type: "Acidity Regulator" },
    "E270": { name: "Lactic Acid", type: "Acidity Regulator" },
    "E280": { name: "Propionic Acid", type: "Preservative" },
    "E281": { name: "Sodium Propionate", type: "Preservative" },
    "E282": { name: "Calcium Propionate", type: "Preservative" },
    "E283": { name: "Potassium Propionate", type: "Preservative" },
    "E290": { name: "Carbon Dioxide", type: "Propellant, Acidity Regulator" },
    "E296": { name: "Malic Acid", type: "Acidity Regulator" },
    "E300": { name: "Ascorbic Acid", type: "Antioxidant" },
    "E301": { name: "Sodium Ascorbate", type: "Antioxidant" },
    "E302": { name: "Calcium Ascorbate", type: "Antioxidant" },
    "E304": { name: "Ascorbyl Palmitate", type: "Antioxidant" },
    "E306": { name: "Tocopherols (Vitamin E)", type: "Antioxidant" },
    "E307": { name: "Alpha-Tocopherol", type: "Antioxidant" },
    "E308": { name: "Gamma-Tocopherol", type: "Antioxidant" },
    "E309": { name: "Delta-Tocopherol", type: "Antioxidant" },
    "E310": { name: "Propyl Gallate", type: "Antioxidant" },
    "E311": { name: "Octyl Gallate", type: "Antioxidant" },
    "E312": { name: "Dodecyl Gallate", type: "Antioxidant" },
    "E315": { name: "Isoascorbic Acid", type: "Antioxidant" },
    "E316": { name: "Sodium Isoascorbate", type: "Antioxidant" },
    "E319": { name: "Tertiary-butylhydroquinone (TBHQ)", type: "Antioxidant" },
    "E320": { name: "Butylated Hydroxyanisole (BHA)", type: "Antioxidant" },
    "E321": { name: "Butylated Hydroxytoluene (BHT)", type: "Antioxidant" },
    "E322": { name: "Lecithins", type: "Emulsifier" },
    "E325": { name: "Sodium Lactate", type: "Acidity Regulator" },
    "E326": { name: "Potassium Lactate", type: "Acidity Regulator" },
    "E327": { name: "Calcium Lactate", type: "Acidity Regulator" },
    "E330": { name: "Citric Acid", type: "Acidity Regulator" },
    "E331": { name: "Sodium Citrates", type: "Acidity Regulator" },
    "E332": { name: "Potassium Citrates", type: "Acidity Regulator" },
    "E333": { name: "Calcium Citrates", type: "Acidity Regulator" },
    "E334": { name: "Tartaric Acid", type: "Acidity Regulator" },
    "E335": { name: "Sodium Tartrates", type: "Acidity Regulator" },
    "E336": { name: "Potassium Tartrates", type: "Acidity Regulator" },
    "E337": { name: "Potassium Sodium Tartrate", type: "Acidity Regulator" },
    "E338": { name: "Phosphoric Acid", type: "Acidity Regulator" },
    "E339": { name: "Sodium Phosphates", type: "Acidity Regulator" },
    "E340": { name: "Potassium Phosphates", type: "Acidity Regulator" },
    "E341": { name: "Calcium Phosphates", type: "Acidity Regulator" },
    "E354": { name: "Calcium Tartrate", type: "Acidity Regulator" },
    "E355": { name: "Adipic Acid", type: "Acidity Regulator" },
    "E363": { name: "Succinic Acid", type: "Acidity Regulator" },
    "E385": { name: "Calcium Disodium EDTA", type: "Antioxidant" },
    "E400": { name: "Alginic Acid", type: "Thickener, Stabilizer" },
    "E401": { name: "Sodium Alginate", type: "Thickener, Stabilizer" },
    "E406": { name: "Agar", type: "Thickener, Gelling Agent" },
    "E407": { name: "Carrageenan", type: "Thickener, Stabilizer" },
    "E410": { name: "Locust Bean Gum", type: "Thickener, Stabilizer" },
    "E412": { name: "Guar Gum", type: "Thickener, Stabilizer" },
    "E414": { name: "Acacia Gum (Gum Arabic)", type: "Thickener, Stabilizer" },
    "E415": { name: "Xanthan Gum", type: "Thickener, Stabilizer" },
    "E416": { name: "Karaya Gum", type: "Thickener, Stabilizer" },
    "E418": { name: "Gellan Gum", type: "Thickener, Stabilizer" },
    "E420": { name: "Sorbitol", type: "Sweetener, Humectant" },
    "E421": { name: "Mannitol", type: "Sweetener, Humectant" },
    "E422": { name: "Glycerol", type: "Humectant, Thickener" },
    "E428": { name: "Gelatin", type: "Thickener, Gelling Agent" },
    "E440": { name: "Pectins", type: "Thickener, Gelling Agent" },
    "E450": { name: "Diphosphates", type: "Emulsifier, Stabilizer" },
    "E451": { name: "Triphosphates", type: "Emulsifier, Stabilizer" },
    "E452": { name: "Polyphosphates", type: "Emulsifier, Stabilizer" },
    "E460": { name: "Cellulose", type: "Thickener, Emulsifier" },
    "E461": { name: "Methylcellulose", type: "Thickener, Emulsifier" },
    "E464": { name: "Hydroxypropyl Methylcellulose (HPMC)", type: "Thickener, Emulsifier" },
    "E466": { name: "Carboxymethylcellulose (CMC)", type: "Thickener, Emulsifier" },
    "E470A": { name: "Sodium, Potassium and Calcium Salts of Fatty Acids", type: "Emulsifier, Stabilizer" },
    "E471": { name: "Mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472A": { name: "Acetic acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472B": { name: "Lactic acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472C": { name: "Citric acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472E": { name: "Diacetyltartaric acid esters of mono- and diglycerides of fatty acids (DATEM)", type: "Emulsifier" },
    "E473": { name: "Sucrose esters of fatty acids", type: "Emulsifier" },
    "E476": { name: "Polyglycerol Polyricinoleate (PGPR)", type: "Emulsifier" },
    "E481": { name: "Sodium Stearoyl Lactylate", type: "Emulsifier" },
    "E491": { name: "Sorbitan Monostearate", type: "Emulsifier" },
    "E500": { name: "Sodium Carbonates (Baking Soda)", type: "Raising Agent, Acidity Regulator" },
    "E501": { name: "Potassium Carbonates", type: "Raising Agent, Acidity Regulator" },
    "E503": { name: "Ammonium Carbonates", type: "Raising Agent" },
    "E504": { name: "Magnesium Carbonates", type: "Anti-caking agent" },
    "E507": { name: "Hydrochloric Acid", type: "Acidity Regulator" },
    "E508": { name: "Potassium Chloride", type: "Gelling Agent, Stabilizer" },
    "E509": { name: "Calcium Chloride", type: "Firming Agent" },
    "E514": { name: "Sodium Sulphates", type: "Acidity Regulator" },
    "E524": { name: "Sodium Hydroxide", type: "Acidity Regulator" },
    "E620": { name: "Glutamic Acid", type: "Flavor Enhancer" },
    "E621": { name: "Monosodium Glutamate (MSG)", type: "Flavor Enhancer" },
    "E622": { name: "Monopotassium Glutamate", type: "Flavor Enhancer" },
    "E627": { name: "Disodium Guanylate", type: "Flavor Enhancer" },
    "E631": { name: "Disodium Inosinate", type: "Flavor Enhancer" },
    "E635": { name: "Disodium 5'-ribonucleotides", type: "Flavor Enhancer" },
    "E900": { name: "Dimethylpolysiloxane", type: "Anti-foaming agent" },
    "E901": { name: "Beeswax", type: "Glazing agent" },
    "E903": { name: "Carnauba Wax", type: "Glazing agent" },
    "E904": { name: "Shellac", type: "Glazing agent" },
    "E920": { name: "L-Cysteine", type: "Flour Treatment Agent" },
    "E941": { name: "Nitrogen", type: "Packaging Gas" },
    "E948": { name: "Oxygen", type: "Packaging Gas" },
    "E950": { name: "Acesulfame K", type: "Sweetener" },
    "E951": { name: "Aspartame", type: "Sweetener" },
    "E953": { name: "Isomalt", type: "Sweetener" },
    "E954": { name: "Saccharins", type: "Sweetener" },
    "E955": { name: "Sucralose", type: "Sweetener" },
    "E960": { name: "Steviol Glycosides (Stevia)", type: "Sweetener" },
    "E965": { name: "Maltitol", type: "Sweetener" },
    "E966": { name: "Lactitol", type: "Sweetener" },
    "E967": { name: "Xylitol", type: "Sweetener" },
    "E968": { name: "Erythritol", type: "Sweetener" },
    "E1200": { name: "Polydextrose", type: "Bulking Agent, Stabilizer" },
    "E1400": { name: "Dextrin", type: "Thickener, Stabilizer" },
    "E1412": { name: "Distarch Phosphate", type: "Thickener, Stabilizer" },
    "E1414": { name: "Acetylated Distarch Phosphate", type: "Thickener, Stabilizer" },
    "E1420": { name: "Acetylated Starch", type: "Thickener, Stabilizer" },
    "E1422": { name: "Acetylated Distarch Adipate", type: "Thickener, Stabilizer" },
    "E1440": { name: "Hydroxypropyl Starch", type: "Thickener, Stabilizer" },
    "E1442": { name: "Hydroxypropyl Distarch Phosphate", type: "Thickener, Stabilizer" },
    "E1450": { name: "Starch Sodium Octenylsuccinate", type: "Emulsifier, Stabilizer" },
    "E1451": { name: "Acetylated Oxidised Starch", type: "Thickener, Stabilizer" },
    "E1518": { name: "Glycerol Triacetate (Triacetin)", type: "Humectant, Solvent" }
};


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
    const cleanedTag = tag.replace(/^en:/, '').toUpperCase(); // E.g., "E262" or "LECITHINS"
    const additiveInfo = additiveMap[cleanedTag]; // Look up in our map (additiveMap should be at the top of your server.js)

    if (additiveInfo) {
        // **THIS IS THE CORRECTED LINE to show Name (Type) without E-number**
        return `${additiveInfo.name} (${additiveInfo.type})`;
    } else if (cleanedTag.startsWith('E')) {
        // If it's an E-number but not in our map, display as "E-number (Unknown Type)"
        return `${cleanedTag} (Unknown Type)`;
    } else {
        // If it's not an E-number (e.g., a common name like "SOY-LECITHIN" not in map)
        return `${cleanedTag} (Uncategorized Additive)`;
    }
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