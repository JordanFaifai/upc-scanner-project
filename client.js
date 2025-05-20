// client.js
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

    let isScannerRunning = false;

    // Helper function to display messages
    function displayMessage(message, type = "info") {
        scannerMessage.textContent = message;
        scannerMessage.className = `message ${type}`;
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

    // Clear Results Button
    clearResultsBtn.addEventListener('click', function() {
        productInfoDiv.innerHTML = '';
        displayMessage('Scan a barcode or enter a UPC manually.');
        clearResultsBtn.style.display = 'none'; // Hide clear button after clearing
    });


    // Function to fetch product info
    async function fetchProductInfo(upc) {
    productInfoDiv.innerHTML = '<p class="message info">Fetching product info...</p>'; // Improved loading message
    clearResultsBtn.style.display = 'none'; // Hide clear button while fetching
    try {
        console.log('Inside fetchProductInfo. Making API request to:', `/api/ingredients/${upc}`);
        const response = await fetch(`/api/ingredients/${upc}`);

        if (!response.ok) {
            const errorData = await response.json(); // Try to parse error as JSON if available
            const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
            console.error('API response not OK (HTTP status:', response.status, '). Error data:', errorData);
            throw new Error(errorMessage);
        }
        const data = await response.json();
        console.log('Successfully fetched product data:', data);

        // Check if product data was found (server sends data.name, not data.productName)
        if (data.name) {
            const productName = data.name;
            const ingredients = data.ingredients || 'No ingredient text available.';
            const novaGroup = data.novaGroup || 'Unknown';
            const novaExplanation = data.novaExplanation || 'Information not available.';
             const novaGroupForClass = String(novaGroup).replace(' ', '-'); 
            const imageUrl = data.image || 'no_image.png'; // Provide a default image if none
            const source = data.source || 'Open Food Facts';
            const nutrition = data.nutrition_facts; // This is an object
            const additives = data.additives || []; // Expecting an array of additive objects
            let allergens = data.allergens || []; // Expecting an array of raw allergen strings

            // --- Allergen Processing ---
            let processedAllergens = new Set(); // Use a Set to store unique allergens
            if (Array.isArray(allergens)) {
                allergens.forEach(allergen => {
                    let cleanedAllergen = allergen.replace(/^en:/, '').trim(); // Remove 'en:' prefix
                    cleanedAllergen = cleanedAllergen.charAt(0).toUpperCase() + cleanedAllergen.slice(1); // Capitalize first letter
                    if (cleanedAllergen) {
                        processedAllergens.add(cleanedAllergen);
                    }
                });
            }
            const allergensHtml = processedAllergens.size > 0
                ? `<p>${Array.from(processedAllergens).join(', ')}</p>`
                : '<p>No allergens specified.</p>';


            // --- Additives Processing ---
            // client.js
// ... (keep the existing lines above this section)

            // --- Additives Processing ---
            let additivesHtml = '';
            if (additives && additives.length > 0) {
                additivesHtml = '<h3>Food Additives</h3><ul class="additive-list">';
                additives.forEach(additive => {
                    // Display only E-number, Name, and Type, as requested.
                    // Risk level and explanation are deliberately omitted from the UI.
                    additivesHtml += `
                        <li>
                            <strong>${additive.name}</strong> (${additive.e_number || 'N/A'})
                            <p>Type: ${additive.type || 'N/A'}</p>
                        </li>
                    `;
                });
                additivesHtml += '</ul>'; // The disclaimer paragraph is also removed.
            } else {
                additivesHtml = '<p>No specific food additives found.</p>';
            }

// ... (rest of your client.js code remains the same)

            // Helper function to format nutrition data
            const formatNutrition = (nutriment, unit = '') => {
                return nutriment !== 'N/A' && nutriment !== undefined && nutriment !== null ? `${nutriment}${unit}` : 'N/A';
            };

            let nutritionHtml = '';
            if (nutrition && nutrition !== 'N/A') {
                nutritionHtml = `
                    <h3>Nutrition Facts (per 100g)</h3>
                    <ul>
                        <li><strong>Calories:</strong> ${formatNutrition(nutrition.calories, 'kcal')}</li>
                        <li><strong>Protein:</strong> ${formatNutrition(nutrition.protein, 'g')}</li>
                        <li><strong>Carbohydrates:</strong> ${formatNutrition(nutrition.carbohydrates, 'g')}</li>
                        <li><strong>Fat:</strong> ${formatNutrition(nutrition.fat, 'g')}</li>
                    </ul>
                `;
            } else {
                nutritionHtml = '<p>Nutrition information not available.</p>';
            }

            // Construct the HTML to display
            productInfoDiv.innerHTML = `
                <div class="product-card">
                    <img src="${imageUrl}" alt="${productName}" class="product-image">
                    <h2>${productName}</h2>

                    <div class="collapsible-section">
                        <button class="collapsible-header">Ingredients</button>
                        <div class="collapsible-content">
                            <p>${ingredients}</p>
                        </div>
                    </div>

                    <div class="collapsible-section">
                        <button class="collapsible-header">Allergens</button>
                        <div class="collapsible-content">
                            ${allergensHtml}
                        </div>
                    </div>

                    <div class="collapsible-section">
                        <button class="collapsible-header">NOVA Classification</button>
                        <div class="collapsible-content">
                            <p><strong>NOVA Group:</strong> <span class="nova-badge nova-group-${novaGroupForClass}">${novaGroup}</span></p>
                            <p>${novaExplanation}</p>
                        </div>
                    </div>

                    <div class="collapsible-section">
                        <button class="collapsible-header">Food Additives</button>
                        <div class="collapsible-content">
                            ${additivesHtml}
                        </div>
                    </div>

                    <div class="collapsible-section">
                        <button class="collapsible-header">Nutrition Information</button>
                        <div class="collapsible-content">
                            ${nutritionHtml}
                        </div>
                    </div>

                    <p class="source-info">Source: ${source}</p>
                </div>
            `;

            // Initialize collapsible sections after they are added to the DOM
            initCollapsibles();

        } else {
            console.warn('API returned no product name for UPC:', upc, data);
            productInfoDiv.innerHTML = `<p class="message warning">No product found for UPC: ${upc}</p>`;
        }
    } catch (error) {
        console.error('Error fetching product info (from catch block):', error);
        productInfoDiv.innerHTML = `<p class="message error">Error fetching product info: ${error.message}. Please try again or check the UPC.</p>`;
    } finally {
        clearResultsBtn.style.display = 'block'; // Show clear button after fetching (whether successful or not)
    }
}

// Add this new function to handle the collapsible sections
function initCollapsibles() {
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
    collapsibleHeaders.forEach(header => {
        header.removeEventListener('click', toggleCollapsible); // Remove old listeners to prevent duplicates
        header.addEventListener('click', toggleCollapsible);
    });
}

function toggleCollapsible(event) {
    event.target.classList.toggle('active');
    const content = event.target.nextElementSibling;
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
    } else {
        content.style.maxHeight = content.scrollHeight + 'px';
    }
}

    // Manual UPC fetch
    fetchUpcBtn.addEventListener('click', async function() {
        const upc = upcInput.value.trim();
        if (upc) {
            console.log('Manual fetch button clicked. Attempting to fetch product for UPC:', upc); // ADD OR MODIFY THIS LINE
        displayMessage('Fetching product for ' + upc + '...');
        await fetchProductInfo(upc);
        upcInput.value = ''; // Clear input field
        } else {
            displayMessage('Please enter a UPC.', 'warning');
            console.warn('Manual UPC input is empty. Not fetching.');
        }
    });

    // Scanner Logic
    function startScanner() {
        displayMessage('Starting scanner...');
        scannerContainer.innerHTML = ''; // Clear previous content
        isScannerRunning = true;

        Quagga.init(
            {
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: scannerContainer, // Use the actual container element
                    constraints: {
                        facingMode: "environment" // Simple string for rear camera - KEEP THIS
                    }
                },
                decoder: {
                    readers: ["ean_reader"]
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                }
            },
            // THIS IS THE CALLBACK FUNCTION - ALL THE CODE BELOW IS INSIDE IT
            function(err) {
                if (err) {
                    console.error("Quagga.init error:", err);
                    displayMessage(`Error initializing Quagga: ${err.message}`, "error");
                    return; // Stop if there's an initialization error
                }
                console.log("Quagga initialization finished. Ready to start.");
                Quagga.start(); // This is the ONLY place Quagga.start() should be
                console.log("Quagga.start() was called."); // This new log is correctly placed here

                // Set the scanning message now that scanner is ready
                scannerMessage.textContent = 'Scanning... Point camera at a UPC barcode.';
            }
            // END OF CALLBACK FUNCTION - NO CODE HERE BEFORE THE SEMICOLON
        ); // This semicolon ends the Quagga.init call

        Quagga.onDetected(function(data) {
            if (isScannerRunning) {
                console.log("Barcode detected:", data.codeResult.code);
                Quagga.stop();
                isScannerRunning = false;
                displayMessage('Barcode detected: ' + data.codeResult.code);
                fetchProductInfo(data.codeResult.code);
            }
        });

        // Optional: for debugging - shows bounding boxes
        Quagga.onProcessed(function(result) {
            var drawingCtx = Quagga.canvas.ctx.overlay;
            var drawingCanvas = Quagga.canvas.dom.overlay;

            if (result) {
                if (result.boxes) {
                    drawingCtx.clearRect(
                        0,
                        0,
                        parseInt(drawingCanvas.width),
                        parseInt(drawingCanvas.height)
                    );
                    result.boxes
                        .filter(function(box) {
                            return box !== result.box;
                        })
                        .forEach(function(box) {
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
    }

    function stopScanner() {
        if (isScannerRunning) {
            Quagga.stop();
            isScannerRunning = false;
            displayMessage('Scanner stopped.');
            // Clear the scanner container content
            scannerContainer.innerHTML = '';
        }
    }

    startScannerBtn.addEventListener('click', startScanner);
    stopScannerBtn.addEventListener('click', stopScanner);
});