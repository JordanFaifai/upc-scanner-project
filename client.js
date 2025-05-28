// client.js

// Global variables
let html5QrcodeScanner;
let isScannerRunning = false;
let lastScannedCode = null;
let lastScanTimestamp = 0;
const LAST_SCAN_DEBOUNCE_MS = 1500; // 1.5 seconds debounce

let availableCameras = [];
let currentCameraId = null;

// API Base URL (replace with your actual server URL if different)
const API_BASE_URL = 'https://upc-scanner-backend-api.onrender.com/api'; // Or your deployed backend URL

// State variables for custom modal
let resolveModalPromise;

// --- GLOBAL DOM Element References (declared here, assigned in DOMContentLoaded) ---
// These are declared globally so other functions (like displayMessage, stopScanner) can access them.
// Their values will be assigned once the DOM is fully loaded.
let upcInput;
let scanButton;
let lookupButton;
let productInfoDiv;
let messageDiv;
let scannerContainer;
let scanHistoryList;
let clearHistoryButton;
let savePreferencesButton;
let clearPreferencesButton;
let dietaryPreferencesSection;
let scanHistorySection;
let modalOverlay;
let modalMessage;
let modalButtonYes;
let modalButtonNo;
let cameraControls;
let switchCameraButton;
let stopCameraButton;
let startCameraButton;
let vegetarianCheckbox;
let veganCheckbox;
let glutenFreeCheckbox;
let allergensToAvoid;
let dietaryAccordionButton;
let scanHistoryAccordionButton;


// --- HELPER FUNCTIONS (DEFINED GLOBALLY) ---

/**
 * Toggles the expanded state of an accordion.
 * @param {HTMLElement} button The accordion header button.
 * @param {HTMLElement} contentElement The accordion content div that follows the button.
 * @param {boolean|null} forceState If true/false, forces the state; otherwise, toggles.
 */
function toggleAccordion(button, contentElement, forceState = null) {
    // console.log(`toggleAccordion called for button:`, button, `contentElement:`, contentElement, `Force State:`, forceState);

    if (!button || !contentElement) {
        // console.error('Error: Accordion button or content element not found.', { button, contentElement });
        return;
    }

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    let newState = forceState !== null ? forceState : !isExpanded;

    button.setAttribute('aria-expanded', newState);
    contentElement.classList.toggle('hidden', !newState);
    contentElement.classList.toggle('flex', newState); // Use 'flex' if your CSS uses it for open state

    // console.log(`Accordion Button ID: ${button.id || 'dynamic'}, Content ID: ${contentElement.id || 'dynamic'}, New expanded state: ${newState}, Content classes: ${contentElement.classList.value}`);
}

/**
 * Sets up event listeners for all accordion headers.
 * This function can be called multiple times, e.g., after dynamic content loads.
 */
function setupAccordions() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        // Remove existing listener to prevent duplicates if this function is called multiple times
        // (e.g., after productInfoDiv is updated).
        // Note: The listener must be the *same function reference* to be removed.
        // If we use an anonymous function for the listener, we can't remove it.
        // So, we'll make sure the toggleAccordion call uses the elements directly.

        // We need to attach the specific toggle logic here for each header.
        // It's safer to use an anonymous function if `toggleAccordion` takes arguments
        // and is not directly assigned as the event handler.
        header.onclick = null; // Clear previous onclick handler (if any, safer than removeEventListener for anonymous)

        header.addEventListener('click', (event) => {
            // console.log('Generic Accordion Header CLICKED!', event.target);
            toggleAccordion(header, header.nextElementSibling);
        });

        // Initialize state based on 'hidden' class from HTML
        const content = header.nextElementSibling;
        if (content && content.classList.contains('hidden')) {
            header.setAttribute('aria-expanded', 'false');
        } else if (content) {
            header.setAttribute('aria-expanded', 'true');
            content.classList.add('flex'); // Ensure flex is added if it starts visible
        }
    });
}


function displayMessage(msg, type = 'info') {
    if (messageDiv) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block'; // Ensure message is visible
    } else {
        console.log(`Message (no div): [${type}] ${msg}`);
    }
}

