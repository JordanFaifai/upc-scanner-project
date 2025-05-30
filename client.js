// --- Global Variables ---
let html5QrcodeScanner;
let isScannerRunning = false;
let currentCameraId = null;
let availableCameras = [];
let lastScannedCode = null; // To store the last successfully scanned UPC

// DOM Elements - Declared globally to be accessible after DOMContentLoaded
let upcInput, scanButton, lookupButton, productInfoDiv, messageDiv,
    scannerContainer, scanHistoryList, clearHistoryButton,
    savePreferencesButton, clearPreferencesButton,
    modalOverlay, modalMessage, modalButtonYes, modalButtonNo,
    cameraControls, switchCameraButton, stopCameraButton, startCameraButton,
    vegetarianCheckbox, veganCheckbox, glutenFreeCheckbox, allergensToAvoid,
    sidebar, sidebarOverlay, hamburgerMenu, sidebarCloseButton,
    showPreferencesButton, showHistoryButton,
    dietaryPreferencesSection, scanHistorySection,
    sidebarDietaryPreferencesHeader, sidebarScanHistoryHeader,
    manualScanSection; // Added manualScanSection here

let resolveModalPromise = null; // Used for custom confirmation modal

// --- Utility Functions ---

/**
 * Displays messages to the user in a designated message area.
 * @param {string} message The message to display.
 * @param {string} type The type of message (e.g., 'info', 'success', 'warning', 'error').
 */
function displayMessage(message, type = 'info') {
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `message-display message-${type}`; // Apply styling based on type
        messageDiv.style.display = 'block'; // Ensure it's visible
        // Automatically hide after a few seconds, unless it's an error
        if (type !== 'error') {
            setTimeout(() => {
                messageDiv.style.display = 'none';
                messageDiv.textContent = '';
            }, 5000);
        }
    } else {
        console.warn(`Message display element not found. Message: ${message}`);
    }
}

/**
 * Sets up accordion-like behavior for elements with the class 'accordion'.
 * This function should be called for dynamically added content.
 */
function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion');
    accordions.forEach(accordion => {
        // Ensure the event listener is added only once
        if (!accordion.dataset.listenerAdded) {
            accordion.addEventListener('click', function() {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            });
            accordion.dataset.listenerAdded = 'true'; // Mark as having a listener
        }
    });
}

/**
 * Shows a custom confirmation modal.
 * @param {string} message The message to display in the modal.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false if cancelled.
 */
function showCustomConfirm(message) {
    return new Promise(resolve => {
        if (modalOverlay && modalMessage) {
            modalMessage.textContent = message;
            modalOverlay.style.display = 'flex'; // Show modal
            resolveModalPromise = resolve; // Store the resolve function
        } else {
            console.error('Custom confirmation modal elements not found.');
            resolve(confirm(message)); // Fallback to native confirm
        }
    });
}

// --- API Interaction Functions ---

/**
 * Fetches product data from the server.
 * @param {string} upc The UPC code of the product.
 * @returns {Promise<object|null>} The product data or null if an error occurs.
 */
