// Global Variables (Declare these at the very top of your client.js file)
let upcInput;
let lookupButton;
let productInfoDiv;
let messageDiv;
let scannerContainer;
let scanHistoryList;
let clearHistoryButton;
let savePreferencesButton;
let clearPreferencesButton;
let modalOverlay;
let modalMessage;
let modalButtonYes;
let modalButtonNo;
let cameraControls;
let switchCameraButton;
let stopCameraButton;
let startCameraButton; // New start button
let vegetarianCheckbox;
let veganCheckbox;
let glutenFreeCheckbox;
let allergensToAvoid;
let scanButton; // Added scanButton to global vars for broader access
let sidebarDietaryPreferencesHeader;
let sidebarScanHistoryHeader;
// Sidebar specific DOM elements
let sidebar;
let sidebarOverlay;
let hamburgerMenu;
let sidebarCloseButton;
let dietaryPreferencesSection; // New: Section to show/hide
let scanHistorySection;     // New: Section to show/hide
let showPreferencesButton;  // New: Button in sidebar
let showHistoryButton;      // New: Button in sidebar


// Html5Qrcode related variables
let html5QrcodeScanner = null;
let isScannerRunning = false;
let lastScannedCode = null;
let lastScanTimestamp = 0;
const LAST_SCAN_DEBOUNCE_MS = 1500; // Debounce time for consecutive scans
let availableCameras = [];
let currentCameraId = null;

// API Endpoint (replace with your actual API endpoint if different)
const API_BASE_URL = 'https://upc-scanner-backend-api.onrender.com/api'; // Your Render.com API URL

// --- Utility Functions ---

/**
 * Displays a message to the user.
 * @param {string} message The message text.
 * @param {string} type The type of message (info, success, warning, error).
 */
