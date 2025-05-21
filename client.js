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

    // Handle UPC fetching
    fetchUpcBtn.addEventListener('click', async function() {
        const upc = upcInput.value.trim();
        if (upc) {
            displayMessage('Fetching product information...', 'info');
            // Clear previous results to prevent old data from showing while new is loading
            productInfoDiv.innerHTML = '<p>Loading product details...</p>';
            clearResultsBtn.style.display = 'none'; // Hide clear button until new results show
            
            try {
const BACKEND_URL = 'https://upc-scanner-api.onrender.com'; // Use your actual backend URL here!
// Make sure the fetch call uses backticks (`) and correctly interpolates the BACKEND_URL and upc
const response = await fetch(`<span class="math-inline">\{BACKEND\_URL\}/api/ingredients/</span>{upc}`);
                const data = await response.json(); // 'data' now directly contains the product object (e.g., {name: "...", ingredients: "...", ...})

                if (!response.ok) {
                    // Specific error handling for API response issues
                    displayMessage(data.message || 'Error fetching product information.', 'error');
                    productInfoDiv.innerHTML = `
                        <div class="info-card error-card">
                            <h2>Error</h2>
                            <p>${data.message || 'Could not retrieve product information. Please try again or check your internet connection.'}</p>
                            <p>Status: ${response.status}</p>
                        </div>
                    `;
                    return; // Stop execution if there's an API error
                }

                // *** CRITICAL CHANGE HERE: Check if 'data' itself contains valid product info (e.g., a 'name') ***
                // If the server returns product data directly, 'data.product' would be undefined.
                // We check if 'data' is an object and has a 'name' property to consider it a valid product.
                if (!data || typeof data !== 'object' || !data.name) {
                    displayMessage(`Product data incomplete or not found for UPC: ${upc}.`, 'warning');
                    productInfoDiv.innerHTML = `
                        <div class="info-card no-product">
                            <h2>Product Not Found or Incomplete Data</h2>
                            <p>We received data for UPC: <strong>${upc}</strong>, but it does not appear to be a complete product record from Open Food Facts.</p>
                            <p>Try scanning a different product or check the UPC for typos.</p>
                            <p><a href="https://world.openfoodfacts.org/barcode/${upc}" target="_blank" class="external-link">Search Open Food Facts directly for ${upc}</a></p>
                        </div>
                    `;
                    clearResultsBtn.style.display = 'block'; // Allow clearing this message
                    return; // Stop execution if product data is invalid
                }

                // If product data is found and looks valid
                // *** CRITICAL CHANGE HERE: Pass 'data' directly, as it IS the product object ***
                displayProductInfo(data);
                displayMessage('Product information fetched successfully.', 'success');
                clearResultsBtn.style.display = 'block'; // Show clear button after successful fetch

            } catch (error) {
                console.error('Error:', error);
                displayMessage('Network error or server is unreachable. Please check your connection.', 'error');
                productInfoDiv.innerHTML = `
                    <div class="info-card error-card">
                        <h2>Network Error</h2>
                        <p>Could not connect to the server. Please ensure the server is running and your internet connection is stable.</p>
                    </div>
                `;
                clearResultsBtn.style.display = 'none';
            }
        } else {
            displayMessage('Please enter a UPC code.', 'warning');
        }
    });

    // Clear Results button handler
    clearResultsBtn.addEventListener('click', function() {
        productInfoDiv.innerHTML = '<p>Scan a UPC or enter it manually to see results.</p>';
        upcInput.value = ''; // Clear the input field
        clearResultsBtn.style.display = 'none'; // Hide the clear button
        displayMessage('Results cleared.', 'info');
    });

    // *** CRITICAL CHANGE HERE: 'product' parameter now directly IS the product object ***
    function displayProductInfo(product) { 
        // Removed: const product = productData.product; // This line is no longer needed
        
        let html = ''; // Initialize the HTML string

        // --- Product Header (Name and Image) ---
        html += `
            <div class="product-header">
                <h1>${product.name || 'Unknown Product'}</h1>
                ${product.image ? `<img src="${product.image}" alt="${product.name || 'Product Image'}" class="product-image">` : ''}
            </div>
        `;

        // --- Ingredients ---
        html += `
            <div class="section-card">
                <h2>Ingredients</h2>
                <p>${product.ingredients || 'Ingredients list not available.'}</p>
            </div>
        `;

        // --- Processing Level (NOVA Group) ---
        // Ensure product.novaGroup and product.novaExplanation are accessed directly
       
            html += `
    <div class="section-card nova-info nova-group-${String(product.novaGroup || '').toLowerCase().replace(' ', '-') || 'unknown'}">
                <h2>Processing Level: NOVA Group ${product.novaGroup || 'N/A'}</h2>
                <p>This classification describes how much a food has been processed:</p>
                <p>
                    <strong>${product.novaExplanation || 'No detailed NOVA group explanation available.'}</strong>
                </p>
        `;

        // Add a note about additives if they are present
        if (product.additives && product.additives.length > 0) {
            const additiveCount = product.additives.length;
            let additiveNote = '';
            if (product.novaGroup === '4') {
                additiveNote = `It contains ${additiveCount} food additive${additiveCount !== 1 ? 's' : ''}, which are characteristic of ultra-processed foods.`;
            } else if (product.novaGroup === '3') {
                additiveNote = `It contains ${additiveCount} food additive${additiveCount !== 1 ? 's' : ''}. Additives are sometimes used in processed foods to preserve or enhance flavor/texture.`;
            } else { // For NOVA Group 1 or 2
                additiveNote = `It contains ${additiveCount} food additive${additiveCount !== 1 ? 's' : ''}.`;
            }
            html += `<p class="additive-nova-note">${additiveNote}</p>`;
        }

        html += `
                <p class="nova-description">
                    <a href="https://en.wikipedia.org/wiki/NOVA_classification" target="_blank" class="external-link" title="Learn more about NOVA classification">
                        Learn more about NOVA food classification
                    </a>
                </p>
            </div>
        `;

        // --- Allergens ---
        html += `
            <div class="section-card allergen-info">
                <h2>Allergens</h2>
                ${product.allergens && product.allergens.length > 0 ?
                    `<p><strong>May Contain:</strong> ${product.allergens.map(a => `<span class="allergen-tag">${a.replace(/en:/g, '').replace(/-/g, ' ')}</span>`).join(', ')}</p>` :
                    `<p>No allergens declared for this product.</p>`
                }
            </div>
        `;

        // --- Additives ---
        if (product.additives && product.additives.length > 0) {
            html += `
                <div class="section-card additives-info">
                    <h2>Additives</h2>
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
                } else if (add.status && add.status !== 'Not banned in EU') { // Catch other specific statuses
                     statusText = add.status;
                     statusClass += ' info'; // Neutral info class
                } else {
                    statusClass = ''; // Clear status class if no specific status to show or "Not banned"
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
            `;
        } else {
            html += `
                <div class="section-card additives-info">
                    <h2>Additives</h2>
                    <p>No specific additives found or listed for this product.</p>
                </div>
            `;
        }

        // --- Nutrition Facts ---
        if (product.nutrition_facts) {
            html += `
                <div class="section-card nutrition-info">
                    <h2>Nutrition Facts <small>(per 100g/ml)</small></h2>
                    <div class="nutrition-grid">
                        <p><strong>Calories:</strong> ${product.nutrition_facts.calories || 'N/A'} kcal</p>
                        <p><strong>Protein:</strong> ${product.nutrition_facts.protein || 'N/A'} g</p>
                        <p><strong>Carbohydrates:</strong> ${product.nutrition_facts.carbohydrates || 'N/A'} g</p>
                        <p><strong>Fat:</strong> ${product.nutrition_facts.fat || 'N/A'} g</p>
                        <p><strong>Sugar:</strong> ${product.nutrition_facts.sugar || 'N/A'} g</p>
                        <p><strong>Salt:</strong> ${product.nutrition_facts.salt || 'N/A'} g</p>
                        <p><strong>Fiber:</strong> ${product.nutrition_facts.fiber || 'N/A'} g</p>
                    </div>
                </div>
            `;
        }

        // --- Data Source ---
        html += `
            <div class="section-card source-info">
                <h3>Data Source</h3>
                <p>Information provided by ${product.source || 'Open Food Facts'}.</p>
            </div>
        `;
        
        // Finally, update the productInfoDiv with the constructed HTML
        productInfoDiv.innerHTML = html;
    }

    // Quagga2 scanner integration (This section is now correct and unchanged from previous fix)
    function startScanner() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: scannerContainer,
                    constraints: {
                        facingMode: "environment" // Use the back camera
                    }
                },
                decoder: {
                    readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"]
                }
            }, function(err) {
                if (err) {
                    console.error(err);
                    displayMessage(`Error starting scanner: ${err.message}`, 'error');
                    return;
                }
                Quagga.start();
                isScannerRunning = true;
                displayMessage('Scanner started. Point to a UPC code.', 'info');
                startScannerBtn.style.display = 'none'; 
                stopScannerBtn.style.display = 'inline-block';
            });

            Quagga.onDetected(function(result) {
                if (result && result.codeResult && result.codeResult.code) {
                    const upcCode = result.codeResult.code;
                    upcInput.value = upcCode; // Populate the manual input field
                    stopScanner(); // Stop the scanner automatically on detection
                    fetchUpcBtn.click(); // Trigger the fetch for the detected UPC
                }
            });

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
            // Clear the scanner container content
            scannerContainer.innerHTML = '';
            startScannerBtn.style.display = 'inline-block';
            stopScannerBtn.style.display = 'none';
        }
    }

    startScannerBtn.addEventListener('click', startScanner);
    stopScannerBtn.addEventListener('click', stopScanner);
});