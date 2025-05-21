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
    const scanHistorySection = document.getElementById('scanHistorySection'); // New: History section
    const scanHistoryList = document.getElementById('scanHistoryList');       // New: History list
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');       // New: Clear history button

    let isScannerRunning = false;
    const MAX_HISTORY_ITEMS = 10; // Limit the number of items in history

    // Helper function to display messages
    function displayMessage(message, type = "info") {
        scannerMessage.textContent = message;
        scannerMessage.className = `message ${type}`;
    }

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

        // Remove existing entry for this UPC if it exists (to move it to top)
        history = history.filter(item => item.upc !== product.upc);

        // Add new product to the beginning of the array
        history.unshift({
            upc: product.upc,
            name: product.name,
            image: product.image,
            timestamp: new Date().toISOString()
        });

        // Trim history to MAX_HISTORY_ITEMS
        if (history.length > MAX_HISTORY_ITEMS) {
            history = history.slice(0, MAX_HISTORY_ITEMS);
        }

        try {
            localStorage.setItem('scanHistory', JSON.stringify(history));
            renderScanHistory(); // Re-render history after saving
        } catch (e) {
            console.error("Error saving scan history to localStorage:", e);
            displayMessage("Could not save scan to history (storage full?).", "warning");
        }
    }

    function renderScanHistory() {
        const history = getScanHistory();
        scanHistoryList.innerHTML = ''; // Clear current list

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
                fetchUpcBtn.click();
            });
            scanHistoryList.appendChild(li);
        });
        clearHistoryBtn.style.display = 'block';
    }

    function clearScanHistory() {
        if (confirm('Are you sure you want to clear your scan history?')) { // Using confirm for now, will replace with custom modal later
            localStorage.removeItem('scanHistory');
            renderScanHistory();
            displayMessage('Scan history cleared.', 'info');
        }
    }

    // Initial render of history when page loads
    renderScanHistory();
    clearHistoryBtn.addEventListener('click', clearScanHistory);


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
            productInfoDiv.innerHTML = '<p>Loading product details...</p>';
            clearResultsBtn.style.display = 'none';

            try {
                const BACKEND_URL = 'https://upc-scanner-backend-api.onrender.com';
                const response = await fetch(`${BACKEND_URL}/api/ingredients/${upc}`);
                const data = await response.json();

                if (!response.ok) {
                    displayMessage(data.message || 'Error fetching product information.', 'error');
                    productInfoDiv.innerHTML = `
                        <div class="info-card error-card">
                            <h2>Error</h2>
                            <p>${data.message || 'Could not retrieve product information. Please try again or check your internet connection.'}</p>
                            <p>Status: ${response.status}</p>
                        </div>
                    `;
                    return;
                }

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
                    clearResultsBtn.style.display = 'block';
                    return;
                }

                displayProductInfo(data);
                displayMessage('Product information fetched successfully.', 'success');
                clearResultsBtn.style.display = 'block';
                saveScanToHistory(data); // NEW: Save product to history after successful fetch

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

        // --- Product Header (Name and Image) ---
        html += `
            <div class="product-header">
                <h1>${product.name || 'Unknown Product'}</h1>
                ${product.image ? `<img src="${product.image}" alt="${product.name || 'Product Image'}" class="product-image">` : ''}
            </div>
        `;

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
                } else if (add.status && add.status !== 'Not banned in EU') {
                    statusText = add.status;
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

        // Finally, update the productInfoDiv with the constructed HTML
        productInfoDiv.innerHTML = html;

        // *** CALL THE ACCORDION SETUP FUNCTION HERE ***
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

    // Quagga2 scanner integration (unchanged)
    function startScanner() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
                    upcInput.value = upcCode;
                    stopScanner();
                    fetchUpcBtn.click();
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
            scannerContainer.innerHTML = '';
            startScannerBtn.style.display = 'inline-block';
            stopScannerBtn.style.display = 'none';
        }
    }

    startScannerBtn.addEventListener('click', startScanner);
    stopScannerBtn.addEventListener('click', stopScanner);
});
