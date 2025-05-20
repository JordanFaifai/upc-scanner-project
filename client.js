// client.js

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const scannerMessage = document.getElementById('scanner-message');
const resultsDiv = document.getElementById('results');
const scannerContainer = document.getElementById('scanner-container');

let scannerRunning = false;

// Function to initialize and start the scanner
function startScanner() {
    scannerRunning = true;
    scannerMessage.textContent = 'Starting scanner...';
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-block';
    scannerContainer.style.display = 'block'; // Show scanner container

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'), // Target the video element
            constraints: {
                facingMode: "environment" // Use rear camera on mobile devices
            },
        },
        decoder: {
            readers: [
                "ean_reader", // EAN-13 is the most common UPC format
                // You can uncomment other readers if you want to support more barcode types:
                // "ean_8_reader",
                // "upc_reader",
                // "code_128_reader",
                // "code_39_reader"
            ],
            debug: {
                showCanvas: false, // Set to true to see the scan lines (for debugging)
                showPatches: false,
                showFoundInfos: false,
                showSkeleton: false,
                showLabels: false,
                showPatchLabels: false,
                showRemainingPatchLabels: false,
                boxFromPatches: {
                    showTransformed: false,
                    showTransformedBox: false,
                    showLayout: false
                },
                showQuaggaNodes: false,
                showBoundingBox: true // Show bounding box around detected barcode
            },
        },
    }, function(err) {
        if (err) {
            console.error("Quagga initialization failed:", err);
            scannerMessage.textContent = `Error starting scanner: ${err.message}. Please ensure camera access is granted and your browser supports it.`;
            stopScanner(); // Stop immediately if error
            return;
        }
        console.log("Quagga initialization finished. Ready to start.");
        Quagga.start();
        scannerMessage.textContent = 'Scanning... Point camera at a UPC barcode.';
    });

    // Event listener for when a barcode is detected
    Quagga.onDetected(function(data) {
        if (scannerRunning) {
            const upc = data.codeResult.code;
            console.log("Barcode detected and decoded:", upc);
            scannerMessage.textContent = `UPC Detected: ${upc}. Fetching ingredients...`;
            stopScanner(); // Stop scanning once a UPC is found to prevent multiple scans

            // Send UPC to your backend server
            fetchIngredients(upc);
        }
    });

    // This part draws the scanning box/lines for visual feedback (optional)
    Quagga.onProcessed(function(result) {
        var drawingCtx = Quagga.canvas.ctx.overlay,
            drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, '#a0a0a0');
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, '#00F', 2);
            }

            if (result.codeResult && result.codeResult.code) {
                Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, '#0F0', 3);
            }
        }
    });
}

// Function to stop the scanner
function stopScanner() {
    if (scannerRunning) {
        Quagga.stop();
        scannerRunning = false;
        scannerMessage.textContent = 'Scanner stopped.';
        startButton.style.display = 'inline-block';
        stopButton.style.display = 'none';
        scannerContainer.style.display = 'none'; // Hide scanner container
    }
}

// Function to fetch ingredients from your backend
async function fetchIngredients(upc) {
    resultsDiv.innerHTML = `<h3>Ingredients:</h3><p>Loading ingredients for UPC: ${upc}...</p>`;
    try {
        // IMPORTANT: This URL MUST match the URL of your backend server.
        // When running locally, it's 'http://localhost:3000/api/ingredients/YOUR_UPC'
        const response = await fetch(`https://upc-scanner-project.onrender.com/api/ingredients/${upc}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.ingredients) {
            resultsDiv.innerHTML = `<h3>Ingredients for <span class="math-inline">\{upc\}\:</h3\><p\></span>{data.ingredients}</p>`;
        } else if (data.message) {
             resultsDiv.innerHTML = `<h3>Ingredients:</h3><p>${data.message}</p>`;
        } else {
             resultsDiv.innerHTML = `<h3>Ingredients:</h3><p>No ingredient data found for this UPC.</p>`;
        }

    } catch (error) {
        console.error('Error fetching ingredients:', error);
        resultsDiv.innerHTML = `<h3>Ingredients:</h3><p style="color: red;">Error fetching ingredients: ${error.message}. Please ensure the backend server is running and accessible.</p>`;
    }
}

// Event Listeners for buttons
startButton.addEventListener('click', startScanner);
stopButton.addEventListener('click', stopScanner);

// Initially hide the scanner container and show start button
stopScanner(); // This will set initial state correctly on page load