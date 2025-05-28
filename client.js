// Global variables
let html5QrcodeScanner;
let isScannerRunning = false;
let lastScannedCode = null;
let lastScanTimestamp = 0;
const LAST_SCAN_DEBOUNCE_MS = 1500; // 1.5 seconds debounce

let availableCameras = [];
let currentCameraId = null;

// DOM Elements
const upcInput = document.getElementById('upcInput');
const scanButton = document.getElementById('scanButton');
const lookupButton = document.getElementById('lookupButton');
const productInfoDiv = document.getElementById('productInfo');
const messageDiv = document.getElementById('message');
const scannerContainer = document.getElementById('scanner-container');
const scanHistoryList = document.getElementById('scanHistoryList');
const clearHistoryButton = document.getElementById('clearHistoryButton');
const savePreferencesButton = document.getElementById('savePreferencesButton');
const clearPreferencesButton = document.getElementById('clearPreferencesButton');
const dietaryPreferencesSection = document.getElementById('dietaryPreferencesSection');
const scanHistorySection = document.getElementById('scanHistorySection');
const modalOverlay = document.getElementById('customConfirmModal');
const modalMessage = document.getElementById('customConfirmMessage');
const modalButtonYes = document.getElementById('modalConfirmYes');
const modalButtonNo = document.getElementById('modalConfirmNo');
const cameraControls = document.getElementById('cameraControls'); // New camera controls container
const switchCameraButton = document.getElementById('switchCameraButton'); // New switch camera button
const stopCameraButton = document.getElementById('stopCameraButton'); // New stop camera button
const startCameraButton = document.getElementById('startCameraButton'); // New start camera button

// API Base URL (replace with your actual server URL if different)
const API_BASE_URL = 'http://localhost:3000/api'; // Or your deployed backend URL

// State variables for custom modal
let resolveModalPromise;

document.addEventListener('DOMContentLoaded', () => {
    // Initial display of sections
    productInfoDiv.innerHTML = '<p class="no-product">Scan a barcode or enter a UPC to get started!</p>';
    displayMessage('Welcome! Enter a UPC or click "Start Scan" to begin.', 'info');

    // Load preferences and history on startup
    loadDietaryPreferences();
    loadScanHistory();

    // Event Listeners
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

    clearHistoryButton.addEventListener('click', () => {
        showCustomConfirm('Are you sure you want to clear your scan history?', () => {
            clearScanHistory();
            displayMessage('Scan history cleared.', 'success');
        });
    });

    savePreferencesButton.addEventListener('click', () => {
        saveDietaryPreferences();
        displayMessage('Dietary preferences saved!', 'success');
    });

    clearPreferencesButton.addEventListener('click', () => {
        showCustomConfirm('Are you sure you want to clear all dietary preferences?', () => {
            clearDietaryPreferences();
            displayMessage('Dietary preferences cleared.', 'success');
        });
    });

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

    stopCameraButton.addEventListener('click', async () => {
        if (isScannerRunning) {
            await stopScanner();
            scannerContainer.style.display = 'none';
            scanButton.textContent = 'Start Scan';
        } else {
            displayMessage('Scanner is not running.', 'info');
        }
    });

    startCameraButton.addEventListener('click', async () => {
        if (!isScannerRunning) {
            scannerContainer.style.display = 'block';
            await requestCameraAccess();
            scanButton.textContent = 'Hide Scanner';
        } else {
            displayMessage('Scanner is already running.', 'warning');
        }
    });


    // Custom Confirmation Modal Listeners
    modalButtonYes.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
        resolveModalPromise(true);
    });

    modalButtonNo.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
        resolveModalPromise(false);
    });

    // Initial setup for static accordions (Preferences, History)
    // The accordions related to product details will be set up after scan
    setupAccordions();

}); // End DOMContentLoaded

// Helper functions

function displayMessage(msg, type = 'info') {
    messageDiv.textContent = msg;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block'; // Ensure message is visible
}

// Custom confirmation modal
function showCustomConfirm(message, onConfirm) {
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

    document.getElementById('vegetarianCheckbox').checked = preferences.vegetarian || false;
    document.getElementById('veganCheckbox').checked = preferences.vegan || false;
    document.getElementById('glutenFreeCheckbox').checked = preferences.glutenFree || false;
    document.getElementById('allergensToAvoid').value = (preferences.allergens && preferences.allergens.length > 0) ? preferences.allergens.join(', ') : '';
}

