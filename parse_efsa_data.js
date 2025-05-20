// parse_efsa_data.js

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'OpenFoodToxTX22784_2022.xlsx'); // Make sure path is correct
const outputFilePath = path.join(__dirname, 'efsa_additive_details.json'); // Output JSON file

console.log(`Starting to parse EFSA data from: ${filePath}`);

try {
    // 1. Read the Excel workbook
    const workbook = XLSX.readFile(filePath);

    // 2. Get the first sheet's name (assuming data is on the first sheet)
    // *** IMPORTANT CHANGE: Specify the correct sheet name ***
    const sheetName = 'COM_SYNONYM'; // Make sure this is the exact tab name you found in Excel
    const worksheet = workbook.Sheets[sheetName];
    console.log(`Processing sheet: ${sheetName}`);

    // 3. Convert the worksheet to JSON.
    const data = XLSX.utils.sheet_to_json(worksheet);

    const efsaAdditiveDetails = {};

    // 4. Iterate over each row and extract relevant information
    data.forEach(row => {
        // *** IMPORTANT: Adjust these based on the ACTUAL column names in your Excel file ***
        // Assuming 'DESCRIPTION' column holds the name and possibly E-number
        const descriptionText = row['DESCRIPTION'] || ''; // Use the 'DESCRIPTION' column
        const typeText = row['TYPE'] || 'Unknown Type'; // Use the 'TYPE' column for function (if it exists and is useful)

        let eNumber = null;
        let commonName = descriptionText; // Default to description as name

        // Attempt to find E-number from the DESCRIPTION text
        const eNumberMatch = descriptionText.match(/(E\s*\d{3}[a-zA-Z]?)/i);
        if (eNumberMatch && eNumberMatch[1]) {
            eNumber = eNumberMatch[1].toUpperCase().replace(/\s/g, ''); // Clean to E100 format

            // If E-number is found, try to refine the common name
            commonName = descriptionText.replace(eNumberMatch[0], '').trim();
            if (commonName.endsWith('(')) {
                commonName = commonName.slice(0, -1).trim();
            }
            if (!commonName) {
                commonName = eNumber;
            }
        }

        // Only process if we successfully found an E-number
        if (eNumber) {
            // For 'risk_level' and 'explanation', we don't have direct columns for them in this sheet.
            // We'll provide a generic placeholder for now.
            const risk_level = 'Refer to EFSA scientific opinions';
            const explanation = `This substance is listed in the EFSA OpenFoodTox database. More detailed scientific assessments are available via specific EFSA opinions. Type: ${typeText}.`;

            efsaAdditiveDetails[eNumber] = {
                name: commonName,
                type: typeText,
                risk_level: risk_level,
                explanation: explanation
            };
        }
    });

    // 5. Write the extracted data to a JSON file
    fs.writeFileSync(outputFilePath, JSON.stringify(efsaAdditiveDetails, null, 2));
    console.log(`EFSA additive data successfully processed and saved to: ${outputFilePath}`);
    console.log(`Total additives processed: ${Object.keys(efsaAdditiveDetails).length}`);

} catch (error) {
    console.error('Error processing EFSA data:', error);
    console.error('Please ensure "OpenFoodToxTX22784_2022.xlsx" is in the same directory, the sheet name is correct, and check column names.');
}