async function fetchProductData(upc) {
    displayMessage('Fetching product information...', 'info');
    try {
        const response = await fetch(`/product/${upc}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching product data:', error);
        displayMessage(`Error fetching product data for UPC ${upc}: ${error.message}. Please try again or check the UPC.`, 'error');
        return null;
    }
}

/**
 * Fetches and processes product details and displays them.
 * @param {string} upc The UPC code.
 * @param {boolean} isScanned True if the product was scanned, false if manually entered.
 */
async function fetchAndProcessProduct(upc, isScanned = true) {
    if (!productInfoDiv) {
        console.error('Product info display element not found.');
        return;
    }

    displayMessage('Processing product...', 'info');
    productInfoDiv.innerHTML = '<p class="loading-message">Loading product details...</p>';
    showMainContent(productInfoDiv); // Ensure product info section is visible

    // Clear previous lastScannedCode if not explicitly a re-lookup
    if (isScanned) {
        lastScannedCode = null;
    }

    try {
        const productData = await fetchProductData(upc);
        if (!productData) {
            productInfoDiv.innerHTML = `<p class="no-product">No product found for UPC: ${upc}.</p>`;
            if (isScanned) {
                displayMessage('Product not found. Try scanning again or manual entry.', 'warning');
            }
            return;
        }

        // Store the last successfully processed UPC
        lastScannedCode = upc;

        // Fetch dietary preferences for comparison
        const userPreferences = loadDietaryPreferences(); // Ensure latest preferences are loaded

        // Generate and display product details HTML
        let productHtml = `
            <div class="product-header">
                ${productData.image_url ? `<img src="${productData.image_url}" alt="${productData.product_name}" class="product-image">` : '<div class="no-image-placeholder">No Image</div>'}
                <h2 class="product-title">${productData.product_name || 'N/A'}</h2>
                <p class="product-brand">${productData.brand || 'N/A'}</p>
                <p class="product-upc"><strong>UPC:</strong> ${productData.upc}</p>
                <p class="product-category"><strong>Category:</strong> ${productData.category || 'N/A'}</p>
            </div>
        `;

        // Ingredients
        productHtml += `
            <div class="accordion-container">
                <button class="accordion">Ingredients</button>
                <div class="panel">
                    <p>${productData.ingredients || 'No ingredient list available.'}</p>
                    ${productData.ingredients ? checkDietaryCompliance(productData.ingredients, userPreferences) : ''}
                </div>
            </div>
        `;

        // Nutrition Facts
        if (productData.nutriscore_grade || productData.nutrition_facts) {
            productHtml += `
                <div class="accordion-container">
                    <button class="accordion">Nutrition Facts</button>
                    <div class="panel">
                        ${productData.nutriscore_grade ? `<p class="nutriscore-grade">Nutri-Score: <span class="grade-${productData.nutriscore_grade.toLowerCase()}">${productData.nutriscore_grade.toUpperCase()}</span></p>` : ''}
                        ${productData.nutrition_facts ? `<pre class="nutrition-facts">${productData.nutrition_facts}</pre>` : '<p>No detailed nutrition facts available.</p>'}
                    </div>
                </div>
            `;
        }

        // Allergens
        if (productData.allergens) {
            productHtml += `
                <div class="accordion-container">
                    <button class="accordion">Allergens</button>
                    <div class="panel">
                        <p class="allergens">${productData.allergens || 'No common allergens listed.'}</p>
                    </div>
                </div>
            `;
        }

        productInfoDiv.innerHTML = productHtml;
        setupAccordions(); // Re-apply accordion logic for new content
        displayMessage('Product information displayed successfully.', 'success');

        // Add to history only if it was a new scan or a manual lookup that successfully found a product
        if (isScanned || !isScanned && upc !== upcInput.value) { // This condition ensures manual lookups update history
             await addToScanHistory(upc);
        }

    } catch (error) {
        console.error('Error processing product:', error);
        productInfoDiv.innerHTML = `<p class="no-product">Could not display product information for UPC: ${upc}. An error occurred.</p>`;
        displayMessage(`Failed to display product details: ${error.message}`, 'error');
    }
}

/**
 * Checks product ingredients against user's dietary preferences.
 * @param {string} ingredients The ingredients string.
 * @param {object} preferences The user's dietary preferences.
 * @returns {string} HTML string indicating compliance.
 */
function checkDietaryCompliance(ingredients, preferences) {
    let complianceMessages = [];

    const lowerCaseIngredients = ingredients.toLowerCase();

    // Vegan Check
    if (preferences.vegan) {
        const veganKeywords = ['milk', 'dairy', 'cheese', 'butter', 'egg', 'honey', 'gelatin', 'whey', 'casein', 'lactose', 'carmine', 'cochineal', 'collagen'];
        const nonVeganDetected = veganKeywords.some(keyword => lowerCaseIngredients.includes(keyword));
        complianceMessages.push(`<p class="${nonVeganDetected ? 'flagged' : 'compliant'}">Vegan: ${nonVeganDetected ? '❌ May not be vegan' : '✅ Appears vegan'}</p>`);
    }

    // Vegetarian Check (less strict than vegan)
    if (preferences.vegetarian) {
        const vegetarianKeywords = ['gelatin', 'carmine', 'cochineal', 'animal fat', 'animal broth', 'rennet'];
        const nonVegetarianDetected = vegetarianKeywords.some(keyword => lowerCaseIngredients.includes(keyword));
        complianceMessages.push(`<p class="${nonVegetarianDetected ? 'flagged' : 'compliant'}">Vegetarian: ${nonVegetarianDetected ? '❌ May not be vegetarian' : '✅ Appears vegetarian'}</p>`);
    }

    // Gluten-Free Check
    if (preferences.glutenFree) {
        const glutenKeywords = ['wheat', 'barley', 'rye', 'malt', 'brewer\'s yeast', 'oats (unless certified gluten-free)']; // Add more as needed
        const glutenDetected = glutenKeywords.some(keyword => lowerCaseIngredients.includes(keyword));
        complianceMessages.push(`<p class="${glutenDetected ? 'flagged' : 'compliant'}">Gluten-Free: ${glutenDetected ? '❌ May contain gluten' : '✅ Appears gluten-free'}</p>`);
    }

    // Allergen Avoidance Check
    if (preferences.allergens && preferences.allergens.length > 0) {
        const avoidedAllergens = preferences.allergens.map(a => a.toLowerCase());
        const detectedAllergens = avoidedAllergens.filter(allergen => lowerCaseIngredients.includes(allergen));

        if (detectedAllergens.length > 0) {
            complianceMessages.push(`<p class="flagged">❌ Contains custom allergens: ${detectedAllergens.join(', ')}</p>`);
        } else {
            complianceMessages.push(`<p class="compliant">✅ No custom allergens detected.</p>`);
        }
    }

    return complianceMessages.length > 0 ? `<div class="compliance-info">${complianceMessages.join('')}</div>` : '';
}

// --- Camera and Scanner Functions ---

/**
 * Gets a list of available cameras and sets the default.
 * @returns {Promise<string|null>} The ID of the default camera or null if none found.
 */
async function getCameras() {
    displayMessage('Detecting cameras...', 'info');
    try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
            availableCameras = devices;
            // Prefer the 'environment' (rear) camera if available
            const rearCamera = devices.find(device =>
                device.label.toLowerCase().includes('back') ||
                device.label.toLowerCase().includes('environment')
            );
            currentCameraId = rearCamera ? rearCamera.id : devices[0].id;
            displayMessage(`${devices.length} camera(s) found.`, 'info');
            return currentCameraId;
        } else {
            displayMessage('No cameras found on this device.', 'error');
            return null;
        }
    } catch (err) {
        console.error('Error getting cameras:', err);
        displayMessage('Error accessing camera devices. Please ensure permissions are granted.', 'error');
        return null;
    }
}

/**
 * Initializes and starts the QR code scanner.
 * @param {string} cameraId The ID of the camera to use.
 */
async function initializeScanner(cameraId) {
    if (!scannerContainer || !scanButton) {
        console.error('Scanner container or scan button not found.');
        return;
    }

    // Ensure the scanner is stopped before initializing a new one
    if (isScannerRunning) {
        await stopScanner();
    }

    displayMessage('Starting scanner...', 'info');
    scannerContainer.innerHTML = ''; // Clear previous content

    html5QrcodeScanner = new Html5Qrcode("scanner-container", {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        // Important to avoid re-requesting permission on every start
        // Set up the camera device configuration based on provided ID
        // Or set 'facingMode' to 'environment' or 'user'
        // preferCamera: { facingMode: "environment" } // This can be used as an alternative
        // Use `deviceId` if you want to explicitly select a camera
        // You'll need to get this from `Html5Qrcode.getCameras()`
    });

    // Success callback
    const onScanSuccess = async (decodedText, decodedResult) => {
        if (decodedText !== lastScannedCode) { // Avoid processing the same code repeatedly
            lastScannedCode = decodedText;
            displayMessage(`Barcode scanned: ${decodedText}`, 'success');
            await stopScanner(); // Stop scanner after successful scan
            await fetchAndProcessProduct(decodedText, true); // True because it's a new scan
        }
    };

    // Error callback
    const onScanError = (errorMessage) => {
        // You can log errors but avoid displaying too many to the user during active scanning
        // console.warn(`Scan error: ${errorMessage}`);
    };

    try {
        await html5QrcodeScanner.start(
            cameraId, // This will be the device ID
            {
                fps: 10, // frame per second
                qrbox: { width: 250, height: 250 }
            },
            onScanSuccess,
            onScanError
        );
        isScannerRunning = true;
        scanButton.textContent = 'Stop Scan';
        if (cameraControls) cameraControls.style.display = 'flex'; // Show camera controls
        displayMessage('Scanner started. Point your camera at a barcode.', 'success');
        scannerContainer.style.display = 'block'; // Ensure scanner view is visible
    } catch (err) {
        console.error('Error starting scanner:', err);
        isScannerRunning = false;
        scanButton.textContent = 'Start Scan';
        if (cameraControls) cameraControls.style.display = 'none';
        displayMessage(`Could not start scanner: ${err.message}. Please check camera availability and permissions.`, 'error');
        scannerContainer.innerHTML = '<p>Failed to start camera. See error message above.</p>';
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
    const mainContentSections = [productInfoDiv, scannerContainer, manualScanSection, dietaryPreferencesSection, scanHistorySection];

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
        displayMessage("Dietary preferences cleared and reset.", "success");
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
        displayMessage("Scan history cleared.", "success");
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
    manualScanSection = document.getElementById('manualScanSection'); // Assign this element
    sidebar = document.getElementById('mySidebar');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    hamburgerMenu = document.getElementById('hamburgerMenu');
    sidebarCloseButton = document.getElementById('sidebarCloseButton');
    showPreferencesButton = document.getElementById('showPreferencesButton');
    showHistoryButton = document.getElementById('showHistoryButton');
    dietaryPreferencesSection = document.getElementById('dietaryPreferencesSection');
    scanHistorySection = document.getElementById('scanHistorySection');
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

    // Manual Scan Link in Sidebar (if you have one)
    if (document.getElementById('showManualScanButton')) { // Assuming an ID for this button
        document.getElementById('showManualScanButton').addEventListener('click', () => {
            showMainContent(manualScanSection, 'Enter a UPC code manually.');
        });
    }


    // Sidebar Section Toggling (Accordions for Preferences and History in Sidebar)
    function setupSidebarAccordions() {
        if (sidebarDietaryPreferencesHeader && dietaryPreferencesSection) {
            sidebarDietaryPreferencesHeader.addEventListener('click', () => {
                sidebarDietaryPreferencesHeader.classList.toggle('active');
                dietaryPreferencesSection.classList.toggle('active');

                if (sidebarDietaryPreferencesHeader.classList.contains('active')) {
                    loadDietaryPreferences(); // Re-load preferences when section opens
                }
            });
        }

        if (sidebarScanHistoryHeader && scanHistorySection) {
            sidebarScanHistoryHeader.addEventListener('click', () => {
                sidebarScanHistoryHeader.classList.toggle('active');
                scanHistorySection.classList.toggle('active');

                if (sidebarScanHistoryHeader.classList.contains('active')) {
                    loadScanHistory(); // Load history when section opens
                }
            });
        }
    }

    // Call this new setup function for sidebar accordions
    setupSidebarAccordions();

    // Initial display of the main product info section, as the default view
    showMainContent(productInfoDiv, 'Scan a barcode or enter a UPC to get started!');

    // MutationObserver for manualScanSection (as per your code)
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
        // We want to watch for changes to its 'attributes' (specifically 'style')
        observer.observe(manualScanSection, { attributes: true, attributeFilter: ['style'] });

        // IMPORTANT: If you have a 'stopScanner' function,
        // you might want to call observer.disconnect() when the scanner stops
        // to prevent it from running unnecessarily.
        // E.g., in your stopScanner function:
        // if (observer) {
        // observer.disconnect();
        // }
    }

}); // End DOMContentLoaded