document.addEventListener('DOMContentLoaded', function() {
    const startScannerBtn = document.getElementById('startScannerBtn');
    const stopScannerBtn = document.getElementById('stopScannerBtn');
    const scannerMessage = document.getElementById('scanner-message');
    const scannerContainer = document.getElementById('scanner-container');
    const upcInput = document.getElementById('upcInput');
    const fetchUpcBtn = document.getElementById('fetchUpcBtn');
    const productInfoDiv = document.getElementById('productInfo');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const manualScanSection = document.getElementById('manualScanSection');
    const toggleManualScanBtn = document.getElementById('toggleManualScanBtn');
    const scanHistorySection = document.getElementById('scanHistorySection');
    const scanHistoryList = document.getElementById('scanHistoryList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const cameraControlsDiv = document.getElementById('cameraControls'); // Assuming you add this div in HTML
    let switchCameraBtn = document.getElementById('switchCameraBtn'); // This will be created dynamically if needed

    // Dietary Preferences elements
    const dietaryPreferencesSection = document.getElementById('dietaryPreferencesSection');
    const prefVegetarian = document.getElementById('prefVegetarian');
    const prefVegan = document.getElementById('prefVegan');
    const prefGlutenFree = document.getElementById('prefGlutenFree');
    const allergensToAvoid = document.getElementById('allergensToAvoid');
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    const clearPreferencesBtn = document.getElementById('clearPreferencesBtn');
    const preferenceMessage = document.getElementById('preferenceMessage');

    // Variables for scanner state and product fetching
    let isScannerRunning = false;
    let isFetchingProduct = false; // Flag to prevent multiple API calls for the same detected barcode
    const MAX_HISTORY_ITEMS = 10;
    const LAST_SCAN_DEBOUNCE_MS = 2000; // Increased debounce time for better user experience
    let lastScannedCode = null;
    let lastScanTimestamp = 0;

    // Html5QrcodeScanner instance and camera management
    let html5QrcodeScanner = null; // Initialize as null
    let availableCameras = []; // Store detected cameras
    let currentCameraId = null; // Store the ID of the camera currently in use

    // Helper function to display messages
    function displayMessage(message, type = "info") {
        scannerMessage.textContent = message;
        scannerMessage.className = `message ${type}`;
    }

    // --- Dietary Preferences Functions ---
    function loadPreferences() {
        try {
            const preferences = JSON.parse(localStorage.getItem('dietaryPreferences')) || {};
            prefVegetarian.checked = preferences.vegetarian || false;
            prefVegan.checked = preferences.vegan || false;
            prefGlutenFree.checked = preferences.glutenFree || false;
            allergensToAvoid.value = preferences.allergens ? preferences.allergens.join(', ') : '';
        } catch (e) {
            console.error("Error loading preferences from localStorage:", e);
        }
    }

    function savePreferences() {
        const preferences = {
            vegetarian: prefVegetarian.checked,
            vegan: prefVegan.checked,
            glutenFree: prefGlutenFree.checked,
            allergens: allergensToAvoid.value.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
        };
        try {
            localStorage.setItem('dietaryPreferences', JSON.stringify(preferences));
            preferenceMessage.textContent = 'Preferences saved!';
            preferenceMessage.className = 'message success';
            preferenceMessage.style.display = 'block';
            setTimeout(() => { preferenceMessage.style.display = 'none'; }, 3000);
        } catch (e) {
            console.error("Error saving preferences to localStorage:", e);
            preferenceMessage.textContent = 'Error saving preferences.';
            preferenceMessage.className = 'message error';
            preferenceMessage.style.display = 'block';
        }
    }

    function clearPreferences() {
        showCustomConfirm('Are you sure you want to clear all your dietary preferences?', () => {
            localStorage.removeItem('dietaryPreferences');
            prefVegetarian.checked = false;
            prefVegan.checked = false;
            prefGlutenFree.checked = false;
            allergensToAvoid.value = '';

            preferenceMessage.textContent = 'Preferences cleared!';
            preferenceMessage.className = 'message info';
            preferenceMessage.style.display = 'block';
            setTimeout(() => { preferenceMessage.style.display = 'none'; }, 3000);

            // Re-render product info with cleared preferences if a product is displayed
            if (productInfoDiv.innerHTML.includes('product-header')) {
                const currentUpc = upcInput.value.trim();
                if (currentUpc) {
                    fetchAndProcessProduct(currentUpc, false); // Re-fetch, don't stop scanner
                }
            }
        });
    }

    loadPreferences();
    savePreferencesBtn.addEventListener('click', savePreferences);
    clearPreferencesBtn.addEventListener('click', clearPreferences);


    // --- Scan History Functions ---
    function getScanHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('scanHistory')) || [];
            return history;
        } catch (e) {
            console.error("Error parsing scan history from localStorage:", e);
            return [];
        }
    }

    function saveScanToHistory(product) {
        let history = getScanHistory();
        history = history.filter(item => item.upc !== product.upc); // Remove if already in history
        history.unshift({ // Add to the beginning
            upc: product.upc,
            name: product.name,
            image: product.image,
            timestamp: new Date().toISOString()
        });
        if (history.length > MAX_HISTORY_ITEMS) {
            history = history.slice(0, MAX_HISTORY_ITEMS); // Trim to max items
        }
        try {
            localStorage.setItem('scanHistory', JSON.stringify(history));
            renderScanHistory();
        } catch (e) {
            console.error("Error saving scan history to localStorage:", e);
            displayMessage("Could not save scan to history (storage full?).", "warning");
        }
    }

    function renderScanHistory() {
        const history = getScanHistory();
        scanHistoryList.innerHTML = '';

        if (history.length === 0) {
            scanHistoryList.innerHTML = '<p class="text-center text-gray-500">No recent scans yet.</p>';
            clearHistoryBtn.style.display = 'none';
            return;
        }

        history.forEach(item => {
            const li = document.createElement('li');
            li.className = 'scan-history-item';
            li.innerHTML = `
                ${item.image ? `<img src="${item.image}" alt="${item.name}" class="history-item-image">` : ''}
                <div class="history-item-details">
                    <span class="history-item-name">${item.name}</span>
                    <span class="history-item-upc">${item.upc}</span>
                </div>
            `;
            li.addEventListener('click', () => {
                upcInput.value = item.upc;
                // When clicking history, don't stop scanner if it's running (it's a lookup, not a live scan)
                fetchAndProcessProduct(item.upc, false);
            });
            scanHistoryList.appendChild(li);
        });
        clearHistoryBtn.style.display = 'block';
    }

    function clearScanHistory() {
        showCustomConfirm('Are you sure you want to clear your scan history?', () => {
            localStorage.removeItem('scanHistory');
            renderScanHistory();
            displayMessage('Scan history cleared.', 'info');
        });
    }

    renderScanHistory();
    clearHistoryBtn.addEventListener('click', clearScanHistory);


    // --- Custom Confirmation Modal (Replaces alert/confirm) ---
    function showCustomConfirm(message, onConfirm) {
        let modal = document.getElementById('customConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'customConfirmModal';
            modal.className = 'custom-modal';
            modal.innerHTML = `
                <div class="custom-modal-content">
                    <p id="customConfirmMessage"></p>
                    <div class="custom-modal-buttons">
                        <button id="customConfirmYes" class="modal-button-yes">Yes</button>
                        <button id="customConfirmNo" class="modal-button-no">No</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('customConfirmMessage').textContent = message;
        modal.style.display = 'flex'; // Show modal

        const confirmYes = document.getElementById('customConfirmYes');
        const confirmNo = document.getElementById('customConfirmNo');

        // Remove previous event listeners to prevent multiple calls
        confirmYes.onclick = null;
        confirmNo.onclick = null;

        confirmYes.onclick = () => {
            modal.style.display = 'none'; // Hide modal
            onConfirm(); // Execute the callback
        };
        confirmNo.onclick = () => {
            modal.style.display = 'none'; // Hide modal
        };
    }


    // Toggle Manual Scan Section
    toggleManualScanBtn.addEventListener('click', function() {
        if (manualScanSection.style.display === 'none' || manualScanSection.style.display === '') {
            manualScanSection.style.display = 'block';
            toggleManualScanBtn.textContent = 'Hide Manual Scan';
        } else {
            manualScanSection.style.display = 'none';
            toggleManualScanBtn.textContent = 'Show Manual Scan';
        }
    });

    // Centralized function to fetch and process product information
    async function fetchAndProcessProduct(upc, stopScannerOnSuccess = false) { // Default to false
        if (isFetchingProduct) {
            console.log("Already fetching a product, ignoring redundant request.");
            return;
        }

        isFetchingProduct = true;
        displayMessage('Fetching product information...', 'info');
        productInfoDiv.innerHTML = '<p>Loading product details...</p>';
        clearResultsBtn.style.display = 'none';

        try {
            const BACKEND_URL = 'https://upc-scanner-backend-api.onrender.com';
            const response = await fetch(`${BACKEND_URL}/api/ingredients/${upc}`);
            const data = await response.json();

            if (!response.ok || !data || typeof data !== 'object' || !data.name) {
                const errorMessage = data?.message || `Product data incomplete or not found for UPC: ${upc}.`;
                displayMessage(errorMessage + ' Keep scanning or try manual entry.', 'warning');
                productInfoDiv.innerHTML = `
                    <div class="info-card no-product">
                        <h2>Product Not Found or Incomplete Data</h2>
                        <p>${errorMessage}</p>
                        <p>Try scanning a different product or check the UPC for typos.</p>
                        <p><a href="https://world.openfoodfacts.org/barcode/${upc}" target="_blank" class="external-link" rel="noopener noreferrer">Search Open Food Facts directly for ${upc}</a></p>
                    </div>
                `;
                clearResultsBtn.style.display = 'none';
                // If scanner was intended to stop, but failed to find product, keep it running
                // Only hide start/show stop if we explicitly stop it.
                return false;
            }

            displayProductInfo(data);
            displayMessage('Product information fetched successfully.', 'success');
            clearResultsBtn.style.display = 'block';
            saveScanToHistory(data);

            // Crucial: Stop the scanner here if it was a successful scan from the camera
            if (stopScannerOnSuccess) {
                await stopScanner(); // Use await here as stopScanner is now async
            }
            return true;

        } catch (error) {
            console.error('Error fetching or processing product:', error);
            displayMessage('Network error or server is unreachable. Check connection.', 'error');
            productInfoDiv.innerHTML = `
                <div class="info-card error-card">
                    <h2>Network Error</h2>
                    <p>Could not connect to the server or an unexpected error occurred. Please ensure the server is running and your internet connection is stable.</p>
                </div>
            `;
            clearResultsBtn.style.display = 'none';
            // If the scanner was running, don't stop it on a network error, allow user to try again
            return false;
        } finally {
            isFetchingProduct = false;
        }
    }

    // Handle UPC fetching (manual entry)
    fetchUpcBtn.addEventListener('click', async function() {
        const upc = upcInput.value.trim();
        if (upc) {
            // For manual entry, always stop scanner if it's running after fetching
            await fetchAndProcessProduct(upc, true);
        } else {
            displayMessage('Please enter a UPC code.', 'warning');
        }
    });

    // Clear Results button handler
    clearResultsBtn.addEventListener('click', function() {
        productInfoDiv.innerHTML = '<p>Scan a UPC or enter it manually to see results.</p>';
        upcInput.value = '';
        clearResultsBtn.style.display = 'none';
        displayMessage('Results cleared.', 'info');
    });

    // --- Helper function to determine nutrient status class ---
    function getNutrientStatusClass(nutrientName, value) {
        if (value === null || isNaN(value)) {
            return '';
        }
        value = parseFloat(value);

        switch (nutrientName.toLowerCase()) {
            case 'calories':
                if (value < 150) return 'nutrient-low';
                if (value >= 150 && value <= 400) return 'nutrient-moderate';
                return 'nutrient-high';
            case 'sugar':
                if (value < 5) return 'nutrient-low';
                if (value >= 5 && value <= 22.5) return 'nutrient-moderate';
                return 'nutrient-high';
            case 'fat':
                if (value < 3) return 'nutrient-low';
                if (value >= 3 && value <= 17.5) return 'nutrient-moderate';
                return 'nutrient-high';
            case 'salt':
                if (value < 0.3) return 'nutrient-low';
                if (value >= 0.3 && value <= 1.5) return 'nutrient-moderate';
                return 'nutrient-high';
            case 'protein':
                if (value >= 10) return 'nutrient-good';
                if (value < 5) return 'nutrient-low';
                return 'nutrient-moderate';
            case 'fiber':
                if (value >= 6) return 'nutrient-good';
                if (value < 3) return 'nutrient-low';
                return 'nutrient-moderate';
            case 'carbohydrates':
                if (value < 10) return 'nutrient-low';
                if (value >= 10 && value <= 45) return 'nutrient-moderate';
                return 'nutrient-high';
            default:
                return '';
        }
    }

    // NEW FUNCTION: Deduplicates ingredients from a comma-separated string
    function deduplicateIngredients(ingredientsText) {
        if (!ingredientsText) {
            return '';
        }
        const ingredientsArray = ingredientsText.split(',').map(item => item.trim());
        const uniqueIngredients = [];
        const seen = new Set();

        for (const item of ingredientsArray) {
            // Normalize for comparison (e.g., "Milk" and "milk" are the same)
            const normalizedItem = item.toLowerCase();
            if (!seen.has(normalizedItem)) {
                seen.add(normalizedItem);
                uniqueIngredients.push(item); // Keep original casing for display
            }
        }
        return uniqueIngredients.join(', ');
    }


    // --- Function to display product information ---
    function displayProductInfo(product) {
        let html = '';

        const hasServingData = product.serving_quantity && product.serving_quantity > 0;
        const servingSizeText = hasServingData ? `per serving (${product.serving_size || product.serving_quantity + 'g'})` : 'per 100g/ml';

        const getPerServingValue = (valuePer100g) => {
            if (!hasServingData || valuePer100g === null || isNaN(valuePer100g)) {
                return valuePer100g;
            }
            return ((parseFloat(valuePer100g) / 100) * product.serving_quantity).toFixed(1);
        };

        // Get current preferences for highlighting
        const preferences = JSON.parse(localStorage.getItem('dietaryPreferences')) || {};
        const allergensToAvoidList = preferences.allergens || [];

        const generalAllergenMappings = {
            'nuts': ['almond', 'brazil nut', 'cashew', 'hazelnut', 'macadamia', 'pecan', 'pistachio', 'walnut', 'nut'],
            'peanuts': ['peanut'],
            'dairy': ['milk', 'lactose', 'whey', 'casein', 'butter', 'cheese'],
            'gluten': ['wheat', 'barley', 'rye', 'oats'],
            'soy': ['soy', 'soya'],
            'egg': ['egg'],
            'fish': ['fish'],
            'shellfish': ['shellfish', 'shrimp', 'crab', 'lobster', 'mussel', 'oyster', 'clam', 'scallop'],
            'sesame': ['sesame'],
            'mustard': ['mustard'],
            'celery': ['celery'],
            'sulfites': ['sulfite', 'sulphite'],
            'lupin': ['lupin'],
            'molluscs': ['mollusc']
        };


        // --- Product Header (Name and Image) ---
        html += `
            <div class="product-header">
                <h1>${product.name || 'Unknown Product'}</h1>
                ${product.image ? `<img src="${product.image}" alt="${product.name || 'Product Image'}" class="product-image">` : ''}
            </div>
        `;

        // --- Dietary Preference Highlights ---
        let preferenceHighlights = [];

        // Check for Vegetarian/Vegan
        const ingredientsLower = product.ingredients ? product.ingredients.toLowerCase() : '';
        const labelsLower = product.labels ? product.labels.map(l => l.toLowerCase()) : [];

        if (preferences.vegetarian && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish') &&
            (labelsLower.includes('vegetarian') || labelsLower.includes('lacto-vegetarian') || labelsLower.includes('ovo-vegetarian'))) {
            preferenceHighlights.push('<span class="diet-badge diet-vegetarian">Vegetarian Friendly</span>');
        } else if (preferences.vegetarian && product.ingredients && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish')) {
            // Fallback for general ingredient check if no specific label
            preferenceHighlights.push('<span class="diet-badge diet-vegetarian-potential">Potentially Vegetarian</span>');
        }

        if (preferences.vegan && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish') &&
            !ingredientsLower.includes('dairy') && !ingredientsLower.includes('egg') &&
            (labelsLower.includes('vegan'))) {
            preferenceHighlights.push('<span class="diet-badge diet-vegan">Vegan Friendly</span>');
        } else if (preferences.vegan && product.ingredients && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish') && !ingredientsLower.includes('dairy') && !ingredientsLower.includes('egg')) {
            // Fallback for general ingredient check if no specific label
            preferenceHighlights.push('<span class="diet-badge diet-vegan-potential">Potentially Vegan</span>');
        }

        // Basic Gluten-Free check (needs more robust ingredient parsing for accuracy)
        if (preferences.glutenFree && (labelsLower.includes('gluten-free') || labelsLower.includes('sans gluten'))) {
             preferenceHighlights.push('<span class="diet-badge diet-gluten-free">Gluten-Free</span>');
        } else if (preferences.glutenFree && product.ingredients && !ingredientsLower.includes('wheat') && !ingredientsLower.includes('barley') && !ingredientsLower.includes('rye')) {
             preferenceHighlights.push('<span class="diet-badge diet-gluten-free-potential">Potentially Gluten-Free</span>');
        }


        // Enhanced Allergen Matching Logic
        let foundAvoidedAllergens = new Set();
        if (allergensToAvoidList.length > 0 && product.allergens && product.allergens.length > 0) {
            const normalizedProductImagesAllergens = product.allergens.map(a => a.toLowerCase().replace(/en:|from:|fr:/g, '').replace(/-/g, ' ').trim());

            allergensToAvoidList.forEach(avoidedTerm => {
                let termsToCheck = [avoidedTerm];

                if (generalAllergenMappings[avoidedTerm]) {
                    termsToCheck = termsToCheck.concat(generalAllergenMappings[avoidedTerm]);
                } else if (avoidedTerm.endsWith('s') && avoidedTerm.length > 2) {
                    termsToCheck.push(avoidedTerm.slice(0, -1)); // Handle plural/singular
                }

                termsToCheck.forEach(checkTerm => {
                    normalizedProductImagesAllergens.forEach(productAllergen => {
                        if (productAllergen.includes(checkTerm) && !foundAvoidedAllergens.has(productAllergen)) {
                            foundAvoidedAllergens.add(productAllergen);
                        }
                    });
                });
            });
        }

        if (foundAvoidedAllergens.size > 0) {
            preferenceHighlights.push(`<span class="allergen-alert-badge">Contains: ${Array.from(foundAvoidedAllergens).join(', ')}</span>`);
        }

        if (preferenceHighlights.length > 0) {
            html += `<div class="section-card preference-highlights">
                        <h3>Your Preferences:</h3>
                        <p>${preferenceHighlights.join(' ')}</p>
                    </div>`;
        }


        // --- Processing Level (NOVA Group) ---
        html += `
            <div class="section-card nova-info nova-group-${String(product.novaGroup || '').toLowerCase().replace(' ', '-') || 'unknown'}">
                <h2>Processing Level: NOVA Group ${product.novaGroup || 'N/A'}</h2>
                <p>This classification describes how much a food has been processed:</p>
                <p>
                    <strong>${product.novaExplanation || 'No detailed NOVA group explanation available.'}</strong>
                </p>
                <p class="nova-description">
                    <a href="https://en.wikipedia.org/wiki/Nova_classification" target="_blank" class="external-link" title="Learn more about NOVA classification" rel="noopener noreferrer">
                        Learn more about NOVA classification
                    </a>
                </p>
                <p class="nova-source-note">
                    <small>
                        Classification provided by Open Food Facts. View product details on
                        <a href="https://world.openfoodfacts.org/product/${product.upc}" target="_blank" class="external-link" rel="noopener noreferrer">Open Food Facts</a>.
                    </small>
                </p>
            </div>
        `;

        if (product.additives && product.additives.length > 0) {
            const additiveCount = product.additives.length;
            let additiveNote = '';
            if (product.novaGroup === '4') {
                additiveNote = `It contains ${additiveCount} food additive${additiveCount !== 1 ? 's' : ''}, which are characteristic of ultra-processed foods.`;
            } else if (product.novaGroup === '3') {
                additiveNote = `It contains ${additiveCount} food additive${additiveCount !== 1 ? 's' : ''}. Additives are sometimes used in processed foods to preserve or enhance flavor/texture.`;
            } else {
                additiveNote = `It contains ${additiveCount} food additive${additiveCount !== 1 ? 's' : ''}.`;
            }
            html += `<p class="additive-nova-note">${additiveNote}</p>`;
        }

        // --- Ingredients (Collapsible) ---
        const displayIngredients = deduplicateIngredients(product.ingredients);
        html += `
            <div class="section-card">
                <button class="accordion-header">
                    <h2>Ingredients <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content">
                    <p>${displayIngredients || 'Ingredients list not available.'}</p>
                </div>
            </div>
        `;

        // --- Allergens (Collapsible) ---
        html += `
            <div class="section-card">
                <button class="accordion-header">
                    <h2>Allergens <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content">
                    ${product.allergens && product.allergens.length > 0 ?
                        `<p><strong>May Contain:</strong> ${product.allergens.map(a => `<span class="allergen-tag">${a.replace(/en:|fr:/g, '').replace(/-/g, ' ')}</span>`).join(', ')}</p>` :
                        `<p>No allergens declared for this product.</p>`
                    }
                </div>
            </div>
        `;

        // --- Additives (Collapsible and Scrollable) ---
        if (product.additives && product.additives.length > 0) {
            html += `
                <div class="section-card">
                    <button class="accordion-header">
                        <h2>Additives <span class="arrow">▼</span></h2>
                    </button>
                    <div class="accordion-content">
                        <div class="additive-list-container">
                            <ul class="additive-list">
            `;
            product.additives.forEach(add => {
                let statusText = '';
                let statusClass = 'additive-risk-badge';

                if (add.status && add.status.includes('BANNED in EU')) {
                    statusText = 'BANNED in EU';
                    statusClass += ' banned';
                } else if (add.status && add.status.includes('Requires warning')) {
                    statusText = 'Requires warning';
                    statusClass += ' warning';
                } else if (add.status && add.status !== 'Not banned in EU' && add.status !== 'Unknown Status' && add.status !== 'Details from Wikipedia.') {
                    statusText = add.status;
                    statusClass += ' info';
                } else if (add.status && (add.status === 'Unknown Status' || add.status === 'Details from Wikipedia.')) {
                    statusText = 'Info limited'; // More generic for unknown/details from Wikipedia
                    statusClass += ' info';
                } else {
                    statusClass = ''; // No specific badge if no special status
                }


                html += `
                                <li>
                                    <strong>${add.eNumber && add.eNumber !== 'N/A' ? add.eNumber + ' - ' : ''}${add.name || 'Unknown Additive'}</strong>
                                    <br>
                                    <small>
                                        Type: ${add.type || 'N/A'}
                                        ${statusText ? ` | Status: <span class="${statusClass}">${statusText}</span>` : ''}
                                    </small>
                                </li>
                `;
            });
            html += `
                            </ul>
                        </div>
                        <p class="additive-lookup-note">
                            <small>
                                For more information on E-numbers, consult resources like
                                <a href="https://en.wikipedia.org/wiki/List_of_food_additives" target="_blank" class="external-link" rel="noopener noreferrer">Wikipedia's List of Food Additives</a>.
                            </small>
                        </p>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="section-card">
                    <button class="accordion-header">
                        <h2>Additives <span class="arrow">▼</span></h2>
                    </button>
                    <div class="accordion-content">
                        <p>No specific additives found or listed for this product.</p>
                        <p class="additive-lookup-note">
                            <small>
                                For more information on E-numbers, consult resources like
                                <a href="https://en.wikipedia.org/wiki/List_of_food_additives" target="_blank" class="external-link" rel="noopener noreferrer">Wikipedia's List of Food Additives</a>.
                            </small>
                        </p>
                    </div>
                </div>
            `;
        }

        // --- Nutrition Facts (Collapsible) ---
        if (product.nutrition_facts) {
            html += `
                <div class="section-card">
                    <button class="accordion-header">
                        <h2>Nutrition Facts <small>${servingSizeText}</small> <span class="arrow">▼</span></h2>
                    </button>
                    <div class="accordion-content">
                        <div class="nutrition-grid">
                            <p><strong>Calories:</strong> <span class="${getNutrientStatusClass('calories', getPerServingValue(product.nutrition_facts.calories))}">${getPerServingValue(product.nutrition_facts.calories) || 'N/A'} kcal</span></p>
                            <p><strong>Protein:</strong> <span class="${getNutrientStatusClass('protein', getPerServingValue(product.nutrition_facts.protein))}">${getPerServingValue(product.nutrition_facts.protein) || 'N/A'} g</span></p>
                            <p><strong>Carbohydrates:</strong> <span class="${getNutrientStatusClass('carbohydrates', getPerServingValue(product.nutrition_facts.carbohydrates))}">${getPerServingValue(product.nutrition_facts.carbohydrates) || 'N/A'} g</span></p>
                            <p><strong>Fat:</strong> <span class="${getNutrientStatusClass('fat', getPerServingValue(product.nutrition_facts.fat))}">${getPerServingValue(product.nutrition_facts.fat) || 'N/A'} g</span></p>
                            <p><strong>Sugar:</strong> <span class="${getNutrientStatusClass('sugar', getPerServingValue(product.nutrition_facts.sugar))}">${getPerServingValue(product.nutrition_facts.sugar) || 'N/A'} g</span></p>
                            <p><strong>Salt:</strong> <span class="${getNutrientStatusClass('salt', getPerServingValue(product.nutrition_facts.salt))}">${getPerServingValue(product.nutrition_facts.salt) || 'N/A'} g</span></p>
                            <p><strong>Fiber:</strong> <span class="${getNutrientStatusClass('fiber', getPerServingValue(product.nutrition_facts.fiber))}">${getPerServingValue(product.nutrition_facts.fiber) || 'N/A'} g</span></p>
                        </div>
                    </div>
                </div>
            `;
        }

        // --- Data Source (Collapsible) ---
        html += `
            <div class="section-card">
                <button class="accordion-header">
                    <h2>Data Source <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content">
                    <p>Information provided by ${product.source || 'Open Food Facts'}.</p>
                </div>
            </div>
        `;

        productInfoDiv.innerHTML = html;
        setupAccordions();
    }

    // --- Accordion Logic ---
    function setupAccordions() {
        const accordionHeaders = document.querySelectorAll('.accordion-header');
        accordionHeaders.forEach(header => {
            // Remove existing listeners to prevent duplication if called multiple times
            header.removeEventListener('click', toggleAccordion);
            header.addEventListener('click', toggleAccordion);
        });

        function toggleAccordion() {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.classList.contains('show')) {
                content.classList.remove('show');
            } else {
                content.classList.add('show');
            }
        }
    }

    // Initial setup for accordions (in case there's static content)
    setupAccordions();

    // Html5QrcodeScanner integration
    async function onScanSuccess(decodedText, decodedResult) {
        const currentTime = new Date().getTime();

        // Debounce logic: Only process if it's the exact same code scanned too quickly
        if (decodedText === lastScannedCode && (currentTime - lastScanTimestamp < LAST_SCAN_DEBOUNCE_MS)) {
            console.log("Debouncing: Same code scanned too quickly.");
            return;
        }

        // Set debouncing variables immediately
        lastScannedCode = decodedText;
        lastScanTimestamp = currentTime;

        console.log(`Scan result: ${decodedText}`, decodedResult);
        upcInput.value = decodedText; // Populate the manual input field

        // Fetch and process the product, and crucially, tell it to stop the scanner on success
        await fetchAndProcessProduct(decodedText, true);
    }

    function onScanError(errorMessage) {
        // This can be chatty, so only log for significant errors or if scanner not running
        // For common, transient scanning issues, we might suppress messages.
        // console.warn(`QR Code scanning error: ${errorMessage}`);
        if (isScannerRunning) {
            if (errorMessage.includes("NotReadableError")) {
                displayMessage('Camera is busy or inaccessible. Please close other camera apps.', 'error');
            } else if (errorMessage.includes("OverconstrainedError")) {
                displayMessage('Requested camera constraints cannot be satisfied. Trying another camera or facing mode.', 'error');
                // Attempt to switch camera if this error occurs
                if (availableCameras.length > 1) {
                    const currentIndex = availableCameras.findIndex(camera => camera.id === currentCameraId);
                    const nextIndex = (currentIndex + 1) % availableCameras.length;
                    const nextCamera = availableCameras[nextIndex];
                    displayMessage(`Attempting to switch to ${nextCamera.label || 'another camera'}...`, 'info');
                    initializeScanner(nextCamera.id); // Try initializing with the next camera
                }
            } else {
                // Generic error for other scanning issues, keep it quiet to avoid spam
                // displayMessage(`Scanning issue: ${errorMessage}`, 'warning');
            }
        }
    }

    // Function to initialize scanner with a specific camera
    async function initializeScanner(cameraId) {
        if (html5QrcodeScanner && isScannerRunning) {
            // If scanner already exists and is running, stop it first to re-initialize with new camera
            console.log("Stopping existing scanner to re-initialize.");
            await stopScanner(); // Await ensures it's fully stopped before new start
        }

        // Clear previous content in scanner container
        scannerContainer.innerHTML = '';
        displayMessage('Starting scanner...', 'info');

        // Create a new scanner instance
        html5QrcodeScanner = new Html5QrcodeScanner(
            "scanner-container", // ID of the HTML element where the scanner will be rendered
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }, // Adjust size of scanning box
                rememberLastUsedCamera: false, // Prevents library from remembering user's last choice
                supportedScanFormats: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                ],
                // Pass facingMode or deviceId for initial camera selection
                cameraLastUsed: cameraId ? { deviceId: { exact: cameraId } } : { facingMode: { exact: "environment" } }
            },
            /* verbose= */ false
        );

        try {
            // Use start() directly with camera constraints
            await html5QrcodeScanner.start(
                cameraId ? { deviceId: { exact: cameraId } } : { facingMode: { exact: "environment" } },
                onScanSuccess,
                onScanError
            );
            isScannerRunning = true; // Set flag once start is successful
            currentCameraId = cameraId; // Update current camera ID

            startScannerBtn.style.display = 'none';
            stopScannerBtn.style.display = 'inline-block';

            // Ensure camera controls are visible
            if (cameraControlsDiv) {
                cameraControlsDiv.style.display = 'block';
            }
            createCameraSwitchButton(); // Create/update switch button visibility

            displayMessage('Scanner active. Point to a barcode.', 'success');
        } catch (err) {
            console.error('Error starting scanner:', err);
            isScannerRunning = false; // Ensure flag is false on failure
            displayMessage('Error starting scanner. Please ensure camera permissions are granted and no other app is using the camera.', 'error');
            // Hide scanner and show start button again
            scannerContainer.innerHTML = '<p>Camera access denied or error. Please check permissions.</p>';
            startScannerBtn.style.display = 'inline-block';
            stopScannerBtn.style.display = 'none';
            if (switchCameraBtn) switchCameraBtn.style.display = 'none'; // Hide switch button
        }
    }

    // Function to get and store available cameras
    async function getCameras() {
        try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length) {
                availableCameras = cameras;
                // Return the preferred camera ID (back or first)
                const backCamera = cameras.find(camera =>
                    camera.label.toLowerCase().includes('back') ||
                    camera.label.toLowerCase().includes('environment') ||
                    (cameras.length > 1 && !camera.label.toLowerCase().includes('front'))
                );
                return backCamera ? backCamera.id : cameras[0].id;
            }
            return null; // No cameras found
        } catch (err) {
            console.error('Error getting cameras:', err);
            displayMessage('Error listing cameras. Please check camera permissions.', 'error');
            return null;
        }
    }

    // Function to create and manage the camera switch button
    function createCameraSwitchButton() {
        if (!cameraControlsDiv) {
            console.warn("Camera controls div not found. Cannot create switch button.");
            return;
        }

        if (!switchCameraBtn) {
            switchCameraBtn = document.createElement('button');
            switchCameraBtn.id = 'switchCameraBtn';
            switchCameraBtn.textContent = 'Switch Camera';
            switchCameraBtn.className = 'scanner-control-button';
            cameraControlsDiv.appendChild(switchCameraBtn); // Add to the dedicated controls div
        }

        switchCameraBtn.onclick = async () => {
            if (!availableCameras.length) {
                displayMessage("No other cameras available to switch to.", "warning");
                return;
            }

            const currentIndex = availableCameras.findIndex(camera => camera.id === currentCameraId);
            const nextIndex = (currentIndex + 1) % availableCameras.length;
            const nextCamera = availableCameras[nextIndex];

            displayMessage(`Switching to ${nextCamera.label || 'another camera'}...`, 'info');
            await initializeScanner(nextCamera.id); // Re-initialize scanner with the next camera
        };
        // Show only if multiple cameras are available AND scanner is running
        switchCameraBtn.style.display = (availableCameras.length > 1 && isScannerRunning) ? 'inline-block' : 'none';
    }


    // Modified startScanner event listener
    startScannerBtn.addEventListener('click', async function() {
        if (!isScannerRunning) {
            displayMessage('Requesting camera access...', 'info');
            const defaultCameraId = await getCameras(); // Get the ID of the default camera
            if (defaultCameraId) {
                await initializeScanner(defaultCameraId); // Start scanner with the default camera
            } else {
                displayMessage('No suitable camera found or access denied.', 'error');
                startScannerBtn.style.display = 'none';
            }
        }
    });


    // Function to stop the scanner
    async function stopScanner() {
        return new Promise(async (resolve) => {
            if (isScannerRunning && html5QrcodeScanner) {
                try {
                    await html5QrcodeScanner.stop();
                    console.log("Html5QrcodeScanner stopped.");
                    displayMessage('Scanner stopped.', 'info');
                    isScannerRunning = false;
                    startScannerBtn.style.display = 'inline-block';
                    stopScannerBtn.style.display = 'none';
                    if (switchCameraBtn) switchCameraBtn.style.display = 'none'; // Hide switch button
                    scannerContainer.innerHTML = '<p>Click "Start Scanner" to activate your camera.</p>'; // Clear video feed
                    html5QrcodeScanner = null; // Clear the instance completely
                } catch (err) {
                    console.error('Error stopping scanner:', err);
                    displayMessage('Error stopping scanner. It might already be stopped or camera access is blocked.', 'error');
                    // Even if error, try to reset UI state
                    isScannerRunning = false;
                    startScannerBtn.style.display = 'inline-block';
                    stopScannerBtn.style.display = 'none';
                    if (switchCameraBtn) switchCameraBtn.style.display = 'none';
                }
            }
            resolve(); // Resolve the promise even if scanner wasn't running or error occurred
        });
    }
    stopScannerBtn.addEventListener('click', stopScanner);

    // Initial display adjustments on load
    displayMessage('Click "Start Scanner" to activate your camera.', 'info');
    startScannerBtn.style.display = 'inline-block';
    stopScannerBtn.style.display = 'none';
    if (switchCameraBtn) switchCameraBtn.style.display = 'none'; // Hide switch button on initial load
    if (cameraControlsDiv) {
        cameraControlsDiv.style.display = 'none'; // Hide camera controls div until scanner starts
    }

}); // End of DOMContentLoaded