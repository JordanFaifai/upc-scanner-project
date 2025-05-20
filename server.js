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
    "E160AI": { name: "Beta-carotene", type: "Color" },
    "E160AII": { name: "Alpha-carotene", type: "Color" },
    "E160AIII": { name: "Gamma-carotene", type: "Color" },
    "E160B": { name: "Annatto, Bixin, Norbixin", type: "Color" },
    "E160C": { name: "Paprika Extract, Capsanthin, Capsorubin", type: "Color" },
    "E160D": { name: "Lycopene", type: "Color" },
    "E160E": { name: "Beta-apo-8'-carotenal (C30)", type: "Color" },
    "E161B": { name: "Lutein", type: "Color" },
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
    "E217": { name: "Sodium propyl para-hydroxybenzoate", type: "Preservative" },
    "E218": { name: "Methylparaben", type: "Preservative" },
    "E219": { name: "Sodium methyl para-hydroxybenzoate", type: "Preservative" },
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
    "E262I": { name: "Sodium Acetate", type: "Acidity Regulator" }, // Added for E262I
    "E262II": { name: "Sodium Diacetate", type: "Preservative, Acidity Regulator" }, // Added for E262II (slightly different)
    "E263": { name: "Calcium Acetate", type: "Acidity Regulator" },
    "E270": { name: "Lactic Acid", type: "Acidity Regulator" },
    "E280": { name: "Propionic Acid", type: "Preservative" },
    "E281": { name: "Sodium Propionate", type: "Preservative" },
    "E282": { name: "Calcium Propionate", type: "Preservative" },
    "E283": { name: "Potassium Propionate", type: "Preservative" },
    "E290": { name: "Carbon Dioxide", type: "Propellant, Acidity Regulator" },
    "E296": { name: "Malic Acid", type: "Acidity Regulator" },
    "E297": { name: "Fumaric Acid", type: "Acidity Regulator" },
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
    "E331I": { name: "Monosodium Citrate", type: "Acidity Regulator" },
    "E331II": { name: "Disodium Citrate", type: "Acidity Regulator" },
    "E331III": { name: "Trisodium Citrate", type: "Acidity Regulator" },
    "E332": { name: "Potassium Citrates", type: "Acidity Regulator" },
    "E332I": { name: "Monopotassium Citrate", type: "Acidity Regulator" },
    "E332II": { name: "Dipotassium Citrate", type: "Acidity Regulator" },
    "E333": { name: "Calcium Citrates", type: "Acidity Regulator" },
    "E333I": { name: "Monocalcium Citrate", type: "Acidity Regulator" },
    "E333II": { name: "Dicalcium Citrate", type: "Acidity Regulator" },
    "E333III": { name: "Tricalcium Citrate", type: "Acidity Regulator" },
    "E334": { name: "Tartaric Acid", type: "Acidity Regulator" },
    "E335": { name: "Sodium Tartrates", type: "Acidity Regulator" },
    "E336": { name: "Potassium Tartrates", type: "Acidity Regulator" },
    "E337": { name: "Potassium Sodium Tartrate", type: "Acidity Regulator" },
    "E338": { name: "Phosphoric Acid", type: "Acidity Regulator" },
    "E339": { name: "Sodium Phosphates", type: "Acidity Regulator" },
    "E339I": { name: "Monosodium Phosphate", type: "Acidity Regulator" },
    "E339II": { name: "Disodium Phosphate", type: "Acidity Regulator" },
    "E339III": { name: "Trisodium Phosphate", type: "Acidity Regulator" },
    "E340": { name: "Potassium Phosphates", type: "Acidity Regulator" },
    "E340I": { name: "Monopotassium Phosphate", type: "Acidity Regulator" },
    "E340II": { name: "Dipotassium Phosphate", type: "Acidity Regulator" },
    "E340III": { name: "Tripotassium Phosphate", type: "Acidity Regulator" },
    "E341": { name: "Calcium Phosphates", type: "Acidity Regulator, Anti-caking agent" },
    "E341I": { name: "Monocalcium Phosphate", type: "Acidity Regulator, Leavening agent" }, // Added for E341I
    "E341II": { name: "Dicalcium Phosphate", type: "Acidity Regulator, Anti-caking agent" },
    "E341III": { name: "Tricalcium Phosphate", type: "Acidity Regulator, Anti-caking agent" },
    "E354": { name: "Calcium Tartrate", type: "Acidity Regulator" },
    "E355": { name: "Adipic Acid", type: "Acidity Regulator" },
    "E363": { name: "Succinic Acid", type: "Acidity Regulator" },
    "E385": { name: "Calcium Disodium EDTA", type: "Antioxidant" },
    "E400": { name: "Alginic Acid", type: "Thickener, Stabilizer" },
    "E401": { name: "Sodium Alginate", type: "Thickener, Stabilizer" },
    "E402": { name: "Potassium Alginate", type: "Thickener, Stabilizer" },
    "E403": { name: "Ammonium Alginate", type: "Thickener, Stabilizer" },
    "E404": { name: "Calcium Alginate", type: "Thickener, Stabilizer" },
    "E405": { name: "Propane-1,2-diol Alginate (PGA)", type: "Thickener, Stabilizer" },
    "E406": { name: "Agar", type: "Thickener, Gelling Agent" },
    "E407": { name: "Carrageenan", type: "Thickener, Stabilizer" },
    "E407A": { name: "Processed Eucheuma Seaweed (PES)", type: "Thickener, Stabilizer" },
    "E410": { name: "Locust Bean Gum", type: "Thickener, Stabilizer" },
    "E412": { name: "Guar Gum", type: "Thickener, Stabilizer" },
    "E413": { name: "Tragacanth Gum", type: "Thickener, Stabilizer" },
    "E414": { name: "Acacia Gum (Gum Arabic)", type: "Thickener, Stabilizer" },
    "E415": { name: "Xanthan Gum", type: "Thickener, Stabilizer" },
    "E416": { name: "Karaya Gum", type: "Thickener, Stabilizer" },
    "E417": { name: "Tara Gum", type: "Thickener, Stabilizer" },
    "E418": { name: "Gellan Gum", type: "Thickener, Stabilizer" },
    "E420": { name: "Sorbitol", type: "Sweetener, Humectant" },
    "E420I": { name: "Sorbitol", type: "Sweetener, Humectant" },
    "E420II": { name: "Sorbitol Syrup", type: "Sweetener, Humectant" },
    "E421": { name: "Mannitol", type: "Sweetener, Humectant" },
    "E422": { name: "Glycerol", type: "Humectant, Thickener" },
    "E428": { name: "Gelatin", type: "Thickener, Gelling Agent" },
    "E432": { name: "Polyoxyethylene Sorbitan Monolaurate (Polysorbate 20)", type: "Emulsifier" },
    "E433": { name: "Polyoxyethylene Sorbitan Monooleate (Polysorbate 80)", type: "Emulsifier" },
    "E435": { name: "Polyoxyethylene Sorbitan Monostearate (Polysorbate 60)", type: "Emulsifier" },
    "E436": { name: "Polyoxyethylene Sorbitan Tristearate (Polysorbate 65)", type: "Emulsifier" },
    "E440": { name: "Pectins", type: "Thickener, Gelling Agent" },
    "E440I": { name: "Pectin", type: "Thickener, Gelling Agent" },
    "E440II": { name: "Amidated Pectin", type: "Thickener, Gelling Agent" },
    "E442": { name: "Ammonium Phosphatides", type: "Emulsifier" },
    "E444": { name: "Sucrose Acetate Isobutyrate (SAIB)", type: "Emulsifier, Stabilizer" },
    "E445": { name: "Glycerol Esters of Wood Rosins", type: "Emulsifier, Stabilizer" },
    "E450": { name: "Diphosphates", type: "Emulsifier, Stabilizer" },
    "E450I": { name: "Disodium Diphosphate", type: "Raising Agent, Emulsifier" },
    "E450II": { name: "Trisodium Diphosphate", type: "Emulsifier" },
    "E450III": { name: "Tetrasodium Diphosphate", type: "Emulsifier" },
    "E450IV": { name: "Dipotassium Diphosphate", type: "Emulsifier" },
    "E450V": { name: "Tetrapotassium Diphosphate", type: "Emulsifier" },
    "E450VI": { name: "Dicalcium Diphosphate", type: "Emulsifier" },
    "E450VII": { name: "Calcium Dihydrogen Diphosphate", type: "Emulsifier" },
    "E451": { name: "Triphosphates", type: "Emulsifier, Stabilizer" },
    "E451I": { name: "Pentasodium Triphosphate", type: "Emulsifier" },
    "E451II": { name: "Pentapotassium Triphosphate", type: "Emulsifier" },
    "E452": { name: "Polyphosphates", type: "Emulsifier, Stabilizer" },
    "E452I": { name: "Sodium Polyphosphate", type: "Emulsifier" },
    "E452II": { name: "Potassium Polyphosphate", type: "Emulsifier" },
    "E452III": { name: "Calcium Polyphosphate", type: "Emulsifier" },
    "E459": { name: "Beta-cyclodextrin", type: "Emulsifier, Stabilizer" },
    "E460": { name: "Cellulose", type: "Thickener, Emulsifier" },
    "E460I": { name: "Microcrystalline Cellulose", type: "Thickener, Bulking agent" },
    "E460II": { name: "Powdered Cellulose", type: "Thickener, Bulking agent" },
    "E461": { name: "Methylcellulose", type: "Thickener, Emulsifier" },
    "E463": { name: "Hydroxypropylcellulose", type: "Thickener, Emulsifier" },
    "E464": { name: "Hydroxypropyl Methylcellulose (HPMC)", type: "Thickener, Emulsifier" },
    "E465": { name: "Ethylmethylcellulose", type: "Thickener, Emulsifier" },
    "E466": { name: "Carboxymethylcellulose (CMC)", type: "Thickener, Emulsifier" },
    "E468": { name: "Crosslinked Sodium Carboxymethylcellulose", type: "Thickener, Emulsifier" },
    "E469": { name: "Enzymatically Hydrolysed Carboxymethylcellulose", type: "Thickener, Emulsifier" },
    "E470A": { name: "Sodium, Potassium and Calcium Salts of Fatty Acids", type: "Emulsifier, Stabilizer" },
    "E470B": { name: "Magnesium Salts of Fatty Acids", type: "Emulsifier, Stabilizer" },
    "E471": { name: "Mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472A": { name: "Acetic acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472B": { name: "Lactic acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472C": { name: "Citric acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472D": { name: "Tartaric acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E472E": { name: "Diacetyltartaric acid esters of mono- and diglycerides of fatty acids (DATEM)", type: "Emulsifier" },
    "E472F": { name: "Mixed acetic and tartaric acid esters of mono- and diglycerides of fatty acids", type: "Emulsifier" },
    "E473": { name: "Sucrose esters of fatty acids", type: "Emulsifier" },
    "E474": { name: "Sucroglycerides", type: "Emulsifier" },
    "E475": { name: "Polyglycerol Esters of Fatty Acids", type: "Emulsifier" },
    "E476": { name: "Polyglycerol Polyricinoleate (PGPR)", type: "Emulsifier" },
    "E477": { name: "Propane-1,2-diol Esters of Fatty Acids", type: "Emulsifier" },
    "E479B": { name: "Thermally Oxidized Soya Bean Oil interacted with Mono- and Diglycerides of Fatty Acids", type: "Emulsifier" },
    "E481": { name: "Sodium Stearoyl Lactylate", type: "Emulsifier" },
    "E482": { name: "Calcium Stearoyl Lactylate", type: "Emulsifier" },
    "E483": { name: "Sorbitan Monostearate", type: "Emulsifier" },
    "E491": { name: "Sorbitan Monostearate", type: "Emulsifier" },
    "E492": { name: "Sorbitan Tristearate", type: "Emulsifier" },
    "E493": { name: "Sorbitan Monolaurate", type: "Emulsifier" },
    "E494": { name: "Sorbitan Monooleate", type: "Emulsifier" },
    "E495": { name: "Sorbitan Monopalmitate", type: "Emulsifier" },
    "E500": { name: "Sodium Carbonates (Baking Soda)", type: "Raising Agent, Acidity Regulator" },
    "E500I": { name: "Sodium Carbonate", type: "Raising Agent, Acidity Regulator" },
    "E500II": { name: "Sodium Hydrogen Carbonate (Baking Soda)", type: "Raising Agent, Acidity Regulator" },
    "E500III": { name: "Sodium Sesquicarbonate", type: "Raising Agent, Acidity Regulator" },
    "E501": { name: "Potassium Carbonates", type: "Raising Agent, Acidity Regulator" },
    "E501I": { name: "Potassium Carbonate", type: "Raising Agent, Acidity Regulator" },
    "E501II": { name: "Potassium Hydrogen Carbonate", type: "Raising Agent, Acidity Regulator" },
    "E503": { name: "Ammonium Carbonates", type: "Raising Agent" },
    "E503I": { name: "Ammonium Carbonate", type: "Raising Agent" },
    "E503II": { name: "Ammonium Hydrogen Carbonate", type: "Raising Agent" },
    "E504": { name: "Magnesium Carbonates", type: "Anti-caking agent" },
    "E504I": { name: "Magnesium Carbonate", type: "Anti-caking agent" },
    "E507": { name: "Hydrochloric Acid", type: "Acidity Regulator" },
    "E508": { name: "Potassium Chloride", type: "Gelling Agent, Stabilizer" },
    "E509": { name: "Calcium Chloride", type: "Firming Agent" },
    "E511": { name: "Magnesium Chloride", type: "Firming Agent" },
    "E512": { name: "Tin(II) Chloride", type: "Antioxidant" },
    "E513": { name: "Sulphuric Acid", type: "Acidity Regulator" },
    "E514": { name: "Sodium Sulphates", type: "Acidity Regulator" },
    "E514I": { name: "Sodium Sulphate", type: "Acidity Regulator" },
    "E514II": { name: "Sodium Hydrogen Sulphate", type: "Acidity Regulator" },
    "E515": { name: "Potassium Sulphates", type: "Acidity Regulator" },
    "E515I": { name: "Potassium Sulphate", type: "Acidity Regulator" },
    "E515II": { name: "Potassium Hydrogen Sulphate", type: "Acidity Regulator" },
    "E516": { name: "Calcium Sulphate", type: "Sequestrant, Firming Agent" },
    "E517": { name: "Ammonium Sulphate", type: "Flour Treatment Agent" },
    "E520": { name: "Aluminium Sulphate", type: "Firming Agent" },
    "E521": { name: "Aluminium Sodium Sulphate", type: "Acidity Regulator" },
    "E522": { name: "Aluminium Potassium Sulphate", type: "Acidity Regulator" },
    "E523": { name: "Aluminium Ammonium Sulphate", type: "Acidity Regulator" },
    "E524": { name: "Sodium Hydroxide", type: "Acidity Regulator" },
    "E525": { name: "Potassium Hydroxide", type: "Acidity Regulator" },
    "E526": { name: "Calcium Hydroxide", type: "Acidity Regulator" },
    "E527": { name: "Ammonium Hydroxide", type: "Acidity Regulator" },
    "E528": { name: "Magnesium Hydroxide", type: "Acidity Regulator" },
    "E529": { name: "Calcium Oxide", type: "Acidity Regulator" },
    "E530": { name: "Magnesium Oxide", type: "Anti-caking agent" },
    "E535": { name: "Sodium Ferrocyanide", type: "Anti-caking agent" },
    "E536": { name: "Potassium Ferrocyanide", type: "Anti-caking agent" },
    "E538": { name: "Calcium Ferrocyanide", type: "Anti-caking agent" },
    "E540": { name: "Dicalcium Diphosphate", type: "Emulsifier" },
    "E541": { name: "Sodium Aluminium Phosphate", type: "Raising Agent" },
    "E541I": { name: "Acid Sodium Aluminium Phosphate", type: "Raising Agent" },
    "E541II": { name: "Basic Sodium Aluminium Phosphate", type: "Raising Agent" },
    "E551": { name: "Silicon Dioxide", type: "Anti-caking agent" },
    "E552": { name: "Calcium Silicate", type: "Anti-caking agent" },
    "E553A": { name: "Magnesium Silicate", type: "Anti-caking agent" },
    "E553B": { name: "Talc", type: "Anti-caking agent" },
    "E554": { name: "Sodium Aluminium Silicate", type: "Anti-caking agent" },
    "E555": { name: "Potassium Aluminium Silicate", type: "Anti-caking agent" },
    "E556": { name: "Calcium Aluminium Silicate", type: "Anti-caking agent" },
    "E558": { name: "Bentonite", type: "Anti-caking agent" },
    "E559": { name: "Aluminium Silicate (Kaolin)", type: "Anti-caking agent" },
    "E570": { name: "Fatty Acids", type: "Anti-caking agent" },
    "E572": { name: "Magnesium Stearate", type: "Anti-caking agent" },
    "E574": { name: "Gluconic Acid", type: "Acidity Regulator" },
    "E575": { name: "Glucono-delta-lactone (GDL)", type: "Acidity Regulator, Raising Agent" },
    "E576": { name: "Sodium Gluconate", type: "Acidity Regulator" },
    "E577": { name: "Potassium Gluconate", type: "Acidity Regulator" },
    "E578": { name: "Calcium Gluconate", type: "Acidity Regulator" },
    "E579": { name: "Ferrous Gluconate", type: "Color Stabilizer" },
    "E585": { name: "Ferrous Lactate", type: "Color Stabilizer" },
    "E620": { name: "Glutamic Acid", type: "Flavor Enhancer" },
    "E621": { name: "Monosodium Glutamate (MSG)", type: "Flavor Enhancer" },
    "E622": { name: "Monopotassium Glutamate", type: "Flavor Enhancer" },
    "E623": { name: "Calcium Diglutamate", type: "Flavor Enhancer" },
    "E624": { name: "Monoammonium Glutamate", type: "Flavor Enhancer" },
    "E625": { name: "Magnesium Diglutamate", type: "Flavor Enhancer" },
    "E626": { name: "Guanylic Acid", type: "Flavor Enhancer" },
    "E627": { name: "Disodium Guanylate", type: "Flavor Enhancer" },
    "E628": { name: "Dipotassium Guanylate", type: "Flavor Enhancer" },
    "E629": { name: "Calcium Guanylate", type: "Flavor Enhancer" },
    "E630": { name: "Inosinic Acid", type: "Flavor Enhancer" },
    "E631": { name: "Disodium Inosinate", type: "Flavor Enhancer" },
    "E632": { name: "Dipotassium Inosinate", type: "Flavor Enhancer" },
    "E633": { name: "Calcium Inosinate", type: "Flavor Enhancer" },
    "E634": { name: "Calcium 5'-ribonucleotides", type: "Flavor Enhancer" },
    "E635": { name: "Disodium 5'-ribonucleotides", type: "Flavor Enhancer" },
    "E640": { name: "Glycine and its Sodium Salt", type: "Flavor Enhancer" },
    "E650": { name: "Zinc Acetate", type: "Flavor Enhancer" },
    "E900": { name: "Dimethylpolysiloxane", type: "Anti-foaming agent" },
    "E901": { name: "Beeswax, white and yellow", type: "Glazing agent" },
    "E903": { name: "Carnauba Wax", type: "Glazing agent" },
    "E904": { name: "Shellac", type: "Glazing agent" },
    "E905": { name: "Microcrystalline Wax", type: "Glazing agent" },
    "E907": { name: "Hydrogenated Poly-1-decene", type: "Glazing agent" },
    "E912": { name: "Montan Acid Esters", type: "Glazing agent" },
    "E914": { name: "Oxidized Polyethylene Wax", type: "Glazing agent" },
    "E920": { name: "L-Cysteine", type: "Flour Treatment Agent" },
    "E927B": { name: "Carbamide (Urea)", type: "Flour Treatment Agent" },
    "E940": { name: "Dichlorodifluoromethane", type: "Propellant" },
    "E941": { name: "Nitrogen", type: "Packaging Gas" },
    "E942": { name: "Nitrous Oxide", type: "Propellant" },
    "E943A": { name: "Butane", type: "Propellant" },
    "E943B": { name: "Isobutane", type: "Propellant" },
    "E944": { name: "Propane", type: "Propellant" },
    "E948": { name: "Oxygen", type: "Packaging Gas" },
    "E949": { name: "Hydrogen", type: "Packaging Gas" },
    "E950": { name: "Acesulfame K", type: "Sweetener" },
    "E951": { name: "Aspartame", type: "Sweetener" },
    "E953": { name: "Isomalt", type: "Sweetener" },
    "E954": { name: "Saccharins", type: "Sweetener" },
    "E955": { name: "Sucralose", type: "Sweetener" },
    "E957": { name: "Thaumatin", type: "Sweetener" },
    "E959": { name: "Neohesperidine DC", type: "Sweetener" },
    "E960": { name: "Steviol Glycosides (Stevia)", type: "Sweetener" },
    "E961": { name: "Neotame", type: "Sweetener" },
    "E962": { name: "Aspartame-Acesulfame salt", type: "Sweetener" },
    "E965": { name: "Maltitol", type: "Sweetener" },
    "E965I": { name: "Maltitol", type: "Sweetener" },
    "E965II": { name: "Maltitol Syrup", type: "Sweetener" },
    "E966": { name: "Lactitol", type: "Sweetener" },
    "E967": { name: "Xylitol", type: "Sweetener" },
    "E968": { name: "Erythritol", type: "Sweetener" },
    "E969": { name: "Advantame", type: "Sweetener" },
    "E999": { name: "Quillaia extract", type: "Foaming agent" },
    "E1100": { name: "Alpha-amylase", type: "Flour Treatment Agent" },
    "E1101": { name: "Protease", type: "Flour Treatment Agent" },
    "E1102": { name: "Glucose Oxidase", type: "Stabilizer" },
    "E1103": { name: "Invertase", type: "Stabilizer" },
    "E1104": { name: "Lipases", type: "Flour Treatment Agent" },
    "E1200": { name: "Polydextrose", type: "Bulking Agent, Stabilizer" },
    "E1201": { name: "Polyvinylpyrrolidone (PVP)", type: "Stabilizer" },
    "E1202": { name: "Polyvinylpolypyrrolidone (PVPP)", type: "Stabilizer" },
    "E1203": { name: "Polyvinyl alcohol (PVA)", type: "Glazing agent" },
    "E1400": { name: "Dextrin", type: "Thickener, Stabilizer" },
    "E1401": { name: "Acid Treated Starch", type: "Thickener, Stabilizer" },
    "E1402": { name: "Alkaline Treated Starch", type: "Thickener, Stabilizer" },
    "E1403": { name: "Bleached Starch", type: "Thickener, Stabilizer" },
    "E1404": { name: "Oxidized Starch", type: "Thickener, Stabilizer" },
    "E1410": { name: "Monostarch Phosphate", type: "Thickener, Stabilizer" },
    "E1412": { name: "Distarch Phosphate", type: "Thickener, Stabilizer" },
    "E1413": { name: "Phosphated Distarch Phosphate", type: "Thickener, Stabilizer" },
    "E1414": { name: "Acetylated Distarch Phosphate", type: "Thickener, Stabilizer" },
    "E1420": { name: "Acetylated Starch", type: "Thickener, Stabilizer" },
    "E1422": { name: "Acetylated Distarch Adipate", type: "Thickener, Stabilizer" },
    "E1440": { name: "Hydroxypropyl Starch", type: "Thickener, Stabilizer" },
    "E1442": { name: "Hydroxypropyl Distarch Phosphate", type: "Thickener, Stabilizer" },
    "E1450": { name: "Starch Sodium Octenylsuccinate", type: "Emulsifier, Stabilizer" },
    "E1451": { name: "Acetylated Oxidised Starch", type: "Thickener, Stabilizer" },
    "E1452": { name: "Starch Aluminium Octenylsuccinate", type: "Emulsifier, Stabilizer" },
    "E1505": { name: "Triethyl Citrate", type: "Solvent" },
    "E1518": { name: "Glycerol Triacetate (Triacetin)", type: "Humectant, Solvent" },
    "E1520": { name: "Propane-1,2-diol (Propylene Glycol)", type: "Solvent, Humectant" },
    "E1521": { name: "Polyethylene Glycol (PEG)", type: "Solvent" }
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

        if (!response.ok) { // Check if the HTTP response was successful
            const errorText = await response.text();
            console.error('Open Food Facts API response not OK (HTTP status:', response.status, '). Error text:', errorText);
            // Send a more informative error from the server
            return res.status(response.status).json({ message: `Error from Open Food Facts API: ${response.status} - ${errorText.substring(0, 100)}...` });
        }

        const data = await response.json(); // Parse the JSON response
        console.log('Raw data from Open Food Facts API:', JSON.stringify(data, null, 2)); // Uncomment for deep debugging if needed

        // Check if product data was found
        if (data.status === 1 && data.product) {
            const product = data.product;
            const ingredientsText = product.ingredients_text || "No ingredient text available.";
            const productName = product.product_name || "Unknown Product";

            // --- NOVA CLASSIFICATION ---
            const novaGroup = product.nova_group || "Unknown"; // Default to "Unknown" if not classified
            let novaExplanation = "Information not available.";

            // Define source
            const source = product.product_url ? `Open Food Facts (${product.product_url})` : "Open Food Facts";

            // Map NOVA group to explanation
            switch (novaGroup) {
                case 1:
                    novaExplanation = "Group 1: **Unprocessed or Minimally Processed Foods.** These foods are typically consumed in their natural state or with minor alterations like drying, crushing, roasting, or pasteurization. They are free from added sugars, fats, or industrial food additives. They represent the basis of a healthy diet.";
                    break;
                case 2:
                    novaExplanation = "Group 2: **Processed Culinary Ingredients.** These are substances like oils, butter, sugar, salt, and flour, obtained directly from Group 1 foods by processes such as pressing, grinding, pulverizing, or refining. They are not meant to be consumed on their own but are used in kitchens to prepare Group 1 foods into meals.";
                    break;
                case 3:
                    novaExplanation = "Group 3: **Processed Foods.** These are relatively simple products made by adding Group 2 ingredients (like salt, sugar, oil) to Group 1 foods. Examples include canned vegetables, simple cheeses, and cured meats. They are processed to increase shelf life or palatability, but typically contain few ingredients and no 'cosmetic' additives.";
                    break;
                case 4:
                    let baseNova4Explanation = "Group 4: **Ultra-Processed Foods.** These are industrial formulations often containing many ingredients including industrial additives and substances extracted from foods. They are designed for convenience, hyper-palatability, and long shelf-life, and are generally associated with adverse health outcomes due to high levels of added sugar, unhealthy fats, and sodium.";

                    // Extract E-numbers and get detailed additive info for NOVA Group 4 explanation
                    const rawAdditives = product.additives_tags || [];
                    const additives = rawAdditives.map(tag => {
                        const eNumber = tag.toUpperCase().replace(/^EN:/, '');
                        const additiveInfo = additiveMap[eNumber];
                        return additiveInfo
                            ? { eNumber: eNumber, name: additiveInfo.name, type: additiveInfo.type }
                            : { eNumber: eNumber, name: 'Unknown Additive', type: 'Unknown Type' };
                    });

                    if (additives && additives.length > 0) {
                        const detectedAdditiveNames = new Set();
                        additives.forEach(additive => {
                            if (additive.name !== 'Unknown Additive') {
                                detectedAdditiveNames.add(additive.name);
                            } else {
                                detectedAdditiveNames.add("Various Unspecified Additives");
                            }
                        });

                        let namesList = Array.from(detectedAdditiveNames).filter(name =>
                            name !== "Various Unspecified Additives"
                        ).join(', ');

                        if (namesList) {
                            novaExplanation = `Group 4: **Ultra-Processed Foods.** This product is classified as ultra-processed, primarily due to the presence of industrial food additives such as **${namesList}**. ${baseNova4Explanation.replace('Group 4: **Ultra-Processed Foods.** ', '')}`;
                        } else if (detectedAdditiveNames.has("Various Unspecified Additives")) {
                            novaExplanation = `Group 4: **Ultra-Processed Foods.** This product is classified as ultra-processed, likely due to the presence of various industrial food additives. ${baseNova4Explanation.replace('Group 4: **Ultra-Processed Foods.** ', '')}`;
                        } else {
                            novaExplanation = baseNova4Explanation;
                        }
                    } else {
                        novaExplanation = baseNova4Explanation;
                    }
                    break;
                default:
                    novaExplanation = "Information not available for this NOVA group.";
            }

            // Extract additives for the 'Additives' section
            const productAdditivesForDisplay = product.additives_tags
                ? product.additives_tags.map(tag => {
                    const eNumber = tag.toUpperCase().replace(/^EN:/, '');
                    const additiveInfo = additiveMap[eNumber];
                    return additiveInfo
                        ? { eNumber: eNumber, name: additiveInfo.name, type: additiveInfo.type }
                        : { eNumber: eNumber, name: 'Unknown Additive', type: 'Unknown Type' };
                })
                : [];

            // Send product information back to the client
            res.json({
                productName: productName,
                ingredients: ingredientsText,
                novaGroup: novaGroup,
                novaExplanation: novaExplanation,
                additives: productAdditivesForDisplay, // Ensure this sends the structured additive data
                source: source
            });

        } else {
            // Product not found or no product data
            console.log(`Product not found on OFF for UPC: ${upc}`);
            res.status(404).json({ message: `Product not found for UPC: ${upc}.` });
        }

    } catch (error) {
        console.error(`Error fetching product info for UPC ${upc}:`, error);
        res.status(500).json({ message: 'Error fetching product info from external API.', error: error.message });
    }
});



// Start the server and listen for incoming requests
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to use the scanner.`);
});