function displayMessage(message, type = 'info') {
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`; // Reset and apply new classes
        messageDiv.style.display = 'block';
    } else {
        console.warn('Message display div not found. Message:', message, type);
    }
}

/**
 * Hides the displayed message.
 */
function hideMessage() {
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}

/**
 * Custom confirmation modal logic.
 * @param {string} message The message to display in the modal.
 * @returns {Promise<boolean>} Resolves true if 'Yes', false if 'No'.
 */
let resolveModalPromise;
function showCustomConfirm(message) {
    if (modalOverlay && modalMessage) {
        modalMessage.textContent = message;
        modalOverlay.style.display = 'flex'; // Use flex to center
        return new Promise(resolve => {
            resolveModalPromise = resolve;
        });
    } else {
        console.error('Modal elements not found for custom confirmation.');
        return Promise.resolve(window.confirm(message)); // Fallback to native confirm
    }
}

/**
 * Sets up accordion functionality for elements with class 'accordion-header'.
 * Ensures accordions are initially closed, and optionally opens the first one.
 */
function setupAccordions() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        // Remove existing listener to prevent duplicates if called multiple times
        header.removeEventListener('click', handleAccordionClick);
        header.addEventListener('click', handleAccordionClick);

        // Ensure accordion content is initially closed
        header.classList.remove('active'); // Remove active class from header
        const content = header.nextElementSibling;
        if (content && content.classList.contains('accordion-content')) {
            content.classList.remove('show'); // Ensure content is not 'show'
            content.style.maxHeight = null; // Reset max-height
        }
    });

    // Optional: Open the first accordion (e.g., Product Details or Ingredients) by default
    // after content is loaded. Adjust ID as needed based on which section you want open.
    const firstHeader = document.querySelector('.accordion-header');
    if (firstHeader) {
        firstHeader.classList.add('active');
        const firstContent = firstHeader.nextElementSibling;
        if (firstContent && firstContent.classList.contains('accordion-content')) {
            firstContent.classList.add('show');
            // Set max-height for the initial open state, crucial for transition.
            // Use setTimeout to ensure the element is rendered and scrollHeight is accurate.
            setTimeout(() => {
                firstContent.style.maxHeight = firstContent.scrollHeight + 'px';
            }, 0);
        }
    }
}

/**
 * Handles the click event for accordion headers.
 * @param {Event} event The click event.
 */
function handleAccordionClick(event) {
    const header = event.currentTarget; // The clicked accordion header (the button itself)
    const content = header.nextElementSibling; // Get the next sibling element (accordion-content)

    // Toggle the 'active' class on the header
    header.classList.toggle('active');

    // Toggle the 'show' class on the content and manage max-height for smooth transition
    if (content.classList.contains('show')) {
        content.style.maxHeight = null; // Collapse the content
        content.classList.remove('show');
    } else {
        content.classList.add('show');
        // Set max-height to the scrollHeight to enable smooth transition
        // A slight delay or fixed large value is sometimes needed for proper animation
        // Setting it to scrollHeight immediately then transitioning to that.
        content.style.maxHeight = content.scrollHeight + 'px';
    }
}


// --- API Interaction and Product Display ---

/**
 * Fetches product information from the API.
 * @param {string} upc The UPC code to look up.
 * @returns {Promise<object|null>} The product data or null if not found/error.
 */
async function fetchProductData(upc) {
    displayMessage('Searching for product...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/product/${upc}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        hideMessage();
        return data;
    } catch (error) {
        console.error('Error fetching product data:', error);
        displayMessage(`Error: ${error.message}. Please try again or check the UPC.`, 'error');
        return null;
    }
}

/**
 * Checks product against user's dietary preferences.
 * @param {object} product The product object.
 * @param {object} preferences The user's preferences.
 * @returns {Array<string>} An array of feedback messages (e.g., "Contains Gluten").
 */
function checkDietaryCompliance(product, preferences) {
    const feedback = [];
    // Ensure product.ingredients is a string for lowerCase and includes check
    const lowerCaseIngredients = (product.ingredients || '').toLowerCase();
    const lowerCaseAllergens = (product.allergens || []).map(a => a.toLowerCase());

    // Check Vegan/Vegetarian statuses
    // Backend should ideally provide 'is_vegan', 'is_vegetarian' booleans
    // Adapting to existing backend structure with 'vegan_status', 'vegetarian_status'
    if (preferences.vegan) {
        if (product.vegan_status === 'not-vegan') {
            feedback.push('Not Vegan: Contains non-vegan ingredients.');
        } else if (product.vegan_status === 'potential-vegan') {
            feedback.push('Potentially Vegan: May contain animal-derived ingredients. Check carefully.');
        }
    }
    if (preferences.vegetarian) {
        if (product.vegetarian_status === 'not-vegetarian') {
            feedback.push('Not Vegetarian: Contains non-vegetarian ingredients.');
        } else if (product.vegetarian_status === 'potential-vegetarian') {
            feedback.push('Potentially Vegetarian: May contain non-vegetarian ingredients. Check carefully.');
        }
    }

    // Check Gluten-Free
    if (preferences.glutenFree) {
        if (product.gluten_free_status === 'not-gluten-free') {
            feedback.push('Not Gluten-Free: Contains gluten.');
        } else if (product.gluten_free_status === 'potential-gluten-free') {
            feedback.push('Potentially Gluten-Free: May contain gluten. Check carefully.');
        }
    }

    // Check Allergens against user preferences
    if (preferences.allergens && preferences.allergens.length > 0) {
        preferences.allergens.forEach(allergenPref => {
            // Trim and convert preference to lowercase for comparison
            const trimmedAllergenPref = allergenPref.toLowerCase().trim();
            if (lowerCaseAllergens.includes(trimmedAllergenPref)) {
                feedback.push(`Allergen Alert: Contains "${allergenPref}"`);
            }
        });
    }

    // Check additives against preferences (if API provides additive risk data and you have preferences for them)
    if (product.additives && product.additives.length > 0) {
        product.additives.forEach(add => {
            if (add.status && add.status.includes('BANNED in EU')) {
                feedback.push(`Additive Alert: ${add.eNumber || add.name || 'Unknown Additive'} is BANNED in EU.`);
            }
            // Add other additive checks based on your preferences
            // e.g., if you have a list of 'additivesToAvoid' in preferences
            // if (preferences.additivesToAvoid.includes(add.eNumber)) { ... }
        });
    }

    return feedback;
}


/**
 * Fetches and processes product data, then displays it.
 * @param {string} upc The UPC code.
 * @param {boolean} fromScan True if the call originated from a scanner scan.
 */
async function fetchAndProcessProduct(upc, fromScan) {
    displayMessage('Fetching product details...', 'info');
    productInfoDiv.innerHTML = ''; // Clear previous product info

    // Only add to history if it's a new scan, not a manual lookup
    // (addToScanHistory already handles duplicates, but this avoids fetching for history if it's a lookup)
    
        addToScanHistory(upc);
    

    const product = await fetchProductData(upc);

    if (product) {
        renderProductInfo(product);

        // Apply dietary preferences after product info is rendered
        const preferences = loadDietaryPreferences(); // Make sure to load preferences again if needed
        const complianceFeedback = checkDietaryCompliance(product, preferences);

        if (complianceFeedback.length > 0) {
            let feedbackHtml = '<div class="section-card info-card error-card"><h2>Dietary Warnings</h2><ul class="allergen-list">';
            complianceFeedback.forEach(msg => {
                feedbackHtml += `<li><span class="allergen-alert-badge">${msg}</span></li>`;
            });
            feedbackHtml += '</ul></div>';
            // Insert at the top of the product info display
            productInfoDiv.insertAdjacentHTML('afterbegin', feedbackHtml);
        }

        // Re-setup accordions after content is rendered
        // This setTimeout is a good safeguard, but ensure setupAccordions itself handles initial state
        setTimeout(() => {
            setupAccordions();
        }, 50); // Small delay to ensure DOM is ready
    } else {
        productInfoDiv.innerHTML = '<div class="section-card info-card error-card"><h2>Product Not Found</h2><p>No information available for this UPC code.</p></div>';
    }
}


/**
 * Helper to get a nutrient value per serving.
 * @param {object} nutrient The nutrient object from product.nutrition_facts.
 * @returns {number|string} The value per serving or 'N/A'.
*/
function getPerServingValue(nutrient) {
    if (nutrient && nutrient.per_serving !== undefined && nutrient.per_serving !== null) {
        const value = parseFloat(nutrient.per_serving);
        return isNaN(value) ? 'N/A' : value.toFixed(1);
    }
    return 'N/A';
}

/**
 * Determines a CSS class based on nutrient value for visual feedback.
 * (Thresholds are examples, adjust based on dietary guidelines)
 * @param {string} nutrientName e.g., 'sugar', 'salt', 'fat'
 * @param {string|number} value The nutrient value (can be 'N/A' string or number).
 * @returns {string} CSS class (e.g., 'nutrient-low', 'nutrient-high').
*/
function getNutrientStatusClass(nutrientName, value) {
    if (value === 'N/A' || isNaN(parseFloat(value))) {
        return '';
    }
    const val = parseFloat(value);
    switch (nutrientName) {
        case 'sugar':
            if (val > 22.5) return 'nutrient-high'; // >22.5g/100g or 100ml is high
            if (val < 5) return 'nutrient-low'; // <5g/100g or 100ml is low
            return 'nutrient-moderate';
        case 'salt':
            if (val > 1.5) return 'nutrient-high'; // >1.5g/100g or 100ml is high
            if (val < 0.3) return 'nutrient-low'; // <0.3g/100g or 100ml is low
            return 'nutrient-moderate';
        case 'fat':
            if (val > 17.5) return 'nutrient-high'; // >17.5g/100g or 100ml is high
            if (val < 3) return 'nutrient-low'; // <3g/100g or 100ml is low
            return 'nutrient-moderate';
        case 'calories':
            if (val > 400) return 'nutrient-high'; // Example threshold
            if (val < 100) return 'nutrient-low';
            return 'nutrient-moderate';
        case 'protein':
        case 'fiber':
            if (val > 5) return 'nutrient-good'; // Good to have higher protein/fiber
            return '';
        default:
            return '';
    }
}


/**
 * Renders the product information into the DOM.
 * @param {object} product The product data object.
 */
function renderProductInfo(product) {
    let html = '';

    // Product Header
    html += `
        <div class="section-card product-header">
            <h1>${product.product_name || 'Unknown Product'}</h1>
            ${product.image_url ? `<img src="${product.image_url}" alt="${product.product_name || 'Product'}" class="product-image">` : ''}
            <p><small>UPC: ${product.barcode || 'N/A'}</small></p>
        </div>
    `;

    // NOVA Group (if available)
    if (product.nova_group) {
        const novaClass = `nova-group-${product.nova_group}`;
        const novaDescription = product.nova_group_description || 'No description available.';

        // --- Correct Additives Count Calculation ---
        const additivesCount = (product.additives && Array.isArray(product.additives)) ? product.additives.length : 0;
        let additivesListHtml = ''; // Will hold the detailed list

        if (product.additives_tags && Array.isArray(product.additives_tags) && product.additives_tags.length > 0) {
            // Format the list of additives (e.g., remove "en:" prefix)
            const formattedAdditives = product.additives_tags
                .map(tag => tag.replace(/^en:/, '').replace(/-/g, ' ').toUpperCase())
                .join(', ');
            additivesListHtml = `<p><strong>Details:</strong> ${formattedAdditives}</p>`;
        }
        // If additivesCount > 0 but no detailed tags, the general message below will cover it.
        // If additivesCount == 0, the general message below will cover it.

        html += `
            <div class="section-card info-card nova-info ${novaClass}">
                <h2>NOVA Group ${product.nova_group}</h2>
                <p><strong>Processing Level:</strong> ${novaDescription}</p>
                <p>
                    ${additivesCount > 0
                        ? `This product contains <strong>${additivesCount}</strong> food additives.`
                        : `No food additives found in this product.`
                    }
                </p>
                ${additivesListHtml}
                <p class="additives-info"><small>Lower numbers of additives are generally preferred. You can research specific additives (like E-numbers) online for more details.</small></p>
                <p class="nova-source-note"><small>NOVA groups classify foods by level of processing. Learn more on <a href="https://en.wikipedia.org/wiki/Nova_classification" target="_blank" class="external-link" rel="noopener noreferrer">Wikipedia</a>.</small></p>
            </div>
        `;
    }

    // Ingredients
    if (product.ingredients && product.ingredients.length > 0) {
        let ingredientTagsHtml = '';
        // Assuming product.ingredients_analysis_tags is an array of strings like ["en:palm-oil-free"]
        if (product.ingredients_analysis_tags && Array.isArray(product.ingredients_analysis_tags) && product.ingredients_analysis_tags.length > 0) {
            product.ingredients_analysis_tags.forEach(tag => {
                // Example: split tag like 'en:palm-oil-free' to 'Palm Oil Free'
                const displayTag = tag.replace(/^en:/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                ingredientTagsHtml += `<span class="allergen-tag">${displayTag}</span>`;
            });
        }
        html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false" id="ingredientsHeader">
                    <h2>Ingredients <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content"> <p>${product.ingredients || 'No ingredients listed.'}</p>
                    ${ingredientTagsHtml ? `<div class="info-card preference-highlights">${ingredientTagsHtml}</div>` : ''}
                </div>
            </div>
        `;
    }

    // Allergens (if available)
    if (product.allergens && Array.isArray(product.allergens) && product.allergens.length > 0) {
        let allergenListHtml = '<ul class="allergen-list">';
        product.allergens.forEach(allergen => {
            allergenListHtml += `<li><span class="allergen-tag">${allergen}</span></li>`;
        });
        allergenListHtml += '</ul>';

        html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false">
                    <h2>Allergens <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content"> ${allergenListHtml}
                    <p class="additive-lookup-note"><small>Always check the product packaging for the most accurate and up-to-date allergen information.</small></p>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false">
                    <h2>Allergens <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content"> <p>No common allergens found or listed for this product.</p>
                    <p class="additive-lookup-note"><small>Always check the product packaging for the most accurate and up-to-date allergen information.</small></p>
                </div>
            </div>
        `;
    }

    // Additives
    if (product.additives && Array.isArray(product.additives) && product.additives.length > 0) {
        html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false">
                    <h2>Additives (${product.additives.length}) <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content"> <div class="additive-list-container">
                        <ul class="additive-list">
        `;
        product.additives.forEach(add => {
            let statusText = 'Unknown Status'; // Default
            let statusClass = 'additive-risk-badge info'; // Default class

            if (add.status) {
                if (add.status.includes('BANNED in EU')) {
                    statusText = 'BANNED in EU';
                    statusClass = 'additive-risk-badge banned';
                } else if (add.status.includes('Requires warning')) {
                    statusText = 'Requires warning';
                    statusClass = 'additive-risk-badge warning';
                } else if (add.status === 'Not banned in EU') {
                    statusText = 'Not banned in EU'; // Can be info or just no badge
                    statusClass = 'additive-risk-badge safe'; // New 'safe' class for clarity
                } else if (add.status !== 'Unknown Status' && add.status !== 'Details from Wikipedia.') {
                    statusText = add.status; // Use specific status if present
                    statusClass = 'additive-risk-badge info';
                }
            }

            html += `
                                <li>
                                    <strong>${add.eNumber && add.eNumber !== 'N/A' ? add.eNumber + ' - ' : ''}${add.name || 'Unknown Additive'}</strong>
                                    <br>
                                    <small>
                                        Type: ${add.type || 'N/A'}
                                        <span class="${statusClass}">${statusText}</span>
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
                            <a href="https://en.wikipedia.org/wiki/E_number" target="_blank" class="external-link" rel="noopener noreferrer">Wikipedia's List of  E-numbers</a>.
                        </small>
                    </p>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false">
                    <h2>Additives (0) <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content"> <p>No specific additives found or listed for this product.</p>
                    <p class="additive-lookup-note">
                        <small>
                            For more information on E-numbers, consult resources like
                            <a href="https://en.wikipedia.org/wiki/E_number" target="_blank" class="external-link" rel="noopener noreferrer">Wikipedia's List of Food Additives</a>.
                        </small>
                    </p>
                </div>
            </div>
        `;
    }

    // Nutrition Facts
    if (product.nutrition_facts) {
        const servingSizeText = product.serving_size ? `<small> (per ${product.serving_size})</small>` : '';
        html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false">
                    <h2>Nutrition Facts ${servingSizeText} <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content"> <div class="nutrition-grid">
                        <p><strong>Calories:</strong> <span class="${getNutrientStatusClass('calories', getPerServingValue(product.nutrition_facts.calories))}">${getPerServingValue(product.nutrition_facts.calories)} kcal</span></p>
                        <p><strong>Protein:</strong> <span class="${getNutrientStatusClass('protein', getPerServingValue(product.nutrition_facts.protein))}">${getPerServingValue(product.nutrition_facts.protein)} g</span></p>
                        <p><strong>Carbohydrates:</strong> <span class="${getNutrientStatusClass('carbohydrates', getPerServingValue(product.nutrition_facts.carbohydrates))}">${getPerServingValue(product.nutrition_facts.carbohydrates)} g</span></p>
                        <p><strong>Fat:</strong> <span class="${getNutrientStatusClass('fat', getPerServingValue(product.nutrition_facts.fat))}">${getPerServingValue(product.nutrition_facts.fat)} g</span></p>
                        <p><strong>Sugar:</strong> <span class="${getNutrientStatusClass('sugar', getPerServingValue(product.nutrition_facts.sugar))}">${getPerServingValue(product.nutrition_facts.sugar)} g</span></p>
                        <p><strong>Salt:</strong> <span class="${getNutrientStatusClass('salt', getPerServingValue(product.nutrition_facts.salt))}">${getPerServingValue(product.nutrition_facts.salt)} g</span></p>
                        <p><strong>Fiber:</strong> <span class="${getNutrientStatusClass('fiber', getPerServingValue(product.nutrition_facts.fiber))}">${getPerServingValue(product.nutrition_facts.fiber)} g</span></p>
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="section-card">
                <button class="accordion-header" aria-expanded="false">
                    <h2>Nutrition Facts <span class="arrow">▼</span></h2>
                </button>
                <div class="accordion-content"> <p>No nutrition facts available for this product.</p>
                </div>
            </div>
        `;
    }

    html += `
        <div class="section-card">
            <button class="accordion-header" aria-expanded="false">
                <h2>Data Source <span class="arrow">▼</span></h2>
            </button>
            <div class="accordion-content"> <p>Information provided by ${product.source || 'Open Food Facts'}.</p>
            </div>
        </div>
    `;

    productInfoDiv.innerHTML = html;
}

// --- Scanner Logic ---

async function onScanSuccess(decodedText, decodedResult) {
    const currentTime = new Date().getTime();

    if (decodedText === lastScannedCode && (currentTime - lastScanTimestamp < LAST_SCAN_DEBOUNCE_MS)) {
        console.log("Debouncing: Same code scanned too quickly.");
        return;
    }

    lastScannedCode = decodedText;
    lastScanTimestamp = currentTime;

    console.log(`Scan result: ${decodedText}`, decodedResult);
    if (upcInput) upcInput.value = decodedText;

    await fetchAndProcessProduct(decodedText, true);
    // After a successful scan, you might want to stop the scanner automatically
    // or keep it running for continuous scanning.
    await stopScanner(); // Uncomment if you want the scanner to stop after one successful scan
}

function onScanError(errorMessage) {
    if (isScannerRunning) {
        // console.warn('Scanner error during active scan:', errorMessage); // Too verbose for console
    }
}

async function initializeScanner(cameraId) {
    if (html5QrcodeScanner && isScannerRunning) {
        console.log("Stopping existing scanner to re-initialize.");
        await stopScanner();
    }

    if (scannerContainer) scannerContainer.innerHTML = '';
    displayMessage('Starting scanner...', 'info');

    // Html5QrcodeScanner takes the ID of the div where the scanner UI will be rendered
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
            disableFlip: false, // Allow flipping horizontally
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
        // ******************************************************************
        // ADD THESE LINES RIGHT HERE
        const manualScanSection = document.getElementById('manualScanSection');
        if (manualScanSection) {
            manualScanSection.style.setProperty('display', 'block', 'important');
            manualScanSection.style.setProperty('visibility', 'visible', 'important');
            console.log("Manual Scan Section forced visible after scanner render."); // For debugging
        }
        // ******************************************************************



        isScannerRunning = true;
        currentCameraId = cameraId;
        displayMessage('Scanner active. Point to a barcode.', 'success');
        if (cameraControls) cameraControls.style.display = 'flex'; // Show camera controls once scanner starts
        if (scanButton) scanButton.textContent = 'Hide Scanner'; // Update main scan button
    } catch (err) {
        console.error('Error starting scanner with ID ' + cameraId + ':', err);
        isScannerRunning = false;
        if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls on error
        if (scanButton) scanButton.textContent = 'Start Scan'; // Reset main scan button
        let errorMessage = 'Error starting scanner.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Camera access denied by user. Please enable camera permissions in your browser settings (e.g., Site Settings > Permissions > Camera).';
        } else if (err.name === 'NotFoundError') {
            errorMessage = 'No camera found on this device or the selected camera is unavailable.';
        } else if (err.name === 'OverconstrainedError') {
            errorMessage = 'Camera constraints cannot be satisfied (e.g., specific resolution not supported). Trying to switch cameras...';
            // Try to switch to another camera if available
            if (availableCameras.length > 1) {
                const currentIndex = availableCameras.findIndex(camera => camera.id === currentCameraId);
                const nextIndex = (currentIndex + 1) % availableCameras.length;
                const nextCamera = availableCameras[nextIndex];
                displayMessage(`Trying next camera: ${nextCamera.label || 'unknown'}`, 'warning');
                await initializeScanner(nextCamera.id); // Recursive call to try next camera
                return; // Exit current function to prevent further error messages
            }
        } else {
            errorMessage += ` (${err.message})`;
        }
        displayMessage(errorMessage, 'error');
        if (scannerContainer) scannerContainer.innerHTML = `<p>${errorMessage}</p>`;
    }
}

async function getCameras() {
    try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
            availableCameras = cameras;
            // Prefer back camera if available, otherwise pick the first one
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
        displayMessage('Could not list cameras. Ensure camera is connected and permissions are granted.', 'error');
        return null;
    }
}

async function requestCameraAccess() {
    if (isScannerRunning) {
        console.log("Scanner already running, ignoring repeated request.");
        return;
    }

    displayMessage('Requesting camera access...', 'info');
    if (scannerContainer) scannerContainer.innerHTML = '<p>Waiting for camera permission...</p>';

    try {
        // Request temporary camera access to trigger permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop stream immediately

        const defaultCameraId = await getCameras();
        if (defaultCameraId) {
            await initializeScanner(defaultCameraId);
        } else {
            displayMessage('No suitable camera found on this device after permission was granted.', 'error');
            if (scannerContainer) scannerContainer.innerHTML = '<p>No camera devices detected or available.</p>';
            if (cameraControls) cameraControls.style.display = 'none';
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
        } else if (err.name === 'SecurityError') {
            userFriendlyMessage = 'Camera access denied due to security constraints (e.g., non-HTTPS connection). Ensure you are using HTTPS.';
        } else {
            userFriendlyMessage = `Error accessing camera: ${err.message}`;
        }
        displayMessage(userFriendlyMessage, 'error');
        if (scannerContainer) scannerContainer.innerHTML = `<p>${userFriendlyMessage}</p>`;
        if (cameraControls) cameraControls.style.display = 'none';
        if (scanButton) scanButton.textContent = 'Start Scan'; // Reset main scan button
    }
}

async function stopScanner() {
    return new Promise(async (resolve) => {
        if (isScannerRunning && html5QrcodeScanner) {
            try {
                await html5QrcodeScanner.clear();
                isScannerRunning = false;
                displayMessage('Scanner stopped.', 'info');

                // Clear and hide scanner container
                if (scannerContainer) {
                    scannerContainer.innerHTML = '<p>Click "Start Scan" to activate your camera.</p>'; // Reset initial message
                    scannerContainer.style.display = 'flex'; // Keep it flex to center message
                }
                if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls

                // Reset main scan button text
                if (scanButton) scanButton.textContent = 'Start Scan';

            } catch (err) {
                console.error('Error stopping scanner:', err);
                displayMessage('Error stopping scanner. It might already be stopped or camera access is blocked.', 'error');
                isScannerRunning = false;
                if (cameraControls) cameraControls.style.display = 'none';
                if (scanButton) scanButton.textContent = 'Start Scan';
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

    const isSidebarOpen = sidebar.classList.contains('open'); // Check for 'open' class
    let newState = forceState !== null ? forceState : !isSidebarOpen;

    if (newState) {
        sidebar.classList.add('open'); // Add 'open' class
        sidebarOverlay.classList.add('active'); // Add 'active' class
        document.body.style.overflow = 'hidden'; // Prevent scrolling on main content
    } else {
        sidebar.classList.remove('open'); // Remove 'open' class
        sidebarOverlay.classList.remove('active'); // Remove 'active' class
        document.body.style.overflow = ''; // Restore scrolling
    }
}

/**
 * Shows a specific section in the main content area and hides others.
 * Designed for use with sidebar navigation.
 *@param {HTMLElement} sectionToShow The DOM element of the main content section to display.
 * @param {string} [initialMessage=''] An optional message to display in the product info area if it's not the sectionToShow.
 */
function showMainContent(sectionToShow, initialMessage = '') {
    // List all main content sections
    const mainContentSections = [productInfoDiv, scannerContainer, manualScanSection];

    mainContentSections.forEach(section => {
        if (section) {
            section.style.display = 'none'; // Hide all main content sections
        }
    });

    if (sectionToShow) {
        sectionToShow.style.display = 'block'; // Show the requested main content section
    }

    // Ensure productInfoDiv is visible for messages if another section is showing
    if (productInfoDiv && sectionToShow !== productInfoDiv) {
        productInfoDiv.innerHTML = `<p class="no-product">${initialMessage || 'Select an option from the sidebar or scan a product.'}</p>`;
        productInfoDiv.style.display = 'block';
    } else if (productInfoDiv && sectionToShow === productInfoDiv) {
        productInfoDiv.innerHTML = ''; // Clear if product info is the primary display
    }

    // Always close the sidebar when a main content section is activated
    toggleSidebar(false);
}


// --- Preferences and History Logic ---

const DIETARY_PREFERENCES_KEY = 'dietaryPreferences';
const SCAN_HISTORY_KEY = 'scanHistory';

/**
 * Loads dietary preferences from local storage.
 * @returns {object} The loaded preferences or defaults.
*/
function loadDietaryPreferences() {
    try {
        const preferencesJson = localStorage.getItem(DIETARY_PREFERENCES_KEY);
        const preferences = preferencesJson ? JSON.parse(preferencesJson) : {};

        // Update UI elements based on loaded preferences
        if (vegetarianCheckbox) vegetarianCheckbox.checked = preferences.vegetarian || false;
        if (veganCheckbox) veganCheckbox.checked = preferences.vegan || false;
        if (glutenFreeCheckbox) glutenFreeCheckbox.checked = preferences.glutenFree || false;
        if (allergensToAvoid) allergensToAvoid.value = (preferences.allergens || []).join(', ');
        return preferences;
    } catch (e) {
        console.error("Failed to load dietary preferences:", e);
        displayMessage("Error loading preferences. Your browser might be in private mode or storage is full.", "error");
        return {};
    }
}

/**
 * Saves dietary preferences to local storage.
*/
function saveDietaryPreferences() {
    const preferences = {
        vegetarian: vegetarianCheckbox ? vegetarianCheckbox.checked : false,
        vegan: veganCheckbox ? veganCheckbox.checked : false,
        glutenFree: glutenFreeCheckbox ? glutenFreeCheckbox.checked : false,
        allergens: allergensToAvoid ? allergensToAvoid.value.split(',').map(s => s.trim()).filter(s => s) : []
    };
    try {
        localStorage.setItem(DIETARY_PREFERENCES_KEY, JSON.stringify(preferences));
        displayMessage('Preferences saved!', 'success'); // <-- ADDED THIS LINE
        console.log('Dietary preferences saved:', preferences); // <-- ADDED THIS FOR DEBUGGING
    } catch (e) {
        console.error("Failed to save dietary preferences:", e);
        displayMessage("Error saving preferences. Your browser might be in private mode or storage is full.", "error");
    }
}

/**
 * Clears dietary preferences from local storage and resets UI.
*/
function clearDietaryPreferences() {
    // This function is now called *after* confirmation from the event listener,
    // so it just needs to perform the clearing logic.
    try {
        localStorage.removeItem(DIETARY_PREFERENCES_KEY);
        // Reset UI by calling loadDietaryPreferences, which will set checkboxes/input to default (false/empty)
        loadDietaryPreferences();
        // The displayMessage is handled by the event listener now, not directly here.
    } catch (e) {
        console.error("Failed to clear dietary preferences:", e);
        displayMessage("Error clearing preferences. Your browser might be in private mode or storage is full.", "error");
    }
}

/**
 * Loads scan history from local storage and populates the list.
*/
function loadScanHistory() {
    try {
        const historyJson = localStorage.getItem(SCAN_HISTORY_KEY);
        const history = historyJson ? JSON.parse(historyJson) : [];
        if (scanHistoryList) {
            scanHistoryList.innerHTML = ''; // Clear existing list
            if (history.length === 0) {
                scanHistoryList.innerHTML = '<li class="text-center text-gray-500">No scan history yet.</li>';
            } else {
                // Display history in reverse chronological order (newest first)
                history.slice().reverse().forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.className = 'scan-history-item';
                    listItem.dataset.upc = item.upc;
                    listItem.innerHTML = `
                       ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" class="history-item-image">` : ''}
                        <div class="history-item-details">
                            <span class="history-item-name">${item.name}</span>
                            <small class="history-item-upc">${item.upc}</small>
                        </div>
                    `;
                    listItem.addEventListener('click', () => {
                        upcInput.value = item.upc;
                        fetchAndProcessProduct(item.upc, false); // False because it's a history lookup, not a live scan
                        toggleSidebar(false); // Close sidebar after selecting from history
                    });
                    scanHistoryList.appendChild(listItem); // Add to the end (since we reversed the array)
                });
            }
        }
    } catch (e) {
        console.error("Failed to load scan history:", e);
        displayMessage("Error loading scan history. Your browser might be in private mode or storage is full.", "error");
    }
}

/**
 * Adds a scanned product to history.
 * @param {string} upc The UPC of the scanned product.
*/
async function addToScanHistory(upc) {
    let history = [];
    try {
        const historyJson = localStorage.getItem(SCAN_HISTORY_KEY);
        history = historyJson ? JSON.parse(historyJson) : [];
    } catch (e) {
        console.error("Failed to read scan history for adding:", e);
    }

    // Remove existing item with the same UPC to ensure it's always the latest
    history = history.filter(item => item.upc !== upc);

    // Fetch product details for history display (name, image) if not already fetched
    // (This part is crucial: if you fetch product data in fetchAndProcessProduct,
    // you should pass that data here to avoid a duplicate API call.
    // For simplicity, I'm keeping the re-fetch as per your original code,
    // but optimizing this would be good for performance.)
    const productDataForHistory = await fetchProductData(upc);
    let name = productDataForHistory ? productDataForHistory.product_name : 'Unknown Product';
    let imageUrl = productDataForHistory ? productDataForHistory.image_url : null;

    const newHistoryItem = {
        upc: upc,
        name: name,
        image_url: imageUrl,
        timestamp: new Date().toISOString()
    };

    history.push(newHistoryItem);

    // Keep history clean (e.g., last 20 items)
    if (history.length > 20) {
        history = history.slice(history.length - 20);
    }

    try {
        localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history));
        loadScanHistory(); // Reload history list in UI
    } catch (e) {
        console.error("Failed to save scan history:", e);
        displayMessage("Error saving scan history. Your browser might be in private mode or storage is full.", "error");
    }
}


/**
 * Clears the entire scan history.
*/
function clearScanHistory() {
    try {
        localStorage.removeItem(SCAN_HISTORY_KEY);
        loadScanHistory(); // Clear UI
    } catch (e) {
        console.error("Failed to clear scan history:", e);
        displayMessage("Error clearing scan history. Your browser might be in private mode or storage is full.", "error");
    }
}

// --- DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements AFTER the document is fully loaded
    upcInput = document.getElementById('upcInput');
    scanButton = document.getElementById('scanButton'); // Main toggle for scanner visibility
    lookupButton = document.getElementById('lookupButton');
    productInfoDiv = document.getElementById('productInfo');
    messageDiv = document.getElementById('messageDisplay'); // Corrected ID
    scannerContainer = document.getElementById('scanner-container');
    scanHistoryList = document.getElementById('scanHistoryList');
    clearHistoryButton = document.getElementById('clearHistoryButton');
    savePreferencesButton = document.getElementById('savePreferencesButton');
    clearPreferencesButton = document.getElementById('clearPreferencesButton');
    modalOverlay = document.getElementById('customConfirmModal');
    modalMessage = document.getElementById('customConfirmMessage');
    modalButtonYes = document.getElementById('modalConfirmYes');
    modalButtonNo = document.getElementById('modalConfirmNo');
    cameraControls = document.getElementById('cameraControls');
    switchCameraButton = document.getElementById('switchCameraButton');
    stopCameraButton = document.getElementById('stopCameraButton');
    startCameraButton = document.getElementById('startCameraButton'); // New button element
    vegetarianCheckbox = document.getElementById('vegetarianCheckbox');
    veganCheckbox = document.getElementById('veganCheckbox');
    glutenFreeCheckbox = document.getElementById('glutenFreeCheckbox');
    allergensToAvoid = document.getElementById('allergensToAvoid');
    const manualScanSection = document.getElementById('manualScanSection');    // Corrected Sidebar DOM element assignments
if (manualScanSection) {
    // 1. Initial force (in case it's hidden on page load)
    manualScanSection.style.setProperty('display', 'block', 'important');
    manualScanSection.style.setProperty('visibility', 'visible', 'important');

    // 2. Create a MutationObserver to watch for style changes
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            // Check if the change was to the 'style' attribute
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                // If 'display' is currently 'none'
                if (manualScanSection.style.display === 'none') {
                    // Force it back to 'block !important'
                    manualScanSection.style.setProperty('display', 'block', 'important');
                    manualScanSection.style.setProperty('visibility', 'visible', 'important');
                    console.log("MutationObserver: manualScanSection forced visible.");
                }
            }
        }
    });

    // 3. Start observing the manualScanSection element
    //    We want to watch for changes to its 'attributes' (specifically 'style')
    observer.observe(manualScanSection, { attributes: true, attributeFilter: ['style'] });

    // IMPORTANT: If you have a 'stopScanner' function,
    // you might want to call observer.disconnect() when the scanner stops
    // to prevent it from running unnecessarily.
    // E.g., in your stopScanner function:
    // if (observer) {
    //     observer.disconnect();
    // }
}
    sidebar = document.getElementById('mySidebar'); // Corrected ID
    sidebarOverlay = document.getElementById('sidebarOverlay');
    hamburgerMenu = document.getElementById('hamburgerMenu'); // Corrected ID
    sidebarCloseButton = document.getElementById('sidebarCloseButton');
    showPreferencesButton = document.getElementById('showPreferencesButton'); // New: Button in sidebar
    showHistoryButton = document.getElementById('showHistoryButton');     // New: Button in sidebar
    dietaryPreferencesSection = document.getElementById('dietaryPreferencesSection'); // New: Section to show/hide
    scanHistorySection = document.getElementById('scanHistorySection');       // New: Section to show/hide
    sidebarDietaryPreferencesHeader = document.getElementById('sidebarDietaryPreferencesHeader');
    sidebarScanHistoryHeader = document.getElementById('sidebarScanHistoryHeader');

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

    if (scanButton && scannerContainer) {
        scanButton.addEventListener('click', async () => {
            if (!isScannerRunning) {
                scannerContainer.style.display = 'block'; // Show scanner container
                await requestCameraAccess();
                // Button text will be updated by initializeScanner on success
            } else {
                await stopScanner();
                // Button text will be updated by stopScanner
            }
        });
    }

    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', () => {
            showCustomConfirm('Are you sure you want to clear your scan history?')
                .then(confirmed => {
                    if (confirmed) {
                        clearScanHistory();
                        displayMessage('Scan history cleared.', 'success');
                    }
                });
        });
    }

    if (savePreferencesButton) {
        savePreferencesButton.addEventListener('click', () => {
            saveDietaryPreferences();
            // Re-process the last scanned product with the new preferences
            if (lastScannedCode) { // Only re-check if a product is currently displayed
                fetchAndProcessProduct(lastScannedCode, false);
            }
        });
    }

    if (clearPreferencesButton) {
        clearPreferencesButton.addEventListener('click', () => {
            showCustomConfirm('Are you sure you want to clear all dietary preferences?')
                .then(confirmed => {
                    if (confirmed) {
                        clearDietaryPreferences();
                        displayMessage('Dietary preferences cleared.', 'success');
                        // Re-process the last scanned product with the cleared preferences
                        if (lastScannedCode) {
                            fetchAndProcessProduct(lastScannedCode, false);
                        }
                    }
                });
        });
    }

    // Camera control buttons (inside #cameraControls)
    if (switchCameraButton) {
        switchCameraButton.addEventListener('click', async () => {
            if (availableCameras.length > 1 && isScannerRunning) {
                const currentIndex = availableCameras.findIndex(camera => camera.id === currentCameraId);
                const nextIndex = (currentIndex + 1) % availableCameras.length;
                const nextCamera = availableCameras[nextIndex];
                displayMessage(`Switching to camera: ${nextCamera.label || 'unknown'}`, 'info');
                await stopScanner(); // Stop current scanner instance
                await initializeScanner(nextCamera.id); // Start with next camera
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
            } else {
                displayMessage('Scanner is not running.', 'info');
            }
        });
    }

    if (startCameraButton) { // The button inside cameraControls
        startCameraButton.addEventListener('click', async () => {
            if (!isScannerRunning) {
                scannerContainer.style.display = 'block';
                await requestCameraAccess();
            } else {
                displayMessage('Scanner is already running.', 'warning');
            }
        });
    }

    // Custom Confirmation Modal Listeners
    if (modalButtonYes) {
        modalButtonYes.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            if (resolveModalPromise) resolveModalPromise(true);
            resolveModalPromise = null; // Clear the promise resolver
        });
    }

    if (modalButtonNo) {
        modalButtonNo.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            if (resolveModalPromise) resolveModalPromise(false);
            resolveModalPromise = null; // Clear the promise resolver
        });
    }

    // Sidebar Event Listeners (using corrected IDs)
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', () => {
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

    // Initial setup for accordions that are present on page load (e.g., in sidebar or if initial product data exists)
    // IMPORTANT: For product info accordions loaded dynamically, setupAccordions is called in fetchAndProcessProduct.
    setupAccordions();

    // Initial display of the "no product" message and hiding of other sections
   
  // --- Sidebar Section Toggling ---
function setupSidebarAccordions() {
    // These variables (dietaryPreferencesSection, scanHistorySection, sidebarDietaryPreferencesHeader, sidebarScanHistoryHeader)
    // are already assigned at the top of your DOMContentLoaded listener, so they are available here.

    if (sidebarDietaryPreferencesHeader && dietaryPreferencesSection) {
        sidebarDietaryPreferencesHeader.addEventListener('click', () => {
            sidebarDietaryPreferencesHeader.classList.toggle('active');
            // Toggle 'active' on the correct parent content div (which has the max-height CSS)
            dietaryPreferencesSection.classList.toggle('active'); 

            // Ensure preferences are loaded only when its section is activated
            if (sidebarDietaryPreferencesHeader.classList.contains('active')) {
                loadDietaryPreferences(); // Re-load preferences when section opens
            }
        });
    }

    if (sidebarScanHistoryHeader && scanHistorySection) {
        sidebarScanHistoryHeader.addEventListener('click', () => {
            sidebarScanHistoryHeader.classList.toggle('active');
            // Toggle 'active' on the correct parent content div (which has the max-height CSS)
            scanHistorySection.classList.toggle('active'); 

            // Ensure history is loaded only when its section is activated
            if (sidebarScanHistoryHeader.classList.contains('active')) {
                loadScanHistory(); // Load history when section opens
            }
        });
    }
}

    // Call this new setup function
    setupSidebarAccordions();

    // Initial display of the main product info section, as the default view
    showMainContent(productInfoDiv, 'Scan a barcode or enter a UPC to get started!');

}); // End DOMContentLoaded