// Custom confirmation modal
function showCustomConfirm(message, onConfirm) {
    if (!modalMessage || !modalOverlay) {
        console.error('Custom modal elements not found.');
        return Promise.resolve(false);
    }
    modalMessage.textContent = message;
    modalOverlay.style.display = 'flex'; // Use flex to center content
    return new Promise(resolve => {
        resolveModalPromise = (result) => {
            modalOverlay.style.display = 'none';
            resolve(result);
            if (result && typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    });
}

function loadDietaryPreferences() {
    const preferences = JSON.parse(localStorage.getItem('dietaryPreferences')) || {};

    if (vegetarianCheckbox) vegetarianCheckbox.checked = preferences.vegetarian || false;
    if (veganCheckbox) veganCheckbox.checked = preferences.vegan || false;
    if (glutenFreeCheckbox) glutenFreeCheckbox.checked = preferences.glutenFree || false;
    if (allergensToAvoid) allergensToAvoid.value = (preferences.allergens && preferences.allergens.length > 0) ? preferences.allergens.join(', ') : '';
}

function saveDietaryPreferences() {
    const preferences = {
        vegetarian: vegetarianCheckbox.checked,
        vegan: veganCheckbox.checked,
        glutenFree: glutenFreeCheckbox.checked,
        allergens: allergensToAvoid.value.split(',').map(item => item.trim().toLowerCase()).filter(item => item !== '')
    };
    localStorage.setItem('dietaryPreferences', JSON.stringify(preferences));
}

function clearDietaryPreferences() {
    localStorage.removeItem('dietaryPreferences');
    loadDietaryPreferences(); // Reset checkboxes and textarea
}

const MAX_HISTORY_ITEMS = 5;

function loadScanHistory() {
    const history = JSON.parse(localStorage.getItem('scanHistory')) || [];
    renderScanHistory(history);
}

function addProductToHistory(product) {
    let history = JSON.parse(localStorage.getItem('scanHistory')) || [];

    // Check if product already exists in history
    history = history.filter(item => item.upc !== product.upc);

    // Add new product to the beginning
    history.unshift({
        upc: product.upc,
        name: product.name || 'Unknown Product',
        image: product.image || 'https://via.placeholder.com/60x60?text=No+Image'
    });

    // Trim history to MAX_HISTORY_ITEMS
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    localStorage.setItem('scanHistory', JSON.stringify(history));
    renderScanHistory(history);
}

function renderScanHistory(history) {
    if (!scanHistoryList) return;

    scanHistoryList.innerHTML = '';
    if (history.length === 0) {
        scanHistoryList.innerHTML = '<li class="text-center text-gray-500 p-3">No scan history yet.</li>';
        return;
    }

    history.forEach(item => {
        const imageUrl = (item.image && item.image !== 'null' && item.image !== '') ?
            item.image :
            'https://via.placeholder.com/60x60?text=No+Image';

        const li = document.createElement('li');
        li.className = 'scan-history-item';
        li.dataset.upc = item.upc;
        li.innerHTML = `
            <img src="${imageUrl}" alt="${item.name || 'No Image'}" class="history-item-image">
            <div class="history-item-details">
                <span class="history-item-name">${item.name || 'Unknown Product'}</span>
                <span class="history-item-upc">${item.upc || 'N/A'}</span>
            </div>
        `;
        li.addEventListener('click', async () => {
            if (upcInput) upcInput.value = item.upc; // Populate input
            await fetchAndProcessProduct(item.upc, false);
            if (isScannerRunning) {
                await stopScanner(); // Stop scanner after history lookup
            }
        });
        scanHistoryList.appendChild(li);
    });
}

function clearScanHistory() {
    localStorage.removeItem('scanHistory');
    renderScanHistory([]); // Render empty list
}

function getNutrientStatusClass(nutrient, value) {
    const preferences = JSON.parse(localStorage.getItem('dietaryPreferences')) || {};

    if (value === null || isNaN(value)) {
        return '';
    }

    value = parseFloat(value);

    // Thresholds per 100g/ml (these are example values and can be adjusted)
    const thresholds = {
        calories: { low: 50, moderate: 150, high: 250 },
        protein: { good: 10 },
        carbohydrates: { moderate: 20, high: 50 },
        fat: { low: 3, moderate: 10, high: 20 },
        sugar: { low: 5, moderate: 15, high: 25 },
        salt: { low: 0.3, moderate: 1.5, high: 5 }, // Note: EU guidelines for 'low', 'high' salt are often <0.3g and >1.5g per 100g
        fiber: { good: 3 }
    };

    switch (nutrient) {
        case 'calories':
            if (value <= thresholds.calories.low) return 'nutrient-low';
            if (value > thresholds.calories.high) return 'nutrient-high';
            return 'nutrient-moderate';
        case 'protein':
            if (value >= thresholds.protein.good) return 'nutrient-good';
            return 'nutrient-low'; // Or no class if not "good"
        case 'carbohydrates':
            if (value > thresholds.carbohydrates.high) return 'nutrient-high';
            if (value >= thresholds.carbohydrates.moderate) return 'nutrient-moderate';
            return 'nutrient-low';
        case 'fat':
            if (value > thresholds.fat.high) return 'nutrient-high';
            if (value >= thresholds.fat.moderate) return 'nutrient-moderate';
            return 'nutrient-low';
        case 'sugar':
            if (value > thresholds.sugar.high) return 'nutrient-high';
            if (value >= thresholds.sugar.moderate) return 'nutrient-moderate';
            return 'nutrient-low';
        case 'salt':
            if (value > thresholds.salt.high) return 'nutrient-high'; // Over 1.5g per 100g is often considered high
            if (value >= thresholds.salt.low) return 'nutrient-moderate'; // Between 0.3g and 1.5g
            return 'nutrient-low'; // Below 0.3g
        case 'fiber':
            if (value >= thresholds.fiber.good) return 'nutrient-good';
            return 'nutrient-low'; // Or no class if not "good"
        default:
            return '';
    }
}

function deduplicateIngredients(ingredientsString) {
    if (!ingredientsString) return 'Ingredients list not available.';

    // Split by common delimiters, clean up, and filter out empty strings
    const rawIngredients = ingredientsString.split(/[,.;:()]/).map(item => item.trim()).filter(item => item.length > 0);

    // Convert to lowercase for case-insensitive comparison
    const lowercasedIngredients = rawIngredients.map(item => item.toLowerCase());

    const uniqueIngredients = new Set();
    const resultIngredients = [];

    rawIngredients.forEach((original, index) => {
        const lower = lowercasedIngredients[index];
        if (!uniqueIngredients.has(lower)) {
            uniqueIngredients.add(lower);
            resultIngredients.push(original);
        }
    });

    return resultIngredients.join(', ');
}

async function fetchAndProcessProduct(upc, isScanned = false) {
    displayMessage('Searching for product...', 'info');
    if (productInfoDiv) {
        productInfoDiv.innerHTML = ''; // Clear previous product info
        productInfoDiv.classList.remove('error-card');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/ingredients/${upc}`);
        const data = await response.json();

        if (response.ok) {
            if (data && data.name) {
                displayProductInfo(data);
                // CRUCIAL: Re-setup accordions AFTER product info is rendered
                setTimeout(() => {
                    setupAccordions();
                    // Auto-expand specific accordions after a scan/lookup:
                    // Force Dietary Preferences accordion to open
                    if (dietaryAccordionButton && document.getElementById('dietary-information-body')) {
                        toggleAccordion(dietaryAccordionButton, document.getElementById('dietary-information-body'), true);
                    }
                    // Force Scan History accordion to open
                    if (scanHistoryAccordionButton && document.getElementById('scan-history-body')) {
                        toggleAccordion(scanHistoryAccordionButton, document.getElementById('scan-history-body'), true);
                    }

                    // Auto-expand the "Ingredients" accordion in the product details
                    const ingredientsHeader = productInfoDiv.querySelector('.section-card .accordion-header');
                    if (ingredientsHeader && ingredientsHeader.nextElementSibling) {
                        toggleAccordion(ingredientsHeader, ingredientsHeader.nextElementSibling, true);
                    }

                }, 50); // Small delay to ensure DOM is ready and accordions are set up
                if (isScanned) {
                    addProductToHistory(data);
                }
                displayMessage(`Found: ${data.name}`, 'success');
            } else {
                displayMessage(`Product with UPC ${upc} not found or data incomplete.`, 'warning');
                if (productInfoDiv) productInfoDiv.innerHTML = '<p class="no-product">Product not found. Please try another UPC or scan again.</p>';
            }
        } else {
            const errorMsg = data.message || 'An error occurred while fetching product data.';
            displayMessage(`Error: ${errorMsg}`, 'error');
            if (productInfoDiv) productInfoDiv.innerHTML = `<div class="info-card error-card"><h2>Error</h2><p>${errorMsg}</p></div>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        displayMessage(`Network error or API unavailable: ${error.message}`, 'error');
        if (productInfoDiv) productInfoDiv.innerHTML = `<div class="info-card error-card"><h2>Network Error</h2><p>Could not connect to the server or API. Please check your internet connection.</p></div>`;
    }
}


function displayProductInfo(product) {
    if (!productInfoDiv) return; // Ensure productInfoDiv is available

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

   // client.js

// Global variables
let html5QrcodeScanner;
let isScannerRunning = false;
let lastScannedCode = null;
let lastScanTimestamp = 0;
const LAST_SCAN_DEBOUNCE_MS = 1500; // 1.5 seconds debounce

let availableCameras = [];
let currentCameraId = null;

// API Base URL (replace with your actual server URL if different)
const API_BASE_URL = 'https://upc-scanner-backend-api.onrender.com/api'; // Or your deployed backend URL

// State variables for custom modal
let resolveModalPromise;

// --- GLOBAL DOM Element References (declared here, assigned in DOMContentLoaded) ---
// These are declared globally so other functions (like displayMessage, stopScanner) can access them.
// Their values will be assigned once the DOM is fully loaded.
let upcInput;
let scanButton;
let lookupButton;
let productInfoDiv;
let messageDiv;
let scannerContainer;
let scanHistoryList;
let clearHistoryButton;
let savePreferencesButton;
let clearPreferencesButton;
// Removed: dietaryPreferencesSection; // No longer a main section
// Removed: scanHistorySection;     // No longer a main section
let modalOverlay;
let modalMessage;
let modalButtonYes;
let modalButtonNo;
let cameraControls;
let switchCameraButton;
let stopCameraButton;
let startCameraButton;
let vegetarianCheckbox;
let veganCheckbox;
let glutenFreeCheckbox;
let allergensToAvoid;
// Removed: dietaryAccordionButton; // No longer an accordion
// Removed: scanHistoryAccordionButton; // No longer an accordion

// NEW: Sidebar DOM elements
let sidebar;
let sidebarOverlay;
let sidebarToggleButton;
let sidebarCloseButton;


// --- HELPER FUNCTIONS (DEFINED GLOBALLY) ---

/**
 * Toggles the expanded state of an accordion.
 * @param {HTMLElement} button The accordion header button.
 * @param {HTMLElement} contentElement The accordion content div that follows the button.
 * @param {boolean|null} forceState If true/false, forces the state; otherwise, toggles.
 */
function toggleAccordion(button, contentElement, forceState = null) {
    // console.log(`toggleAccordion called for button:`, button, `contentElement:`, contentElement, `Force State:`, forceState);

    if (!button || !contentElement) {
        // console.error('Error: Accordion button or content element not found.', { button, contentElement });
        return;
    }

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    let newState = forceState !== null ? forceState : !isExpanded;

    button.setAttribute('aria-expanded', newState);
    contentElement.classList.toggle('hidden', !newState);
    contentElement.classList.toggle('flex', newState); // Use 'flex' if your CSS uses it for open state

    // console.log(`Accordion Button ID: ${button.id || 'dynamic'}, Content ID: ${contentElement.id || 'dynamic'}, New expanded state: ${newState}, Content classes: ${contentElement.classList.value}`);
}

/**
 * Sets up event listeners for all accordion headers.
 * This function can be called multiple times, e.g., after dynamic content loads.
 */
function setupAccordions() {
    // Selects only accordions that are direct children of a .section-card (product details accordions)
    const accordionHeaders = productInfoDiv.querySelectorAll('.section-card .accordion-header'); // IMPORTANT: Only apply to product details
    accordionHeaders.forEach(header => {
        // Remove existing listener to prevent duplicates if this function is called multiple times
        // (e.g., after productInfoDiv is updated).
        // It's safer to use an anonymous function if `toggleAccordion` takes arguments
        // and is not directly assigned as the event handler.
        header.onclick = null; // Clear previous onclick handler (if any, safer than removeEventListener for anonymous)

        header.addEventListener('click', (event) => {
            // console.log('Generic Accordion Header CLICKED!', event.target);
            toggleAccordion(header, header.nextElementSibling);
        });

        // Initialize state based on 'hidden' class from HTML
        const content = header.nextElementSibling;
        if (content && content.classList.contains('hidden')) {
            header.setAttribute('aria-expanded', 'false');
        } else if (content) {
            header.setAttribute('aria-expanded', 'true');
            content.classList.add('flex'); // Ensure flex is added if it starts visible
        }
    });
}


function displayMessage(msg, type = 'info') {
    if (messageDiv) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block'; // Ensure message is visible
    } else {
        console.log(`Message (no div): [${type}] ${msg}`);
    }
}

// Custom confirmation modal
function showCustomConfirm(message, onConfirm) {
    if (!modalMessage || !modalOverlay) {
        console.error('Custom modal elements not found.');
        return Promise.resolve(false);
    }
    modalMessage.textContent = message;
    modalOverlay.style.display = 'flex'; // Use flex to center content
    return new Promise(resolve => {
        resolveModalPromise = (result) => {
            modalOverlay.style.display = 'none';
            resolve(result);
            if (result && typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    });
}

function loadDietaryPreferences() {
    const preferences = JSON.parse(localStorage.getItem('dietaryPreferences')) || {};

    if (vegetarianCheckbox) vegetarianCheckbox.checked = preferences.vegetarian || false;
    if (veganCheckbox) veganCheckbox.checked = preferences.vegan || false;
    if (glutenFreeCheckbox) glutenFreeCheckbox.checked = preferences.glutenFree || false;
    if (allergensToAvoid) allergensToAvoid.value = (preferences.allergens && preferences.allergens.length > 0) ? preferences.allergens.join(', ') : '';
}

function saveDietaryPreferences() {
    const preferences = {
        vegetarian: vegetarianCheckbox.checked,
        vegan: veganCheckbox.checked,
        glutenFree: glutenFreeCheckbox.checked,
        allergens: allergensToAvoid.value.split(',').map(item => item.trim().toLowerCase()).filter(item => item !== '')
    };
    localStorage.setItem('dietaryPreferences', JSON.stringify(preferences));
}

function clearDietaryPreferences() {
    localStorage.removeItem('dietaryPreferences');
    loadDietaryPreferences(); // Reset checkboxes and textarea
}

const MAX_HISTORY_ITEMS = 5;

function loadScanHistory() {
    const history = JSON.parse(localStorage.getItem('scanHistory')) || [];
    renderScanHistory(history);
}

function addProductToHistory(product) {
    let history = JSON.parse(localStorage.getItem('scanHistory')) || [];

    // Check if product already exists in history
    history = history.filter(item => item.upc !== product.upc);

    // Add new product to the beginning
    history.unshift({
        upc: product.upc,
        name: product.name || 'Unknown Product',
        image: product.image || 'https://via.placeholder.com/60x60?text=No+Image'
    });

    // Trim history to MAX_HISTORY_ITEMS
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    localStorage.setItem('scanHistory', JSON.stringify(history));
    renderScanHistory(history);
}

function renderScanHistory(history) {
    if (!scanHistoryList) return;

    scanHistoryList.innerHTML = '';
    if (history.length === 0) {
        scanHistoryList.innerHTML = '<li class="text-center text-gray-500 p-3">No scan history yet.</li>';
        return;
    }

    history.forEach(item => {
        const imageUrl = (item.image && item.image !== 'null' && item.image !== '') ?
            item.image :
            'https://via.placeholder.com/60x60?text=No+Image';

        const li = document.createElement('li');
        li.className = 'scan-history-item';
        li.dataset.upc = item.upc;
        li.innerHTML = `
            <img src="${imageUrl}" alt="${item.name || 'No Image'}" class="history-item-image">
            <div class="history-item-details">
                <span class="history-item-name">${item.name || 'Unknown Product'}</span>
                <span class="history-item-upc">${item.upc || 'N/A'}</span>
            </div>
        `;
        li.addEventListener('click', async () => {
            if (upcInput) upcInput.value = item.upc; // Populate input
            await fetchAndProcessProduct(item.upc, false);
            if (isScannerRunning) {
                await stopScanner(); // Stop scanner after history lookup
            }
            // Close sidebar after clicking a history item
            toggleSidebar(false);
        });
        scanHistoryList.appendChild(li);
    });
}

function clearScanHistory() {
    localStorage.removeItem('scanHistory');
    renderScanHistory([]); // Render empty list
}

function getNutrientStatusClass(nutrient, value) {
    const preferences = JSON.parse(localStorage.getItem('dietaryPreferences')) || {};

    if (value === null || isNaN(value)) {
        return '';
    }

    value = parseFloat(value);

    // Thresholds per 100g/ml (these are example values and can be adjusted)
    const thresholds = {
        calories: { low: 50, moderate: 150, high: 250 },
        protein: { good: 10 },
        carbohydrates: { moderate: 20, high: 50 },
        fat: { low: 3, moderate: 10, high: 20 },
        sugar: { low: 5, moderate: 15, high: 25 },
        salt: { low: 0.3, moderate: 1.5, high: 5 }, // Note: EU guidelines for 'low', 'high' salt are often <0.3g and >1.5g per 100g
        fiber: { good: 3 }
    };

    switch (nutrient) {
        case 'calories':
            if (value <= thresholds.calories.low) return 'nutrient-low';
            if (value > thresholds.calories.high) return 'nutrient-high';
            return 'nutrient-moderate';
        case 'protein':
            if (value >= thresholds.protein.good) return 'nutrient-good';
            return 'nutrient-low'; // Or no class if not "good"
        case 'carbohydrates':
            if (value > thresholds.carbohydrates.high) return 'nutrient-high';
            if (value >= thresholds.carbohydrates.moderate) return 'nutrient-moderate';
            return 'nutrient-low';
        case 'fat':
            if (value > thresholds.fat.high) return 'nutrient-high';
            if (value >= thresholds.fat.moderate) return 'nutrient-moderate';
            return 'nutrient-low';
        case 'sugar':
            if (value > thresholds.sugar.high) return 'nutrient-high';
            if (value >= thresholds.sugar.moderate) return 'nutrient-moderate';
            return 'nutrient-low';
        case 'salt':
            if (value > thresholds.salt.high) return 'nutrient-high'; // Over 1.5g per 100g is often considered high
            if (value >= thresholds.salt.low) return 'nutrient-moderate'; // Between 0.3g and 1.5g
            return 'nutrient-low'; // Below 0.3g
        case 'fiber':
            if (value >= thresholds.fiber.good) return 'nutrient-good';
            return 'nutrient-low'; // Or no class if not "good"
        default:
            return '';
    }
}

function deduplicateIngredients(ingredientsString) {
    if (!ingredientsString) return 'Ingredients list not available.';

    // Split by common delimiters, clean up, and filter out empty strings
    const rawIngredients = ingredientsString.split(/[,.;:()]/).map(item => item.trim()).filter(item => item.length > 0);

    // Convert to lowercase for case-insensitive comparison
    const lowercasedIngredients = rawIngredients.map(item => item.toLowerCase());

    const uniqueIngredients = new Set();
    const resultIngredients = [];

    rawIngredients.forEach((original, index) => {
        const lower = lowercasedIngredients[index];
        if (!uniqueIngredients.has(lower)) {
            uniqueIngredients.add(lower);
            resultIngredients.push(original);
        }
    });

    return resultIngredients.join(', ');
}

async function fetchAndProcessProduct(upc, isScanned = false) {
    displayMessage('Searching for product...', 'info');
    if (productInfoDiv) {
        productInfoDiv.innerHTML = ''; // Clear previous product info
        productInfoDiv.classList.remove('error-card');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/ingredients/${upc}`);
        const data = await response.json();

        if (response.ok) {
            if (data && data.name) {
                displayProductInfo(data);
                // CRUCIAL: Re-setup accordions AFTER product info is rendered
                setTimeout(() => {
                    setupAccordions(); // This will only apply to product detail accordions now
                    // Auto-expand the "Ingredients" accordion in the product details
                    const ingredientsHeader = productInfoDiv.querySelector('.section-card .accordion-header');
                    if (ingredientsHeader && ingredientsHeader.nextElementSibling) {
                        toggleAccordion(ingredientsHeader, ingredientsHeader.nextElementSibling, true);
                    }
                }, 50); // Small delay to ensure DOM is ready and accordions are set up
                if (isScanned) {
                    addProductToHistory(data);
                }
                displayMessage(`Found: ${data.name}`, 'success');
            } else {
                displayMessage(`Product with UPC ${upc} not found or data incomplete.`, 'warning');
                if (productInfoDiv) productInfoDiv.innerHTML = '<p class="no-product">Product not found. Please try another UPC or scan again.</p>';
            }
        } else {
            const errorMsg = data.message || 'An error occurred while fetching product data.';
            displayMessage(`Error: ${errorMsg}`, 'error');
            if (productInfoDiv) productInfoDiv.innerHTML = `<div class="info-card error-card"><h2>Error</h2><p>${errorMsg}</p></div>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        displayMessage(`Network error or API unavailable: ${error.message}`, 'error');
        if (productInfoDiv) productInfoDiv.innerHTML = `<div class="info-card error-card"><h2>Network Error</h2><p>Could not connect to the server or API. Please check your internet connection.</p></div>`;
    }
}


function displayProductInfo(product) {
    if (!productInfoDiv) return; // Ensure productInfoDiv is available

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
                <button class="accordion-header" aria-expanded="false">
                    <h2>Ingredients <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content hidden">
                    <p>${displayIngredients || 'Ingredients list not available.'}</p>
                </div>
            </div>
        `;

    html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false">
                    <h2>Allergens <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content hidden">
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
                    <button class="accordion-header" aria-expanded="false">
                        <h2>Additives <span class="arrow">▼</span></h2>
                    </button>
                    <div class="accordion-content hidden">
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
            } else if (add.status && (add.status !== 'Not banned in EU' && add.status !== 'Unknown Status' && add.status !== 'Details from Wikipedia.')) {
                statusText = add.status;
                statusClass += ' info';
            } else if (add.status && (add.status === 'Unknown Status' || add.status === 'Details from Wikipedia.')) {
                statusText = 'Info limited';
                statusClass += ' info';
            } else {
                statusClass = ''; // No specific status class if none of the above
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
                    <button class="accordion-header" aria-expanded="false">
                        <h2>Additives <span class="arrow">▼</span></h2>
                    </button>
                    <div class="accordion-content hidden">
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
                    <button class="accordion-header" aria-expanded="false">
                        <h2>Nutrition Facts <small>${servingSizeText}</small> <span class="arrow">▼</span></h2>
                    </button>
                    <div class="accordion-content hidden">
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
                <button class="accordion-header" aria-expanded="false">
                    <h2>Data Source <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content hidden">
                    <p>Information provided by ${product.source || 'Open Food Facts'}.</p>
                </div>
            </div>
        `;

    productInfoDiv.innerHTML = html;
    // Removed direct call to setupAccordions() here.
    // It is now handled by a setTimeout in fetchAndProcessProduct to ensure DOM is fully ready.
}


async function onScanSuccess(decodedText, decodedResult) {
    const currentTime = new Date().getTime();

    if (decodedText === lastScannedCode && (currentTime - lastScanTimestamp < LAST_SCAN_DEBOUNCE_MS)) {
        // console.log("Debouncing: Same code scanned too quickly.");
        return;
    }

    lastScannedCode = decodedText;
    lastScanTimestamp = currentTime;

    // console.log(`Scan result: ${decodedText}`, decodedResult);
    if (upcInput) upcInput.value = decodedText;

    await fetchAndProcessProduct(decodedText, true);
}

function onScanError(errorMessage) {
    if (isScannerRunning) {
        // console.warn('Scanner error during active scan:', errorMessage);
    }
}

async function initializeScanner(cameraId) {
    if (html5QrcodeScanner && isScannerRunning) {
        // console.log("Stopping existing scanner to re-initialize.");
        await stopScanner();
    }

    if (scannerContainer) scannerContainer.innerHTML = '';
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
        if (cameraControls) cameraControls.style.display = 'flex'; // Show camera controls once scanner starts
    } catch (err) {
        console.error('Error starting scanner with ID ' + cameraId + ':', err);
        isScannerRunning = false;
        if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls on error
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
        if (scannerContainer) scannerContainer.innerHTML = '<p>Camera access denied or error. Please check permissions.</p>';
    }
}

async function getCameras() {
    try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
            availableCameras = cameras;
            // Prefer back camera if available
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
        // console.log("Scanner already running, ignoring repeated request.");
        return;
    }

    displayMessage('Requesting camera access...', 'info');
    if (scannerContainer) scannerContainer.innerHTML = '<p>Waiting for camera permission...</p>';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop stream immediately after getting permission

        const defaultCameraId = await getCameras();
        if (defaultCameraId) {
            await initializeScanner(defaultCameraId);
        } else {
            displayMessage('No suitable camera found on this device after permission was granted.', 'error');
            if (scannerContainer) scannerContainer.innerHTML = '<p>No camera devices detected or available.</p>';
            if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls if no camera
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
        if (scannerContainer) scannerContainer.innerHTML = '<p>' + userFriendlyMessage + '</p>';
        if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls on error
    }
}

async function stopScanner() {
    return new Promise(async (resolve) => {
        if (isScannerRunning && html5QrcodeScanner) {
            try {
                await html5QrcodeScanner.stop();
                isScannerRunning = false;
                displayMessage('Scanner stopped. Ready for next scan.', 'info');

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
                if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls when scanner stops

                // Re-setup accordions after a tiny delay to allow DOM to settle from scanner removal
                setTimeout(() => {
                    // console.log("Re-running setupAccordions after scanner stop cleanup.");
                    setupAccordions(); // Re-enable accordions on the rest of the page if needed
                }, 100); // 100ms delay
            } catch (err) {
                console.error('Error stopping scanner:', err);
                displayMessage('Error stopping scanner. It might already be stopped or camera access is blocked.', 'error');
                isScannerRunning = false;
                if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls on error
            }
        }
        resolve();
    });
}

/**
 * Toggles the visibility of the sidebar and its overlay.
 * @param {boolean|null} forceState If true/false, forces the state; otherwise, toggles.
 */
function toggleSidebar(forceState = null) {
    if (!sidebar || !sidebarOverlay) {
        console.error('Sidebar or overlay elements not found.');
        return;
    }

    const isSidebarOpen = sidebar.classList.contains('sidebar-open');
    let newState = forceState !== null ? forceState : !isSidebarOpen;

    if (newState) {
        sidebar.classList.add('sidebar-open');
        sidebarOverlay.classList.add('sidebar-overlay-active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling on main content
    } else {
        sidebar.classList.remove('sidebar-open');
        sidebarOverlay.classList.remove('sidebar-overlay-active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}


// --- DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements AFTER the document is fully loaded
    upcInput = document.getElementById('upcInput');
    scanButton = document.getElementById('scanButton');
    lookupButton = document.getElementById('lookupButton');
    productInfoDiv = document.getElementById('productInfo');
    messageDiv = document.getElementById('message');
    scannerContainer = document.getElementById('scanner-container');
    scanHistoryList = document.getElementById('scanHistoryList');
    clearHistoryButton = document.getElementById('clearHistoryButton');
    savePreferencesButton = document.getElementById('savePreferencesButton');
    clearPreferencesButton = document.getElementById('clearPreferencesButton');
    // dietaryPreferencesSection = document.getElementById('dietaryPreferencesSection'); // Removed
    // scanHistorySection = document.getElementById('scanHistorySection');         // Removed
    modalOverlay = document.getElementById('customConfirmModal');
    modalMessage = document.getElementById('customConfirmMessage');
    modalButtonYes = document.getElementById('modalConfirmYes');
    modalButtonNo = document.getElementById('modalConfirmNo');
    cameraControls = document.getElementById('cameraControls');
    switchCameraButton = document.getElementById('switchCameraButton');
    stopCameraButton = document.getElementById('stopCameraButton');
    startCameraButton = document.getElementById('startCameraButton');
    vegetarianCheckbox = document.getElementById('vegetarianCheckbox');
    veganCheckbox = document.getElementById('veganCheckbox');
    glutenFreeCheckbox = document.getElementById('glutenFreeCheckbox');
    allergensToAvoid = document.getElementById('allergensToAvoid');
    // dietaryAccordionButton = document.getElementById('dietary-information-accordion-button'); // Removed
    // scanHistoryAccordionButton = document.getElementById('scan-history-accordion-button');     // Removed

    // NEW: Assign sidebar DOM elements
    sidebar = document.getElementById('sidebar');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    sidebarToggleButton = document.getElementById('sidebarToggleButton');
    sidebarCloseButton = document.getElementById('sidebarCloseButton');


    // Initial display of sections
    if (productInfoDiv) productInfoDiv.innerHTML = '<p class="no-product">Scan a barcode or enter a UPC to get started!</p>';
    displayMessage('Welcome! Enter a UPC or click "Start Scan" to begin.', 'info');

    // Load preferences and history on startup
    loadDietaryPreferences();
    loadScanHistory();

    // Event Listeners
    if (lookupButton && upcInput) {
        lookupButton.addEventListener('click', async () => {
            const upc = upcInput.value.trim();
            if (upc) {
                await fetchAndProcessProduct(upc, false);
                // After manual lookup, stop scanner if running, to free up camera
                if (isScannerRunning) {
                    await stopScanner();
                }
            } else {
                displayMessage('Please enter a UPC.', 'warning');
            }
        });
    }

    // Removed specific accordion listeners for dietaryPreferencesSection and scanHistorySection
    // as they are now part of the sidebar and not accordions in the main content.

    if (scanButton && scannerContainer) {
        scanButton.addEventListener('click', async () => {
            if (!isScannerRunning) {
                scannerContainer.style.display = 'block'; // Show scanner container
                await requestCameraAccess();
                scanButton.textContent = 'Hide Scanner'; // Change button text
            } else {
                await stopScanner();
                scannerContainer.style.display = 'none'; // Hide scanner container
                scanButton.textContent = 'Start Scan'; // Change button text
            }
        });
    }

    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', () => {
            showCustomConfirm('Are you sure you want to clear your scan history?', () => {
                clearScanHistory();
                displayMessage('Scan history cleared.', 'success');
            });
        });
    }

    if (savePreferencesButton) {
        savePreferencesButton.addEventListener('click', () => {
            saveDietaryPreferences();
            displayMessage('Dietary preferences saved!', 'success');
        });
    }

    if (clearPreferencesButton) {
        clearPreferencesButton.addEventListener('click', () => {
            showCustomConfirm('Are you sure you want to clear all dietary preferences?', () => {
                clearDietaryPreferences();
                displayMessage('Dietary preferences cleared.', 'success');
            });
        });
    }

    if (switchCameraButton) {
        switchCameraButton.addEventListener('click', async () => {
            if (availableCameras.length > 1 && isScannerRunning) {
                const currentIndex = availableCameras.findIndex(camera => camera.id === currentCameraId);
                const nextIndex = (currentIndex + 1) % availableCameras.length;
                const nextCamera = availableCameras[nextIndex];
                displayMessage(`Switching to camera: ${nextCamera.label || 'unknown'}`, 'info');
                await stopScanner();
                await initializeScanner(nextCamera.id);
            } else if (availableCameras.length <= 1) {
                displayMessage('No other cameras available to switch to.', 'warning');
            } else if (!isScannerRunning) {
                displayMessage('Scanner is not running. Start the scanner first.', 'warning');
            }
        });
    }

    if (stopCameraButton) {
        stopCameraButton.addEventListener('click', async () => {
            if (isScannerRunning) {
                await stopScanner();
                if (scannerContainer) scannerContainer.style.display = 'none';
                if (scanButton) scanButton.textContent = 'Start Scan';
            } else {
                displayMessage('Scanner is not running.', 'info');
            }
        });
    }

    if (startCameraButton && scannerContainer) {
        startCameraButton.addEventListener('click', async () => {
            if (!isScannerRunning) {
                scannerContainer.style.display = 'block';
                await requestCameraAccess();
                if (scanButton) scanButton.textContent = 'Hide Scanner';
            } else {
                displayMessage('Scanner is already running.', 'warning');
            }
        });
    }

    // Custom Confirmation Modal Listeners
    if (modalButtonYes && modalOverlay) {
        modalButtonYes.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            resolveModalPromise(true);
        });
    }

    if (modalButtonNo && modalOverlay) {
        modalButtonNo.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            resolveModalPromise(false);
        });
    }

    // NEW: Sidebar Event Listeners
    if (sidebarToggleButton) {
        sidebarToggleButton.addEventListener('click', () => {
            toggleSidebar(); // Toggle sidebar state
        });
    }

    if (sidebarCloseButton) {
        sidebarCloseButton.addEventListener('click', () => {
            toggleSidebar(false); // Force close sidebar
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            toggleSidebar(false); // Force close sidebar when clicking overlay
        });
    }

    // Initial setup for accordions (now only applies to product detail sections)
    setupAccordions();

}); // End DOMContentLoaded