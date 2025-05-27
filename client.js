document.addEventListener('DOMContentLoaded', function() {
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
    const prefVegan = document.getElementById('prefVegan'); // Corrected typo here, was = document = document
    const prefGlutenFree = document.getElementById('prefGlutenFree'); // Corrected typo here, was = document = document
    const allergensToAvoid = document.getElementById('allergensToAvoid');
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    const clearPreferencesBtn = document.getElementById('clearPreferencesBtn');
    const preferenceMessage = document.getElementById('preferenceMessage');

    // Variables for scanner state and product fetching
    let isScannerRunning = false;
    let isFetchingProduct = false;
    const MAX_HISTORY_ITEMS = 10;
    const LAST_SCAN_DEBOUNCE_MS = 2000;
    let lastScannedCode = null;
    let lastScanTimestamp = 0;

    // Html5QrcodeScanner instance and camera management
    let html5QrcodeScanner = null;
    let availableCameras = [];
    let currentCameraId = null;

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
                    fetchAndProcessProduct(currentUpc, false);
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
    clearHistoryBtn.addEventListener('click', clearScanHistory); // Changed to clearHistoryBtn here

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
    async function fetchAndProcessProduct(upc, stopScannerOnSuccess = false) {
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
                return false;
            }

            displayProductInfo(data);
            displayMessage('Product information fetched successfully.', 'success');
            clearResultsBtn.style.display = 'block';
            saveScanToHistory(data);

            if (stopScannerOnSuccess) {
                await stopScanner();
            }
            // **** INSERT THE setTimeout HERE ****
            // Delay the setupAccordions call to allow the DOM to fully settle
            // after the product info is displayed. This helps prevent race conditions
            // where class toggling might be immediately undone or not applied.
            setTimeout(() => {
                console.log("Re-applying accordion listeners and ensuring classes can stick.");
                setupAccordions();
            }, 50); // A small delay, 50 milliseconds, is often enough       

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
            return false;
        } finally {
            isFetchingProduct = false;
        }
    }

    fetchUpcBtn.addEventListener('click', async function() {
        const upc = upcInput.value.trim();
        if (upc) {
            await fetchAndProcessProduct(upc, true);
        } else {
            displayMessage('Please enter a UPC code.', 'warning');
        }
    });

    clearResultsBtn.addEventListener('click', function() {
        productInfoDiv.innerHTML = '<p>Scan a UPC or enter it manually to see results.</p>';
        upcInput.value = '';
        clearResultsBtn.style.display = 'none';
        displayMessage('Results cleared.', 'info');
    });

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

    function deduplicateIngredients(ingredientsText) {
        if (!ingredientsText) {
            return '';
        }
        const ingredientsArray = ingredientsText.split(',').map(item => item.trim());
        const uniqueIngredients = [];
        const seen = new Set();

        for (const item of ingredientsArray) {
            const normalizedItem = item.toLowerCase();
            if (!seen.has(normalizedItem)) {
                seen.add(normalizedItem);
                uniqueIngredients.push(item);
            }
        }
        return uniqueIngredients.join(', ');
    }

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

        html += `
            <div class="product-header">
                <h1>${product.name || 'Unknown Product'}</h1>
                ${product.image ? `<img src="${product.image}" alt="${product.name || 'Product Image'}" class="product-image">` : ''}
            </div>
        `;

        let preferenceHighlights = [];
        const ingredientsLower = product.ingredients ? product.ingredients.toLowerCase() : '';
        const labelsLower = product.labels ? product.labels.map(l => l.toLowerCase()) : [];

        if (preferences.vegetarian && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish') &&
            (labelsLower.includes('vegetarian') || labelsLower.includes('lacto-vegetarian') || labelsLower.includes('ovo-vegetarian'))) {
            preferenceHighlights.push('<span class="diet-badge diet-vegetarian">Vegetarian Friendly</span>');
        } else if (preferences.vegetarian && product.ingredients && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish')) {
            preferenceHighlights.push('<span class="diet-badge diet-vegetarian-potential">Potentially Vegetarian</span>');
        }

        if (preferences.vegan && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish') &&
            !ingredientsLower.includes('dairy') && !ingredientsLower.includes('egg') &&
            (labelsLower.includes('vegan'))) {
            preferenceHighlights.push('<span class="diet-badge diet-vegan">Vegan Friendly</span>');
        } else if (preferences.vegan && product.ingredients && !ingredientsLower.includes('meat') && !ingredientsLower.includes('fish') && !ingredientsLower.includes('dairy') && !ingredientsLower.includes('egg')) {
            preferenceHighlights.push('<span class="diet-badge diet-vegan-potential">Potentially Vegan</span>');
        }

        if (preferences.glutenFree && (labelsLower.includes('gluten-free') || labelsLower.includes('sans gluten'))) {
             preferenceHighlights.push('<span class="diet-badge diet-gluten-free">Gluten-Free</span>');
        } else if (preferences.glutenFree && product.ingredients && !ingredientsLower.includes('wheat') && !ingredientsLower.includes('barley') && !ingredientsLower.includes('rye')) {
             preferenceHighlights.push('<span class="diet-badge diet-gluten-free-potential">Potentially Gluten-Free</span>');
        }

        let foundAvoidedAllergens = new Set();
        if (allergensToAvoidList.length > 0 && product.allergens && product.allergens.length > 0) {
            const normalizedProductImagesAllergens = product.allergens.map(a => a.toLowerCase().replace(/en:|from:|fr:/g, '').replace(/-/g, ' ').trim());

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
                    statusText = 'Info limited';
                    statusClass += ' info';
                } else {
                    statusClass = '';
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
        setupAccordions(); // This ensures accordions within productInfoDiv are functional
    }

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

    setupAccordions(); // Initial setup for all accordions on page load

    async function onScanSuccess(decodedText, decodedResult) {
        const currentTime = new Date().getTime();

        if (decodedText === lastScannedCode && (currentTime - lastScanTimestamp < LAST_SCAN_DEBOUNCE_MS)) {
            console.log("Debouncing: Same code scanned too quickly.");
            return;
        }

        lastScannedCode = decodedText;
        lastScanTimestamp = currentTime;

        console.log(`Scan result: ${decodedText}`, decodedResult);
        upcInput.value = decodedText;

        await fetchAndProcessProduct(decodedText, true);
    }

    function onScanError(errorMessage) {
        if (isScannerRunning) {
            console.warn('Scanner error during active scan:', errorMessage);
        }
    }

    async function initializeScanner(cameraId) {
        if (html5QrcodeScanner && isScannerRunning) {
            console.log("Stopping existing scanner to re-initialize.");
            await stopScanner();
        }

        scannerContainer.innerHTML = '';
        displayMessage('Starting scanner...', 'info');

        html5QrcodeScanner = new Html5QrcodeScanner(
            "scanner-container",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                supportedScanFormats: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                ],
                // Explicitly disable the built-in UI for stop/switch if we want full control,
                // but for now, Html5QrcodeScanner automatically hides them when scanner is idle.
                // If it adds more default UI, we might need to explore options like `showNativeInput: false`
            },
            /* verbose= */ false
        );

        try {
            const renderConfig = {
                deviceId: { exact: cameraId },
                rememberLastUsedCamera: false
            };

            await html5QrcodeScanner.render(
                onScanSuccess,
                onScanError,
                renderConfig
            );

            isScannerRunning = true;
            currentCameraId = cameraId;

            displayMessage('Scanner active. Point to a barcode.', 'success');
        } catch (err) {
            console.error('Error starting scanner with ID ' + cameraId + ':', err);
            isScannerRunning = false;
            let errorMessage = 'Error starting scanner.';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMessage = 'Camera access denied by user. Please enable camera permissions in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                errorMessage = 'No camera found on this device or the selected camera is unavailable.';
            } else if (err.name === 'OverconstrainedError') {
                errorMessage = 'Camera constraints cannot be satisfied. Trying to switch cameras...';
                if (availableCameras.length > 1) {
                    const currentIndex = availableCameras.findIndex(camera => camera.id === currentCameraId);
                    const nextIndex = (currentIndex + 1) % availableCameras.length;
                    const nextCamera = availableCameras[nextIndex];
                    displayMessage(`Trying next camera: ${nextCamera.label || 'unknown'}`, 'warning');
                    await initializeScanner(nextCamera.id);
                    return;
                }
            } else {
                errorMessage += ` (${err.message})`;
            }

            displayMessage(errorMessage, 'error');
            scannerContainer.innerHTML = '<p>Camera access denied or error. Please check permissions.</p>';
        }
    }

    async function getCameras() {
        try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length) {
                availableCameras = cameras;
                const backCamera = cameras.find(camera =>
                    camera.label.toLowerCase().includes('back') ||
                    camera.label.toLowerCase().includes('environment') ||
                    (cameras.length > 1 && !camera.label.toLowerCase().includes('front'))
                );
                return backCamera ? backCamera.id : cameras[0].id;
            }
            return null;
        } catch (err) {
            console.error('Error getting cameras:', err);
            displayMessage('Could not list cameras. Ensure camera is connected and drivers are installed.', 'error');
            return null;
        }
    }

    async function requestCameraAccess() {
        if (isScannerRunning) {
            console.log("Scanner already running, ignoring repeated request.");
            return;
        }

        displayMessage('Requesting camera access...', 'info');
        scannerContainer.innerHTML = '<p>Waiting for camera permission...</p>';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());

            const defaultCameraId = await getCameras();
            if (defaultCameraId) {
                await initializeScanner(defaultCameraId);
            } else {
                displayMessage('No suitable camera found on this device after permission was granted.', 'error');
                scannerContainer.innerHTML = '<p>No camera devices detected or available.</p>';
            }
        } catch (err) {
            console.error('Error requesting camera access:', err);
            let userFriendlyMessage = 'An unknown error occurred while requesting camera access.';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                userFriendlyMessage = 'Camera access denied by user. Please enable camera permissions in your browser settings (e.g., Site Settings > Permissions > Camera) to use the scanner.';
            } else if (err.name === 'NotFoundError') {
                userFriendlyMessage = 'No camera found on this device. Ensure your device has a working camera.';
            } else if (err.name === 'NotReadableError') {
                userFriendlyMessage = 'Camera is currently in use by another application or not accessible. Please close other apps using the camera.';
            } else if (err.name === 'AbortError') {
                userFriendlyMessage = 'Camera access was aborted. This can happen if the device media is stopped before it starts.';
            } else if (err.name === 'SecurityError') {
                userFriendlyMessage = 'Camera access denied due to security constraints (e.g., non-HTTPS connection on some browsers). Ensure you are using HTTPS.';
            } else {
                userFriendlyMessage = `Error accessing camera: ${err.message}`;
            }

            displayMessage(userFriendlyMessage, 'error');
            scannerContainer.innerHTML = '<p>' + userFriendlyMessage + '</p>';
        }
    }

    async function stopScanner() {
        return new Promise(async (resolve) => {
            if (isScannerRunning && html5QrcodeScanner) {
                try {
                    if (html5QrcodeScanner) {
                await html5QrcodeScanner.stop();
            }
            isScannerRunning = false;
            displayMessage('Scanner stopped. Ready for next scan.', 'info');

            // --- START OF NEW/IMPROVED CLEANUP CODE ---
            // Clear content and explicitly hide the container for the scanner
            if (scannerContainer) {
                scannerContainer.innerHTML = ''; // Remove any child elements from the scanner
                scannerContainer.style.display = 'none'; // Ensure it's hidden
                scannerContainer.style.width = ''; // Reset any inline width
                scannerContainer.style.height = ''; // Reset any inline height
                scannerContainer.style.position = ''; // Remove any absolute/fixed positioning
                scannerContainer.style.zIndex = ''; // Reset z-index, crucial for overlays
                scannerContainer.style.visibility = ''; // Ensure it's not just "hidden" but takes up no space
                scannerContainer.style.pointerEvents = ''; // Ensure clicks pass through if it's still there
            }
            // --- END OF NEW/IMPROVED CLEANUP CODE ---

            // Re-setup accordions after a tiny delay to allow DOM to settle from scanner removal
            setTimeout(() => {
                console.log("Re-running setupAccordions after scanner stop cleanup.");
                setupAccordions();
            }, 100); // 100ms delay
                } catch (err) {
                    console.error('Error stopping scanner:', err);
                    displayMessage('Error stopping scanner. It might already be stopped or camera access is blocked.', 'error');
                    isScannerRunning = false;
                }
            }
            resolve();
        });
    }

    // Initial display adjustments and automatic camera request on load
    displayMessage('Attempting to access camera...', 'info');
    // Automatically try to request camera access
    requestCameraAccess();
});