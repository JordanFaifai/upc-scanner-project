const express = require('express');
const fetch = require('node-fetch'); // Used to make requests to the Open Food Facts API
const path = require('path'); // Node.js built-in module for path manipulation

const app = express();
const PORT = process.env.PORT || 3000; // Your server will run on port 3000 by default

// Serve static files (your HTML, CSS, client-side JS) from the current directory
// This makes your index.html and client.js available to the browser
app.use(express.static(__dirname));

// --- BEGIN ADDITIVE MAP ---
// This additiveMap is constructed from the comprehensive list you provided.
// It includes E-number, name, type, and EU ban status.
const additiveMap = {
    'E100': { name: 'Curcumin', type: 'Color', status: 'Not banned in EU' },
    'E101': { name: 'Riboflavin', type: 'Color', status: 'Not banned in EU' },
    'E102': { name: 'Tartrazine', type: 'Color', status: 'Not banned in EU (requires warning for potential effects on children)' },
    'E104': { name: 'Quinoline Yellow', type: 'Color', status: 'Not banned in EU (requires warning for potential effects on children)' },
    'E110': { name: 'Sunset Yellow FCF', type: 'Color', status: 'Not banned in EU (requires warning for potential effects on children)' },
    'E120': { name: 'Cochineal, Carminic Acid, Carmines', type: 'Color', status: 'Not banned in EU' },
    'E122': { name: 'Azorubine, Carmoisine', type: 'Color', status: 'Not banned in EU (requires warning for potential effects on children)' },
    'E123': { name: 'Amaranth', type: 'Color', status: 'Not banned in EU' },
    'E124': { name: 'Ponceau 4R, Cochineal Red A', type: 'Color', status: 'Not banned in EU (requires warning for potential effects on children)' },
    'E129': { name: 'Allura Red AC', type: 'Color', status: 'Not banned in EU (requires warning for potential effects on children)' },
    'E131': { name: 'Patent Blue V', type: 'Color', status: 'Not banned in EU' },
    'E132': { name: 'Indigotine, Indigo Carmine', type: 'Color', status: 'Not banned in EU' },
    'E133': { name: 'Brilliant Blue FCF', type: 'Color', status: 'Not banned in EU' },
    'E140': { name: 'Chlorophylls, Chlorophyllins', type: 'Color', status: 'Not banned in EU' },
    'E141': { name: 'Copper Complexes of Chlorophylls', type: 'Color', status: 'Not banned in EU' },
    'E142': { name: 'Green S', type: 'Color', status: 'Not banned in EU' },
    'E150a': { name: 'Plain Caramel', type: 'Color', status: 'Not banned in EU' },
    'E150b': { name: 'Caustic Sulphite Caramel', type: 'Color', status: 'Not banned in EU' },
    'E150c': { name: 'Ammonia Caramel', type: 'Color', status: 'Not banned in EU' },
    'E150d': { name: 'Sulphite Ammonia Caramel', type: 'Color', status: 'Not banned in EU' },
    'E151': { name: 'Brilliant Black BN', type: 'Color', status: 'Not banned in EU' },
    'E153': { name: 'Vegetable Carbon', type: 'Color', status: 'Not banned in EU' },
    'E160a': { name: 'Carotenes', type: 'Color', status: 'Not banned in EU' },
    'E160b': { name: 'Annatto, Bixin, Norbixin', type: 'Color', status: 'Not banned in EU' },
    'E160c': { name: 'Paprika Extract, Capsanthin, Capsorubin', type: 'Color', status: 'Not banned in EU' },
    'E160d': { name: 'Lycopene', type: 'Color', status: 'Not banned in EU' },
    'E161b': { name: 'Lutein', type: 'Color', status: 'Not banned in EU' },
    'E162': { name: 'Beetroot Red, Betanin', type: 'Color', status: 'Not banned in EU' },
    'E163': { name: 'Anthocyanins', type: 'Color', status: 'Not banned in EU' },
    'E170': { name: 'Calcium Carbonate', type: 'Color, Acidity Regulator', status: 'Not banned in EU' },
    'E171': { name: 'Titanium Dioxide', type: 'Color', status: 'Banned in EU (since August 7, 2022)' },
    'E172': { name: 'Iron Oxides and Hydroxides', type: 'Color', status: 'Not banned in EU' },
    'E173': { name: 'Aluminium', type: 'Color', status: 'Not banned in EU' },
    'E174': { name: 'Silver', type: 'Color', status: 'Not banned in EU' },
    'E175': { name: 'Gold', type: 'Color', status: 'Not banned in EU' },
    'E200': { name: 'Sorbic Acid', type: 'Preservative', status: 'Not banned in EU' },
    'E202': { name: 'Potassium Sorbate', type: 'Preservative', status: 'Not banned in EU' },
    'E203': { name: 'Calcium Sorbate', type: 'Preservative', status: 'Not banned in EU' },
    'E210': { name: 'Benzoic Acid', type: 'Preservative', status: 'Not banned in EU' },
    'E211': { name: 'Sodium Benzoate', type: 'Preservative', status: 'Not banned in EU' },
    'E212': { name: 'Potassium Benzoate', type: 'Preservative', status: 'Not banned in EU' },
    'E213': { name: 'Calcium Benzoate', type: 'Preservative', status: 'Not banned in EU' },
    'E214': { name: 'Ethyl p-Hydroxybenzoate', type: 'Preservative', status: 'Not banned in EU' },
    'E215': { name: 'Sodium Ethyl p-Hydroxybenzoate', type: 'Preservative', status: 'Not banned in EU' },
    'E216': { name: 'Propylparaben', type: 'Preservative', status: 'Banned in EU' },
    'E217': { name: 'Sodium Propylparaben', type: 'Preservative', status: 'Banned in EU' },
    'E218': { name: 'Methyl p-Hydroxybenzoate', type: 'Preservative', status: 'Not banned in EU' },
    'E219': { name: 'Sodium Methyl p-Hydroxybenzoate', type: 'Preservative', status: 'Not banned in EU' },
    'E220': { name: 'Sulphur Dioxide', type: 'Preservative', status: 'Not banned in EU' },
    'E221': { name: 'Sodium Sulphite', type: 'Preservative', status: 'Not banned in EU' },
    'E222': { name: 'Sodium Bisulphite', type: 'Preservative', status: 'Not banned in EU' },
    'E223': { name: 'Sodium Metabisulphite', type: 'Preservative', status: 'Not banned in EU' },
    'E224': { name: 'Potassium Metabisulphite', type: 'Preservative', status: 'Not banned in EU' },
    'E226': { name: 'Calcium Sulphite', type: 'Preservative', status: 'Not banned in EU' },
    'E227': { name: 'Calcium Bisulphite', type: 'Preservative', status: 'Not banned in EU' },
    'E228': { name: 'Potassium Bisulphite', type: 'Preservative', status: 'Not banned in EU' },
    'E249': { name: 'Potassium Nitrite', type: 'Preservative', status: 'Not banned in EU' },
    'E250': { name: 'Sodium Nitrite', type: 'Preservative', status: 'Not banned in EU' },
    'E251': { name: 'Sodium Nitrate', type: 'Preservative', status: 'Not banned in EU' },
    'E252': { name: 'Potassium Nitrate', type: 'Preservative', status: 'Not banned in EU' },
    'E270': { name: 'Lactic Acid', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E280': { name: 'Propionic Acid', type: 'Preservative', status: 'Not banned in EU' },
    'E281': { name: 'Sodium Propionate', type: 'Preservative', status: 'Not banned in EU' },
    'E282': { name: 'Calcium Propionate', type: 'Preservative', status: 'Not banned in EU' },
    'E283': { name: 'Potassium Propionate', type: 'Preservative', status: 'Not banned in EU' },
    'E284': { name: 'Boric Acid', type: 'Preservative', status: 'Not banned in EU' },
    'E285': { name: 'Sodium Tetraborate (Borax)', type: 'Preservative', status: 'Not banned in EU' },
    'E300': { name: 'Ascorbic Acid (Vitamin C)', type: 'Antioxidant', status: 'Not banned in EU' },
    'E301': { name: 'Sodium Ascorbate', type: 'Antioxidant', status: 'Not banned in EU' },
    'E302': { name: 'Calcium Ascorbate', type: 'Antioxidant', status: 'Not banned in EU' },
    'E304': { name: 'Fatty Acid Esters of Ascorbic Acid', type: 'Antioxidant', status: 'Not banned in EU' },
    'E306': { name: 'Tocopherols', type: 'Antioxidant', status: 'Not banned in EU' },
    'E307': { name: 'Alpha-Tocopherol', type: 'Antioxidant', status: 'Not banned in EU' },
    'E308': { name: 'Gamma-Tocopherol', type: 'Antioxidant', status: 'Not banned in EU' },
    'E309': { name: 'Delta-Tocopherol', type: 'Antioxidant', status: 'Not banned in EU' },
    'E310': { name: 'Propyl Gallate', type: 'Antioxidant', status: 'Not banned in EU' },
    'E311': { name: 'Octyl Gallate', type: 'Antioxidant', status: 'Not banned in EU' },
    'E312': { name: 'Dodecyl Gallate', type: 'Antioxidant', status: 'Not banned in EU' },
    'E315': { name: 'Erythorbic Acid', type: 'Antioxidant', status: 'Not banned in EU' },
    'E316': { name: 'Sodium Erythorbate', type: 'Antioxidant', status: 'Not banned in EU' },
    'E320': { name: 'Butylated Hydroxyanisole (BHA)', type: 'Antioxidant', status: 'Not banned in EU' },
    'E321': { name: 'Butylated Hydroxytoluene (BHT)', type: 'Antioxidant', status: 'Not banned in EU' },
    'E322': { name: 'Lecithins', type: 'Emulsifier', status: 'Not banned in EU' },
    'E330': { name: 'Citric Acid', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E331': { name: 'Sodium Citrates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E332': { name: 'Potassium Citrates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E333': { name: 'Calcium Citrates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E334': { name: 'Tartaric Acid', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E335': { name: 'Sodium Tartrates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E336': { name: 'Potassium Tartrates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E337': { name: 'Sodium Potassium Tartrate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E338': { name: 'Phosphoric Acid', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E339': { name: 'Sodium Phosphates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E340': { name: 'Potassium Phosphates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E341': { name: 'Calcium Phosphates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E400': { name: 'Alginic Acid', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E401': { name: 'Sodium Alginate', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E402': { name: 'Potassium Alginate', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E403': { name: 'Ammonium Alginate', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E404': { name: 'Calcium Alginate', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E405': { name: 'Propane-1,2-Diol Alginate', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E406': { name: 'Agar', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E407': { name: 'Carrageenan', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E410': { name: 'Locust Bean Gum', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E412': { name: 'Guar Gum', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E413': { name: 'Tragacanth', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E414': { name: 'Acacia Gum (Gum Arabic)', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E415': { name: 'Xanthan Gum', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E416': { name: 'Karaya Gum', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E417': { name: 'Tara Gum', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E418': { name: 'Gellan Gum', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E420': { name: 'Sorbitol', type: 'Sweetener, Humectant', status: 'Not banned in EU' },
    'E421': { name: 'Mannitol', type: 'Sweetener, Humectant', status: 'Not banned in EU' },
    'E422': { name: 'Glycerol', type: 'Humectant', status: 'Not banned in EU' },
    'E425': { name: 'Konjac Gum', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E432': { name: 'Polyoxyethylene Sorbitan Monolaurate (Polysorbate 20)', type: 'Emulsifier', status: 'Not banned in EU' },
    'E433': { name: 'Polyoxyethylene Sorbitan Monooleate (Polysorbate 80)', type: 'Emulsifier', status: 'Not banned in EU' },
    'E434': { name: 'Polyoxyethylene Sorbitan Monopalmitate (Polysorbate 40)', type: 'Emulsifier', status: 'Not banned in EU' },
    'E435': { name: 'Polyoxyethylene Sorbitan Monostearate (Polysorbate 60)', type: 'Emulsifier', status: 'Not banned in EU' },
    'E436': { name: 'Polyoxyethylene Sorbitan Tristearate (Polysorbate 65)', type: 'Emulsifier', status: 'Not banned in EU' },
    'E440': { name: 'Pectins', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E442': { name: 'Ammonium Phosphatides', type: 'Emulsifier', status: 'Not banned in EU' },
    'E443': { name: 'Brominated Vegetable Oil (BVO)', type: 'Emulsifier', status: 'Banned in EU' },
    'E444': { name: 'Sucrose Acetate Isobutyrate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E445': { name: 'Glycerol Esters of Wood Rosins', type: 'Emulsifier', status: 'Not banned in EU' },
    'E450': { name: 'Diphosphates', type: 'Acidity Regulator, Emulsifier', status: 'Not banned in EU' },
    'E451': { name: 'Triphosphates', type: 'Acidity Regulator, Emulsifier', status: 'Not banned in EU' },
    'E452': { name: 'Polyphosphates', type: 'Acidity Regulator, Emulsifier', status: 'Not banned in EU' },
    'E460': { name: 'Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E461': { name: 'Methyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E462': { name: 'Ethyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E463': { name: 'Hydroxypropyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E464': { name: 'Hydroxypropyl Methyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E465': { name: 'Ethyl Methyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E466': { name: 'Carboxymethyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E468': { name: 'Cross-Linked Sodium Carboxymethyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E469': { name: 'Enzymatically Hydrolysed Carboxymethyl Cellulose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E470a': { name: 'Sodium, Potassium, and Calcium Salts of Fatty Acids', type: 'Emulsifier, Stabilizer', status: 'Not banned in EU' },
    'E470b': { name: 'Magnesium Salts of Fatty Acids', type: 'Emulsifier, Stabilizer', status: 'Not banned in EU' },
    'E471': { name: 'Mono- and Diglycerides of Fatty Acids', type: 'Emulsifier, Stabilizer', status: 'Not banned in EU' },
    'E472a': { name: 'Acetic Acid Esters of Mono- and Diglycerides', type: 'Emulsifier, Stabilizer', status: 'Not banned in EU' },
    'E472b': { name: 'Lactic Acid Esters of Mono- and Diglycerides', type: 'Emulsifier, Stabilizer', status: 'Not banned in EU' },
    'E472c': { name: 'Citric Acid Esters of Mono- and Diglycerides', type: 'Emulsifier, Stabilizer', status: 'Not banned in EU' },
    'E472e': { name: 'Mono- and Diacetyl Tartaric Acid Esters of Mono- and Diglycerides', type: 'Emulsifier, Stabilizer', status: 'Not banned in EU' },
    'E473': { name: 'Sucrose Esters of Fatty Acids', type: 'Emulsifier', status: 'Not banned in EU' },
    'E474': { name: 'Sucroglycerides', type: 'Emulsifier', status: 'Not banned in EU' },
    'E475': { name: 'Polyglycerol Esters of Fatty Acids', type: 'Emulsifier', status: 'Not banned in EU' },
    'E476': { name: 'Polyglycerol Polyricinoleate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E477': { name: 'Propane-1,2-Diol Esters of Fatty Acids', type: 'Emulsifier', status: 'Not banned in EU' },
    'E479b': { name: 'Thermally Oxidized Soya Bean Oil', type: 'Emulsifier', status: 'Not banned in EU' },
    'E481': { name: 'Sodium Stearoyl-2-Lactylate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E482': { name: 'Calcium Stearoyl-2-Lactylate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E483': { name: 'Stearyl Tartrate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E491': { name: 'Sorbitan Monostearate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E492': { name: 'Sorbitan Tristearate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E493': { name: 'Sorbitan Monolaurate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E494': { name: 'Sorbitan Monooleate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E495': { name: 'Sorbitan Monopalmitate', type: 'Emulsifier', status: 'Not banned in EU' },
    'E500': { name: 'Sodium Carbonates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E501': { name: 'Potassium Carbonates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E503': { name: 'Ammonium Carbonates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E504': { name: 'Magnesium Carbonates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E507': { name: 'Hydrochloric Acid', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E508': { name: 'Potassium Chloride', type: 'Gelling Agent', status: 'Not banned in EU' },
    'E509': { name: 'Calcium Chloride', type: 'Gelling Agent', status: 'Not banned in EU' },
    'E511': { name: 'Magnesium Chloride', type: 'Gelling Agent', status: 'Not banned in EU' },
    'E513': { name: 'Sulphuric Acid', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E514': { name: 'Sodium Sulphates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E515': { name: 'Potassium Sulphates', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E516': { name: 'Calcium Sulphate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E520': { name: 'Aluminium Sulphate', type: 'Firming Agent', status: 'Not banned in EU' },
    'E521': { name: 'Aluminium Sodium Sulphate', type: 'Firming Agent', status: 'Not banned in EU' },
    'E522': { name: 'Aluminium Potassium Sulphate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E523': { name: 'Aluminium Ammonium Sulphate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E524': { name: 'Sodium Hydroxide', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E525': { name: 'Potassium Hydroxide', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E526': { name: 'Calcium Hydroxide', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E527': { name: 'Ammonium Hydroxide', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E528': { name: 'Magnesium Hydroxide', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E529': { name: 'Calcium Oxide', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E530': { name: 'Magnesium Oxide', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E535': { name: 'Sodium Ferrocyanide', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E536': { name: 'Potassium Ferrocyanide', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E538': { name: 'Calcium Ferrocyanide', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E541': { name: 'Sodium Aluminium Phosphate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E551': { name: 'Silicon Dioxide', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E552': { name: 'Calcium Silicate', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E553b': { name: 'Talc', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E554': { name: 'Sodium Aluminium Silicate', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E555': { name: 'Potassium Aluminium Silicate', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E558': { name: 'Bentonite', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E559': { name: 'Aluminium Silicate (Kaolin)', type: 'Anti-Caking Agent', status: 'Not banned in EU' },
    'E570': { name: 'Fatty Acids', type: 'Emulsifier', status: 'Not banned in EU' },
    'E574': { name: 'Gluconic Acid', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E575': { name: 'Glucono-Delta-Lactone', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E576': { name: 'Sodium Gluconate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E577': { name: 'Potassium Gluconate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E578': { name: 'Calcium Gluconate', type: 'Acidity Regulator', status: 'Not banned in EU' },
    'E585': { name: 'Ferrous Lactate', type: 'Color Retention Agent', status: 'Not banned in EU' },
    'E620': { name: 'Glutamic Acid', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E621': { name: 'Monosodium Glutamate (MSG)', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E622': { name: 'Monopotassium Glutamate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E623': { name: 'Calcium Diglutamate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E624': { name: 'Monoammonium Glutamate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E625': { name: 'Magnesium Diglutamate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E626': { name: 'Guanylic Acid', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E627': { name: 'Disodium Guanylate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E628': { name: 'Dipotassium Guanylate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E629': { name: 'Calcium Guanylate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E630': { name: 'Inosinic Acid', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E631': { name: 'Disodium Inosinate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E632': { name: 'Dipotassium Inosinate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E633': { name: 'Calcium Inosinate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E634': { name: 'Calcium 5\'-Ribonucleotides', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E635': { name: 'Disodium 5\'-Ribonucleotides', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E640': { name: 'Glycine and its Sodium Salt', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E650': { name: 'Zinc Acetate', type: 'Flavor Enhancer', status: 'Not banned in EU' },
    'E715': { name: 'Avoparcin', type: 'Antibiotic (Feed Additive)', status: 'Banned in EU' },
    'E900': { name: 'Dimethylpolysiloxane', type: 'Anti-Foaming Agent', status: 'Not banned in EU' },
    'E901': { name: 'Beeswax', type: 'Glazing Agent', status: 'Not banned in EU' },
    'E902': { name: 'Candelilla Wax', type: 'Glazing Agent', status: 'Not banned in EU' },
    'E903': { name: 'Carnauba Wax', type: 'Glazing Agent', status: 'Not banned in EU' },
    'E904': { name: 'Shellac', type: 'Glazing Agent', status: 'Not banned in EU' },
    'E905': { name: 'Paraffin', type: 'Glazing Agent', status: 'Not banned in EU' },
    'E912': { name: 'Montan Acid Esters', type: 'Glazing Agent', status: 'Not banned in EU' },
    'E914': { name: 'Oxidized Polyethylene Wax', type: 'Glazing Agent', status: 'Not banned in EU' },
    'E920': { name: 'L-Cysteine', type: 'Flour Treatment Agent', status: 'Not banned in EU' },
    'E924': { name: 'Potassium Bromate', type: 'Flour Treatment Agent', status: 'Banned in EU' },
    'E927a': { name: 'Azodicarbonamide', type: 'Flour Treatment Agent', status: 'Banned in EU' },
    'E950': { name: 'Acesulfame Potassium', type: 'Sweetener', status: 'Not banned in EU' },
    'E951': { name: 'Aspartame', type: 'Sweetener', status: 'Not banned in EU' },
    'E952': { name: 'Cyclamic Acid and its Salts', type: 'Sweetener', status: 'Not banned in EU' },
    'E953': { name: 'Isomalt', type: 'Sweetener', status: 'Not banned in EU' },
    'E954': { name: 'Saccharin and its Salts', type: 'Sweetener', status: 'Not banned in EU' },
    'E955': { name: 'Sucralose', type: 'Sweetener', status: 'Not banned in EU' },
    'E957': { name: 'Thaumatin', type: 'Sweetener', status: 'Not banned in EU' },
    'E959': { name: 'Neohesperidine DC', type: 'Sweetener', status: 'Not banned in EU' },
    'E960': { name: 'Steviol Glycosides', type: 'Sweetener', status: 'Not banned in EU' },
    'E961': { name: 'Neotame', type: 'Sweetener', status: 'Not banned in EU' },
    'E962': { name: 'Aspartame-Acesulfame Salt', type: 'Sweetener', status: 'Not banned in EU' },
    'E965': { name: 'Maltitol', type: 'Sweetener', status: 'Not banned in EU' },
    'E966': { name: 'Lactitol', type: 'Sweetener', status: 'Not banned in EU' },
    'E967': { name: 'Xylitol', type: 'Sweetener', status: 'Not banned in EU' },
    'E968': { name: 'Erythritol', type: 'Sweetener', status: 'Not banned in EU' },
    'E969': { name: 'Advantame', type: 'Sweetener', status: 'Not banned in EU' },
    'E999': { name: 'Quillaia Extract', type: 'Foaming Agent', status: 'Not banned in EU' },
    'E1103': { name: 'Invertase', type: 'Enzyme', status: 'Not banned in EU' },
    'E1105': { name: 'Lysozyme', type: 'Preservative', status: 'Not banned in EU' },
    'E1200': { name: 'Polydextrose', type: 'Thickener, Stabilizer', status: 'Not banned in EU' },
    'E1201': { name: 'Polyvinylpyrrolidone', type: 'Stabilizer', status: 'Not banned in EU' },
    'E1202': { name: 'Polyvinylpolypyrrolidone', type: 'Stabilizer', status: 'Not banned in EU' },
    'E1204': { name: 'Pullulan', type: 'Thickener', status: 'Not banned in EU' },
    'E1404': { name: 'Oxidized Starch', type: 'Thickener', status: 'Not banned in EU' },
    'E1410': { name: 'Monostarch Phosphate', type: 'Thickener', status: 'Not banned in EU' },
    'E1412': { name: 'Distarch Phosphate', type: 'Thickener', status: 'Not banned in EU' },
    'E1413': { name: 'Phosphated Distarch Phosphate', type: 'Thickener', status: 'Not banned in EU' },
    'E1414': { name: 'Acetylated Distarch Phosphate', type: 'Thickener', status: 'Not banned in EU' },
    'E1420': { name: 'Acetylated Starch', type: 'Thickener', status: 'Not banned in EU' },
    'E1422': { name: 'Acetylated Distarch Adipate', type: 'Thickener', status: 'Not banned in EU' },
    'E1440': { name: 'Hydroxypropyl Starch', type: 'Thickener', status: 'Not banned in EU' },
    'E1442': { name: 'Hydroxypropyl Distarch Phosphate', type: 'Thickener', status: 'Not banned in EU' },
    'E1450': { name: 'Starch Sodium Octenyl Succinate', type: 'Thickener', status: 'Not banned in EU' },
    'E1451': { name: 'Acetylated Oxidized Starch', type: 'Thickener', status: 'Not banned in EU' },
    'E1452': { name: 'Starch Aluminium Octenyl Succinate', type: 'Thickener', status: 'Not banned in EU' },
    'E1505': { name: 'Triethyl Citrate', type: 'Stabilizer', status: 'Not banned in EU' },
    'E1518': { name: 'Glyceryl Triacetate (Triacetin)', type: 'Humectant', status: 'Not banned in EU' },
    'E1520': { name: 'Propylene Glycol', type: 'Humectant', status: 'Not banned in EU' }
};
// --- END ADDITIVE MAP ---

// Helper function to normalize additive codes for lookup
function normalizeAdditiveCode(code) {
    if (!code) return '';
    let normalized = code.replace(/^en:/, '').toUpperCase();
    const eNumberMatch = normalized.match(/^(E\d+)([A-Z]*)?(?:\(|\s)*([IVXLC\d]*)?(?:\)|\s)*$/i);
    if (eNumberMatch) {
        // Return only the E-number part (e.g., "E500" from "E500II" or "E330i")
        return eNumberMatch[1];
    }
    return normalized; // Return as is if no E-number pattern is found
}

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
                    const normalizedENumber = normalizeAdditiveCode(tag);
                    const additiveInfo = additiveMap[normalizedENumber];
                    if (additiveInfo && additiveInfo.name) {
                        detectedAdditiveNames.add(additiveInfo.name);
                    }
                });

                if (detectedAdditiveNames.size > 0) {
                    novaExplanation = baseNova4Explanation + ` They often contain additives like: ${Array.from(detectedAdditiveNames).join(', ')}.`;
                } else {
                    novaExplanation = baseNova4Explanation;
                }
                break;
            default:
                novaExplanation = "NOVA Group information is not available for this product.";
        }


        // --- ALLERGENS ---
        const allergens = (product.allergens_tags || [])
            .map(tag => tag.replace(/^en:/, '').replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
            .filter(allergen => allergen.trim() !== ''); // Filter out empty strings


        // --- ADDITIVES ---
        // Process additive tags to get detailed info from additiveMap
        const rawAdditivesTags = product.additives_tags || [];
        const processedAdditives = rawAdditivesTags.map(tag => {
            const normalizedTag = normalizeAdditiveCode(tag);
            const additiveInfo = additiveMap[normalizedTag];
            if (additiveInfo) {
                return {
                    name: additiveInfo.name,
                    eNumber: normalizedTag, // Use the normalized E-number
                    type: additiveInfo.type,
                    status: additiveInfo.status
                };
            } else {
                // Fallback for unknown additives, retaining the original tag
                return {
                    name: tag.toUpperCase().replace(/^EN:/, ''),
                    eNumber: tag.toUpperCase().replace(/^EN:/, ''),
                    type: 'Unknown Type',
                    status: 'Details for this additive are not in our database.'
                };
            }
        });

        // --- NUTRITION FACTS (Simplified) ---
        const nutriments = product.nutriments || {};
        const nutrition_facts = {
            energy_kcal: nutriments['energy-kcal_100g'] || 'N/A',
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
    console.log(`Server running on http://localhost:${PORT}`);
});