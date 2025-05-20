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
            try {
                const response = await fetch(`/api/ingredients/${upc}`);
                const data = await response.json();
                if (response.ok) {
                    displayProductInfo(data);
                    displayMessage('Product information fetched successfully.', 'success');
                    clearResultsBtn.style.display = 'block';
                } else {
                    displayMessage(data.message || 'Error fetching product information.', 'error');
                    productInfoDiv.innerHTML = `<p>Error: ${data.message || 'Product not found or error fetching data.'}</p>`;
                    clearResultsBtn.style.display = 'none';
                }
            } catch (error) {
                console.error('Error:', error);
                displayMessage('Network error or server is unreachable.', 'error');
                productInfoDiv.innerHTML = `<p>Error: Could not connect to the server.</p>`;
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

    function displayProductInfo(product) {
        let additivesHtml = '';
        if (product.additives && product.additives.length > 0) {
            additivesHtml = '<ul class="additive-list">';
            product.additives.forEach(add => {
                // Determine the status text and badge class
                let statusText = '';
                let statusClass = 'additive-risk-badge'; // Default class

                // Check if status contains "BANNED in EU"
                if (add.status && add.status.includes('BANNED in EU')) {
                    statusText = 'BANNED in EU';
                    statusClass += ' banned'; // Add a specific class for banned
                } else if (add.status) {
                    statusText = add.status; // Show other specific statuses like warnings
                    statusClass += ' warning'; // Or another class for warnings/notes
                } else {
                    // If status is empty or only "Not banned in EU", display nothing.
                    // No statusText and no extra statusClass needed.
                    statusClass = ''; // Clear status class if no specific status to show
                }

                additivesHtml += `
                    <li>
                        <strong>${add.e_number ? add.e_number + ' - ' : ''}${add.name}</strong>
                        <p>Type: ${add.type}</p>
                        ${statusText ? `<span class="${statusClass}">${statusText}</span>` : ''}
                    </li>
                `;
            });
            additivesHtml += '</ul>';
        } else {
            additivesHtml = '<p>No specific additives found or listed for this product.</p>';
        }

        const allergensHtml = product.allergens && product.allergens.length > 0
            ? `<p><strong>Allergens:</strong> ${product.allergens.map(a => a.replace(/en:/g, '').replace(/-/g, ' ')).join(', ')}</p>`
            : '<p><strong>Allergens:</strong> None listed.</p>';

        const novaGroupText = product.novaExplanation ? `(NOVA Group ${product.novaGroup}: ${product.novaExplanation})` : `(NOVA Group ${product.novaGroup})`;

        productInfoDiv.innerHTML = `
            <h2>${product.name || 'N/A'}</h2>
            ${product.image ? `<img src="${product.image}" alt="Product Image" style="max-width: 200px; height: auto;">` : ''}
            <p><strong>Ingredients:</strong> ${product.ingredients || 'N/A'}</p>
            <p><strong>Processing Level:</strong> ${product.novaGroup ? novaGroupText : 'N/A'}</p>
            ${allergensHtml}
            <h3>Additives:</h3>
            ${additivesHtml}
            <h3>Nutrition Facts (per 100g/ml):</h3>
            <ul>
                <li>Energy: ${product.nutrition_facts.energy || 'N/A'}</li>
                <li>Fat: ${product.nutrition_facts.fat || 'N/A'}</li>
                <li>Sugars: ${product.nutrition_facts.sugar || 'N/A'}</li>
                <li>Salt: ${product.nutrition_facts.salt || 'N/A'}</li>
                <li>Fiber: ${product.nutrition_facts.fiber || 'N/A'}</li>
            </ul>
            <p><strong>Source:</strong> ${product.source || 'Open Food Facts'}</p>
        `;
    }

    // Quagga2 scanner integration
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