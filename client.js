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
let startCameraButton; // New start button (for within cameraControls)
let vegetarianCheckbox;
let veganCheckbox;
let glutenFreeCheckbox;
let allergensToAvoid;
let scanButton; // Main button to toggle scanner visibility
let manualScanSection; // The div containing UPC input and lookup button

// Sidebar specific DOM elements
let sidebar;
let sidebarOverlay;
let hamburgerMenu;
let sidebarCloseButton;
let dietaryPreferencesSection; // Section for dietary preferences (in main content)
let scanHistorySection;      // Section for scan history (in main content)
let showPreferencesButton;   // Button in sidebar to show preferences section
let showHistoryButton;       // Button in sidebar to show history section

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
        console.error('Modal elements not found for custom confirmation. Falling back to native confirm.');
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
            content.style.maxHeight = null; // Reset max-height
        }
    });

    // Optional: Open the first accordion (e.g., Product Details or Ingredients) by default
    const firstHeader = document.querySelector('.accordion-header');
    if (firstHeader) {
        firstHeader.classList.add('active');
        const firstContent = firstHeader.nextElementSibling;
        if (firstContent && firstContent.classList.contains('accordion-content')) {
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

    // Toggle max-height for smooth transition
    if (content.style.maxHeight) {
        content.style.maxHeight = null; // Collapse the content
    } else {
        // Set max-height to the scrollHeight to enable smooth transition
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
    if (!upc || typeof upc !== 'string' || upc.trim() === '') {
        console.error("fetchProductData: UPC is empty or invalid.", upc);
        displayMessage('Please enter a valid UPC.', 'warning');
        return null;
    }
    displayMessage('Searching for product...', 'info');
    console.log("Attempting to fetch product from:", `${API_BASE_URL}/product/${upc}`); // Corrected: Use API_BASE_URL
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
    const lowerCaseIngredients = (product.ingredients || '').toLowerCase();
    const lowerCaseAllergens = (product.allergens || []).map(a => a.toLowerCase());

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

    if (preferences.glutenFree) {
        if (product.gluten_free_status === 'not-gluten-free') {
            feedback.push('Not Gluten-Free: Contains gluten.');
        } else if (product.gluten_free_status === 'potential-gluten-free') {
            feedback.push('Potentially Gluten-Free: May contain gluten. Check carefully.');
        }
    }

    if (preferences.allergens && preferences.allergens.length > 0) {
        preferences.allergens.forEach(allergenPref => {
            const trimmedAllergenPref = allergenPref.toLowerCase().trim();
            if (lowerCaseAllergens.includes(trimmedAllergenPref)) {
                feedback.push(`Allergen Alert: Contains "${allergenPref}"`);
            }
        });
    }

    if (product.additives && product.additives.length > 0) {
        product.additives.forEach(add => {
            if (add.status && add.status.includes('BANNED in EU')) {
                feedback.push(`Additive Alert: ${add.eNumber || add.name || 'Unknown Additive'} is BANNED in EU.`);
            }
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
    
    // Always add to history, it handles duplicates internally
    addToScanHistory(upc);
    
    const product = await fetchProductData(upc);

    if (product) {
        renderProductInfo(product);

        const preferences = loadDietaryPreferences();
        const complianceFeedback = checkDietaryCompliance(product, preferences);

        if (complianceFeedback.length > 0) {
            let feedbackHtml = '<div class="section-card info-card error-card"><h2>Dietary Warnings</h2><ul class="allergen-list">';
            complianceFeedback.forEach(msg => {
                feedbackHtml += `<li><span class="allergen-alert-badge">${msg}</span></li>`;
            });
            feedbackHtml += '</ul></div>';
            productInfoDiv.insertAdjacentHTML('afterbegin', feedbackHtml);
        }

        // Re-setup accordions after content is rendered
        setTimeout(() => {
            setupAccordions();
        }, 50); // Small delay to ensure DOM is ready
    } else {
        productInfoDiv.innerHTML = '<div class="section-card info-card error-card"><h2>Product Not Found</h2><p>No information available for this UPC code.</p></div>';
    }
    // Update lastScannedCode *after* product is processed, for re-checking preferences
    lastScannedCode = upc;
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

        const additivesCount = (product.additives && Array.isArray(product.additives)) ? product.additives.length : 0;
        let additivesListHtml = '';

        if (product.additives_tags && Array.isArray(product.additives_tags) && product.additives_tags.length > 0) {
            const formattedAdditives = product.additives_tags
                .map(tag => tag.replace(/^en:/, '').replace(/-/g, ' ').toUpperCase())
                .join(', ');
            additivesListHtml = `<p><strong>Details:</strong> ${formattedAdditives}</p>`;
        }

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
        if (product.ingredients_analysis_tags && Array.isArray(product.ingredients_analysis_tags) && product.ingredients_analysis_tags.length > 0) {
            product.ingredients_analysis_tags.forEach(tag => {
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
                    statusText = 'Not banned in EU';
                    statusClass = 'additive-risk-badge safe';
                } else if (add.status !== 'Unknown Status' && add.status !== 'Details from Wikipedia.') {
                    statusText = add.status;
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
                            <a href="https://en.wikipedia.org/wiki/E_number" target="_blank" class="external-link" rel="noopener noreferrer">Wikipedia's List of E-numbers</a>.
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
    // await stopScanner(); // Uncomment if you want the scanner to stop after one successful scan
}

function onScanError(errorMessage) {
    // console.warn('Scanner error during active scan:', errorMessage); // Too verbose for console
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
        isScannerRunning = true;
        currentCameraId = cameraId;
        displayMessage('Scanner active. Point to a barcode.', 'success');
        if (cameraControls) cameraControls.style.display = 'flex'; // Show camera controls once scanner starts
        if (scanButton) scanButton.textContent = 'Hide Scanner'; // Update main scan button
        if (manualScanSection) manualScanSection.style.display = 'none'; // Hide manual input when scanner is active

    } catch (err) {
        console.error('Error starting scanner with ID ' + cameraId + ':', err);
        isScannerRunning = false;
        if (cameraControls) cameraControls.style.display = 'none'; // Hide camera controls on error
        if (scanButton) scanButton.textContent = 'Start Scan'; // Reset main scan button
        if (manualScanSection) manualScanSection.style.display = 'block'; // Show manual input on error
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
                if (scanButton) scanButton.textContent = 'Start Scan'; // Reset main scan button
                if (manualScanSection) manualScanSection.style.display = 'block'; // Show manual input after scanner stops

            } catch (err) {
                console.error('Error stopping scanner:', err);
                displayMessage('Error stopping scanner. It might already be stopped or camera access is blocked.', 'error');
                isScannerRunning = false;
                if (cameraControls) cameraControls.style.display = 'none';
                if (scanButton) scanButton.textContent = 'Start Scan';
                if (manualScanSection) manualScanSection.style.display = 'block';
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
 * Manages the display of main content sections.
 * Hides all main content sections (product info, scanner, manual input) and
 * then shows the specified `sectionToShow`.
 * @param {HTMLElement} sectionToShow The DOM element of the main content section to display (e.g., productInfoDiv, scannerContainer, manualScanSection, dietaryPreferencesSection, scanHistorySection).
 * @param {string} [initialMessage=''] An optional message to display if the shown section is `productInfoDiv` and it's empty, or if other sections are shown and `productInfoDiv` needs a placeholder message.
 */
function showMainContent(sectionToShow, initialMessage = '') {
    const mainContentSections = [productInfoDiv, scannerContainer, manualScanSection, dietaryPreferencesSection, scanHistorySection];

    mainContentSections.forEach(section => {
        if (section) {
            section.style.display = 'none'; // Hide all sections
        }
    });

    if (sectionToShow) {
        sectionToShow.style.display = 'block'; // Show the requested section

        // Specific handling for productInfoDiv and manualScanSection
        if (sectionToShow === productInfoDiv) {
            // If productInfoDiv is being shown, ensure it displays product data or a placeholder
            if (productInfoDiv.innerHTML.trim() === '') {
                productInfoDiv.innerHTML = `<p class="no-product">${initialMessage || 'Scan a barcode or enter a UPC to get started!'}</p>`;
            }
        } else if (sectionToShow === scannerContainer) {
            // When scanner is shown, manualScanSection should generally be hidden
            if (manualScanSection) manualScanSection.style.display = 'none';
        } else if (sectionToShow === manualScanSection) {
             // When manual scan is shown, scanner should be stopped if running
            if (isScannerRunning) stopScanner();
        }
    }

    // Always close the sidebar when a main content section is activated from it
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
        displayMessage('Preferences saved!', 'success');
        console.log('Dietary preferences saved:', preferences);
    } catch (e) {
        console.error("Failed to save dietary preferences:", e);
        displayMessage("Error saving preferences. Your browser might be in private mode or storage is full.", "error");
    }
}

/**
 * Clears dietary preferences from local storage and resets UI.
 */
function clearDietaryPreferences() {
    try {
        localStorage.removeItem(DIETARY_PREFERENCES_KEY);
        loadDietaryPreferences(); // Reset UI elements
        displayMessage('Dietary preferences cleared.', 'success');
        // Re-process the last scanned product with the new preferences if it's currently displayed
        if (lastScannedCode && productInfoDiv.innerHTML.trim() !== '<div class="section-card info-card error-card"><h2>Product Not Found</h2><p>No information available for this UPC code.</p></div>') {
             fetchAndProcessProduct(lastScannedCode, false);
        }
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
                        showMainContent(productInfoDiv); // Show product info section
                        fetchAndProcessProduct(item.upc, false); // False because it's a history lookup, not a live scan
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

    // Fetch product details for history display (name, image)
    const productDataForHistory = await fetchProductData(upc); // This call should be efficient as it might be cached
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
        displayMessage('Scan history cleared.', 'success');
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
    messageDiv = document.getElementById('messageDisplay');
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
    manualScanSection = document.getElementById('manualScanSection');

    // Sidebar DOM element assignments
    sidebar = document.getElementById('mySidebar');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    hamburgerMenu = document.getElementById('hamburgerMenu');
    sidebarCloseButton = document.getElementById('sidebarCloseButton');
    showPreferencesButton = document.getElementById('showPreferencesButton'); // Button in sidebar to show preferences
    showHistoryButton = document.getElementById('showHistoryButton');     // Button in sidebar to show history
    dietaryPreferencesSection = document.getElementById('dietaryPreferencesSection'); // The main section for preferences
    scanHistorySection = document.getElementById('scanHistorySection');       // The main section for history

    // Initial display of sections
    // Default to showing the product info area with a welcome message
    showMainContent(productInfoDiv, 'Scan a barcode or enter a UPC to get started!');
    
    // Load preferences and history on startup
    loadDietaryPreferences();
    loadScanHistory();

    // Event Listeners
    if (lookupButton && upcInput) {
        lookupButton.addEventListener('click', async () => {
            const upc = upcInput.value.trim();
            if (upc) {
                showMainContent(productInfoDiv); // Ensure product info section is visible
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

    if (scanButton) { // Main toggle for scanner visibility
        scanButton.addEventListener('click', async () => {
            if (!isScannerRunning) {
                showMainContent(scannerContainer); // Show scanner container
                await requestCameraAccess();
            } else {
                await stopScanner(); // Stop scanner and hide its container
            }
        });
    }

    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', () => {
            showCustomConfirm('Are you sure you want to clear your scan history?')
                .then(confirmed => {
                    if (confirmed) {
                        clearScanHistory();
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
                // This button is mainly for re-starting the scanner if it was stopped
                showMainContent(scannerContainer);
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

    // Sidebar Event Listeners
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

    // Sidebar navigation buttons to show main content sections
    if (showPreferencesButton) {
        showPreferencesButton.addEventListener('click', () => {
            showMainContent(dietaryPreferencesSection, 'Adjust your dietary preferences here.');
            loadDietaryPreferences(); // Ensure the latest preferences are loaded into the form
        });
    }

    if (showHistoryButton) {
        showHistoryButton.addEventListener('click', () => {
            showMainContent(scanHistorySection, 'Your recent scan history.');
            loadScanHistory(); // Ensure the latest history is loaded into the list
        });
    }

    // Initial setup for accordions that are present on page load (e.g., in sidebar content)
    // NOTE: For product info accordions loaded dynamically, setupAccordions is called in fetchAndProcessProduct.
    setupAccordions();

}); // End DOMContentLoaded