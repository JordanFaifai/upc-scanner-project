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

    // Dietary Preferences elements
    const dietaryPreferencesSection = document.getElementById('dietaryPreferencesSection');
    const prefVegetarian = document.getElementById('prefVegetarian');
    const prefVegan = document.getElementById('prefVegan');
    const prefGlutenFree = document = document.getElementById('prefGlutenFree');
    const allergensToAvoid = document.getElementById('allergensToAvoid');
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    const clearPreferencesBtn = document.getElementById('clearPreferencesBtn');
    const preferenceMessage = document.getElementById('preferenceMessage');

    let isScannerRunning = false;
    let isFetchingProduct = false; // Flag to prevent multiple API calls for the same detected barcode
    const MAX_HISTORY_ITEMS = 10;
    const LAST_SCAN_DEBOUNCE_MS = 1500; // Time to wait before allowing another scan of the same code
    let lastScannedCode = null;
    let lastScanTimestamp = 0;


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

            if (productInfoDiv.innerHTML.includes('product-header')) {
                const currentUpc = upcInput.value.trim();
                if (currentUpc) {
                    // Re-fetch/re-display current product with new preferences
                    fetchAndProcessProduct(currentUpc, false); // Don't stop scanner if it's running
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
        history = history.filter(item => item.upc !== product.upc);
        history.unshift({
            upc: product.upc,
            name: product.name,
            image: product.image,
            timestamp: new Date().toISOString()
        });
        if (history.length > MAX_HISTORY_ITEMS) {
            history = history.slice(0, MAX_HISTORY_ITEMS);
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
                fetchAndProcessProduct(item.upc, true); // Fetch and stop scanner if successful
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
        modal.style.display = 'flex';

        const confirmYes = document.getElementById('customConfirmYes');
        const confirmNo = document.getElementById('customConfirmNo');

        confirmYes.onclick = null;
        confirmNo.onclick = null;

        confirmYes.onclick = () => {
            modal.style.display = 'none';
            onConfirm();
        };
        confirmNo.onclick = () => {
            modal.style.display = 'none';
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
    async function fetchAndProcessProduct(upc, stopScannerOnSuccess = true) {
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
                // Product not found or incomplete data
                const errorMessage = data?.message || `Product data incomplete or not found for UPC: ${upc}.`;
                displayMessage(errorMessage + ' Keep scanning or try manual entry.', 'warning');
                productInfoDiv.innerHTML = `
                    <div class="info-card no-product">
                        <h2>Product Not Found or Incomplete Data</h2>
                        <p>${errorMessage}</p>
                        <p>Try scanning a different product or check the UPC for typos.</p>
                        <p><a href="https://world.openfoodfacts.org/barcode/${upc}" target="_blank" class="external-link">Search Open Food Facts directly for ${upc}</a></p>
                    </div>
                `;
                // DO NOT stop scanner here, allow continuous scanning
                clearResultsBtn.style.display = 'none';
                return false; // Indicate failure
            }

            // Success: Product found and valid
            displayProductInfo(data);
            displayMessage('Product information fetched successfully.', 'success');
            clearResultsBtn.style.display = 'block';
            saveScanToHistory(data);

            if (stopScannerOnSuccess) {
                stopScanner(); // Only stop scanner if explicitly requested (e.g., from manual fetch or successful scan)
            }
            return true; // Indicate success

        } catch (error) {
            console.error('Error fetching or processing product:', error);
            displayMessage('Network error or server is unreachable. Check connection, continuing scan.', 'error');
            productInfoDiv.innerHTML = `
                <div class="info-card error-card">
                    <h2>Network Error</h2>
                    <p>Could not connect to the server or an unexpected error occurred. Please ensure the server is running and your internet connection is stable.</p>
                </div>
            `;
            // DO NOT stop scanner here, allow continuous scanning
            clearResultsBtn.style.display = 'none';
            return false; // Indicate failure
        } finally {
            isFetchingProduct = false; // Reset flag regardless of success or failure
        }
    }

    // Handle UPC fetching (manual entry)
    fetchUpcBtn.addEventListener('click', async function() {
        const upc = upcInput.value.trim();
        if (upc) {
            await fetchAndProcessProduct(upc, true); // Always stop scanner if manual fetch is successful
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
                if (value >= 0.3 && value >= 1.5) return 'nutrient-moderate';
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
        const allergensToAvoidList = preferences.allergens || []; // already lowercased and trimmed

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
        if (preferences.vegetarian && product.ingredients && !product.ingredients.toLowerCase().includes('meat') && !product.ingredients.toLowerCase().includes('fish')) {
            preferenceHighlights.push('<span class="diet-badge diet-vegetarian">Vegetarian Friendly</span>');
        }
        if (preferences.vegan && product.ingredients && !product.ingredients.toLowerCase().includes('meat') && !product.ingredients.toLowerCase().includes('fish') && !product.ingredients.toLowerCase().includes('dairy') && !product.ingredients.toLowerCase().includes('egg')) {
            preferenceHighlights.push('<span class="diet-badge diet-vegan">Vegan Friendly</span>');
        }
        // Basic Gluten-Free check (needs more robust ingredient parsing for accuracy)
        if (preferences.glutenFree && product.ingredients && !product.ingredients.toLowerCase().includes('wheat') && !product.ingredients.toLowerCase().includes('barley') && !product.ingredients.toLowerCase().includes('rye')) {
             preferenceHighlights.push('<span class="diet-badge diet-gluten-free">Potentially Gluten-Free</span>');
        }


        // Enhanced Allergen Matching Logic
        let foundAvoidedAllergens = new Set(); // Use a Set to avoid duplicates
        if (allergensToAvoidList.length > 0 && product.allergens && product.allergens.length > 0) {
            const normalizedProductImagesAllergens = product.allergens.map(a => a.toLowerCase().replace(/en:|from:/g, '').replace(/-/g, ' ').trim());

            allergensToAvoidList.forEach(avoidedTerm => {
                let termsToCheck = [avoidedTerm];

                if (generalAllergenMappings[avoidedTerm]) {
                    termsToCheck = termsToCheck.concat(generalAllergenMappings[avoidedTerm]);
                } else if (avoidedTerm.endsWith('s') && avoidedTerm.length > 2) {
                    termsToCheck.push(avoidedTerm.slice(0, -1));
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
                    <a href="https://en.wikipedia.org/wiki/Nova_classification" target="_blank" class="external-link" title="Learn more about NOVA classification">
                        Learn more about NOVA classification
                    </a>
                </p>
                <p class="nova-source-note">
                    <small>
                        Classification provided by Open Food Facts. View product details on
                        <a href="https://world.openfoodfacts.org/product/${product.upc}" target="_blank" class="external-link">Open Food Facts</a>.
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
        html += `
            <div class="section-card">
                <button class="accordion-header">
                    <h2>Ingredients <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content">
                    <p>${product.ingredients || 'Ingredients list not available.'}</p>
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
                        `<p><strong>May Contain:</strong> ${product.allergens.map(a => `<span class="allergen-tag">${a.replace(/en:/g, '').replace(/-/g, ' ')}</span>`).join(', ')}</p>` :
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
                                <a href="https://en.wikipedia.org/wiki/List_of_food_additives" target="_blank" class="external-link">Wikipedia's List of Food Additives</a>.
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
                                <a href="https://en.wikipedia.org/wiki/List_of_food_additives" target="_blank" class="external-link">Wikipedia's List of Food Additives</a>.
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

    setupAccordions();


    // Quagga2 scanner integration
    function startScanner() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            scannerContainer.innerHTML = ''; // Clear container
            displayMessage('Activating camera, please wait...', 'info');

            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: scannerContainer,
                    constraints: {
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"]
                }
            }, function(err) {
                if (err) {
                    console.error(err);
                    displayMessage(`Error starting scanner: ${err.message}. Ensure camera access is granted.`, 'error');
                    scannerContainer.innerHTML = '<p>Click "Start Scanner" to activate your camera.</p>';
                    return;
                }
                Quagga.start();
                isScannerRunning = true;
                displayMessage('Scanner started. Point to a UPC code.', 'success');
                startScannerBtn.style.display = 'none';
                stopScannerBtn.style.display = 'inline-block';
            });

            Quagga.onDetected(function(result) {
                if (result && result.codeResult && result.codeResult.code) {
                    const upcCode = result.codeResult.code;
                    const currentTime = Date.now();

                    // Debounce logic: Only process if code is different or enough time has passed
                    // AND if we're not already fetching the same product
                    if (upcCode !== lastScannedCode || (currentTime - lastScanTimestamp > LAST_SCAN_DEBOUNCE_MS)) {
                        lastScannedCode = upcCode;
                        lastScanTimestamp = currentTime;

                        upcInput.value = upcCode; // Update input for user feedback
                        // Attempt to fetch and process the product.
                        // If successful, the scanner will stop automatically.
                        // If not found/error, it will continue scanning.
                        fetchAndProcessProduct(upcCode, true); // <--- This was the key change
                    }
                }
            });

            Quagga.onProcessed(function(result) {
                var drawingCtx = Quagga.canvas.ctx.overlay;
                var drawingCanvas = Quagga.canvas.dom.overlay;
                if (result) {
                    if (result.boxes) {
                        drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.width), parseInt(drawingCanvas.height));
                        result.boxes.filter(function(box) {
                            return box !== result.box;
                        }).forEach(function(box) {
                            Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
                        });
                    }
                    if (result.box) {
                        Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "blue", lineWidth: 2 });
                    }
                    if (result.codeResult && result.codeResult.code) {
                        Quagga.ImageDebug.drawPath(result.line, { x: "x", y: "y" }, drawingCtx, { color: "red", lineWidth: 3 });
                    }
                }
            });
        } else {
            displayMessage('getUserMedia not supported in this browser. Please use manual UPC entry.', 'error');
            startScannerBtn.style.display = 'none';
        }
    }

    function stopScanner() {
        if (isScannerRunning) {
            Quagga.stop();
            isScannerRunning = false;
            displayMessage('Scanner stopped.');
            scannerContainer.innerHTML = '<p>Click "Start Scanner" to activate your camera.</p>';
            startScannerBtn.style.display = 'inline-block';
            stopScannerBtn.style.display = 'none';
            lastScannedCode = null; // Reset for next scan session
            lastScanTimestamp = 0;
        }
    }

    startScannerBtn.addEventListener('click', startScanner);
    stopScannerBtn.addEventListener('click', stopScanner);
});