function saveDietaryPreferences() {
    const preferences = {
        vegetarian: document.getElementById('vegetarianCheckbox').checked,
        vegan: document.getElementById('veganCheckbox').checked,
        glutenFree: document.getElementById('glutenFreeCheckbox').checked,
        allergens: document.getElementById('allergensToAvoid').value.split(',').map(item => item.trim().toLowerCase()).filter(item => item !== '')
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
    scanHistoryList.innerHTML = '';
    if (history.length === 0) {
        scanHistoryList.innerHTML = '<li class="text-center text-gray-500 p-3">No scan history yet.</li>';
        return;
    }

    history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'scan-history-item';
        li.dataset.upc = item.upc;
        li.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="history-item-image">
            <div class="history-item-details">
                <span class="history-item-name">${item.name}</span>
                <span class="history-item-upc">${item.upc}</span>
            </div>
        `;
        li.addEventListener('click', async () => {
            upcInput.value = item.upc; // Populate input
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
    productInfoDiv.innerHTML = ''; // Clear previous product info
    productInfoDiv.classList.remove('error-card');

    try {
        const response = await fetch(`${API_BASE_URL}/product/${upc}`);
        const data = await response.json();

        if (response.ok) {
            if (data && data.name) {
                displayProductInfo(data);
                // CRUCIAL: Re-setup accordions AFTER product info is rendered
                setTimeout(() => {
                    setupAccordions();
                }, 50); // Small delay to ensure DOM is ready
                if (isScanned) {
                    addProductToHistory(data);
                }
                displayMessage(`Found: ${data.name}`, 'success');
            } else {
                displayMessage(`Product with UPC ${upc} not found or data incomplete.`, 'warning');
                productInfoDiv.innerHTML = '<p class="no-product">Product not found. Please try another UPC or scan again.</p>';
            }
        } else {
            const errorMsg = data.message || 'An error occurred while fetching product data.';
            displayMessage(`Error: ${errorMsg}`, 'error');
            productInfoDiv.innerHTML = `<div class="info-card error-card"><h2>Error</h2><p>${errorMsg}</p></div>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        displayMessage(`Network error or API unavailable: ${error.message}`, 'error');
        productInfoDiv.innerHTML = `<div class="info-card error-card"><h2>Network Error</h2><p>Could not connect to the server or API. Please check your internet connection.</p></div>`;
    }
}


function displayProductInfo(product) {
    const productInfoDiv = document.getElementById('productInfo');
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
    // Removed direct call to setupAccordions() here.
    // It is now handled by a setTimeout in fetchAndProcessProduct to ensure DOM is fully ready.
}

function setupAccordions() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        // Crucial: remove existing listener to prevent duplicates
        header.removeEventListener('click', toggleAccordion);
        // Add new listener
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

// setupAccordions(); // Initial setup for static accordions on page load is done inside DOMContentLoaded

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
        // Hide scanner controls initially, only show when needed or scanner is active
        cameraControls.style.display = 'flex'; // Show camera controls once scanner starts
    } catch (err) {
        console.error('Error starting scanner with ID ' + cameraId + ':', err);
        isScannerRunning = false;
        cameraControls.style.display = 'none'; // Hide camera controls on error
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
        console.log("Scanner already running, ignoring repeated request.");
        return;
    }

    displayMessage('Requesting camera access...', 'info');
    scannerContainer.innerHTML = '<p>Waiting for camera permission...</p>';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop stream immediately after getting permission

        const defaultCameraId = await getCameras();
        if (defaultCameraId) {
            await initializeScanner(defaultCameraId);
        } else {
            displayMessage('No suitable camera found on this device after permission was granted.', 'error');
            scannerContainer.innerHTML = '<p>No camera devices detected or available.</p>';
            cameraControls.style.display = 'none'; // Hide camera controls if no camera
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
        cameraControls.style.display = 'none'; // Hide camera controls on error
    }
}

async function stopScanner() {
    return new Promise(async (resolve) => {
        if (isScannerRunning && html5QrcodeScanner) {
            try {
                await html5QrcodeScanner.stop();
                isScannerRunning = false;
                displayMessage('Scanner stopped. Ready for next scan.', 'info');

                // --- START OF NEW/IMPROVED CLEANUP CODE ---
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
                cameraControls.style.display = 'none'; // Hide camera controls when scanner stops
                // --- END OF NEW/IMPROVED CLEANUP CODE ---

                // Re-setup accordions after a tiny delay to allow DOM to settle from scanner removal
                setTimeout(() => {
                    console.log("Re-running setupAccordions after scanner stop cleanup.");
                    setupAccordions(); // Re-enable accordions on the rest of the page if needed
                }, 100); // 100ms delay
            } catch (err) {
                console.error('Error stopping scanner:', err);
                displayMessage('Error stopping scanner. It might already be stopped or camera access is blocked.', 'error');
                isScannerRunning = false;
                cameraControls.style.display = 'none'; // Hide camera controls on error
            }
        }
        resolve();
    });
}

// Initial display adjustments and automatic camera request on load
// displayMessage('Attempting to access camera...', 'info');
// Automatically try to request camera access if desired, or leave commented out for manual start
// requestCameraAccess();