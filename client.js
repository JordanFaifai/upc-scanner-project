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
        productInfoDiv.innerHTML = 'Fetching product info...';
        clearResultsBtn.style.display = 'none'; // Hide clear button while fetching
        try {
            console.log('Inside fetchProductInfo. Making API request to:', `/api/ingredients/${upc}`); // ADD OR MODIFY THIS LINE
        const response = await fetch(`/api/ingredients/${upc}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API response not OK (HTTP status:', response.status, '). Error text:', errorText); // ADD OR MODIFY THIS LINE
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log('Successfully fetched product data:', data); // ADD OR MODIFY THIS LINE

        if (data.productName && data.ingredients) { // Check directly for productName
            // ... rest of your success display logic
            let ingredients = data.product.ingredients_text || 'No ingredients listed.';
            if (data.product.ingredients_text_debug) {
                ingredients += `<br><small>(Debug: ${data.product.ingredients_text_debug})</small>`;
            }
            productInfoDiv.innerHTML = `
                <h3>${data.productName}</h3>
                <p><strong>Ingredients:</strong> ${data.ingredients}</p>
                <p><small>Source: ${data.source}</small></p>
            `;
        } else {
            console.warn('API returned no product data or product name for UPC:', upc, data); // ADD OR MODIFY THIS LINE
            productInfoDiv.innerHTML = `<p>No product found for UPC: ${upc}</p>`;
        }
    } catch (error) {
        console.error('Error fetching product info (from catch block):', error); // ADD OR MODIFY THIS LINE
        productInfoDiv.innerHTML = `<p class="error">Error fetching product info: ${error.message}. Please try again or check the UPC.</p>`;
    } finally {
        clearResultsBtn.style.display = 'block'; // Show clear button after fetching (whether successful or not)
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