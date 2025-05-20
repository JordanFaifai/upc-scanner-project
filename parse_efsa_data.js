// parse_efsa_data.js - Updated to link from COMPONENT/SUBSTANCE sheet to CHEM_ASSESS via TRX_ID

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'OpenFoodToxTX22784_2022.xlsx');
const outputFilePath = path.join(__dirname, 'efsa_additive_details.json');

console.log(`Starting to parse EFSA data from: ${filePath}`);

try {
    const workbook = XLSX.readFile(filePath);

    // --- Step 1: Process the CHEM_ASSESS sheet first to build a lookup table ---
    const chemAssessSheetName = 'CHEM_ASSESS'; // Confirmed correct sheet name
    const chemAssessWorksheet = workbook.Sheets[chemAssessSheetName];
    const chemAssessData = XLSX.utils.sheet_to_json(chemAssessWorksheet);

    const assessmentLookupByTrxId = {};
    const assessmentLookupByRemarks = {}; // Keep this for potential fallback or more info
    console.log(`Processing sheet: ${chemAssessSheetName}`);

    chemAssessData.forEach(row => {
        const linkingId = row['TRX_ID']; // Using TRX_ID from CHEM_ASSESS
        const remarks = (row['REMARKS'] || '').toString().toLowerCase();
        const assessmentDetail = (row['ASSESSME'] || row['ASSESSME.1'] || row['ASSESSME.2'] || row['ASSESSME.3'] || '').toString();
        const riskQualitative = (row['RISKQUALI'] || '').toString();
        const population = (row['POPULATI'] || '').toString();

        let detailedExplanation = '';
        if (assessmentDetail) detailedExplanation += `Assessment: ${assessmentDetail}. `;
        if (remarks) detailedExplanation += `Remarks: ${remarks}. `;
        if (population) detailedExplanation += `Population: ${population}. `;

        let interpretedRiskLevel = 'Unspecified';
        if (riskQualitative) {
            if (riskQualitative.toLowerCase().includes('low concern') || riskQualitative.startsWith('3 QU03A')) {
                interpretedRiskLevel = 'Low Concern';
            } else if (riskQualitative.toLowerCase().includes('moderate') || riskQualitative.startsWith('6 QU06A')) {
                interpretedRiskLevel = 'Moderate Concern';
            } else if (riskQualitative.toLowerCase().includes('high concern')) {
                interpretedRiskLevel = 'High Concern';
            } else {
                interpretedRiskLevel = riskQualitative; // Use raw value if not specifically mapped
            }
        }

        const assessmentInfo = {
            risk_level: interpretedRiskLevel,
            explanation: detailedExplanation || 'No specific assessment details found in CHEM_ASSESS.'
        };

        if (linkingId) {
            assessmentLookupByTrxId[linkingId] = assessmentInfo;
        }

        // Specific handling for Riboflavin as it was explicitly mentioned
        if (remarks.includes('riboflavin')) {
            assessmentLookupByRemarks['riboflavin'] = assessmentInfo;
            assessmentLookupByRemarks['e101'] = assessmentInfo; // Also map E-number to this
            assessmentLookupByRemarks['e101a'] = assessmentInfo;
        }
        // Add more specific name-based lookups here if you identify others
    });
    console.log(`Finished processing ${Object.keys(assessmentLookupByTrxId).length} assessment entries from ${chemAssessSheetName} by TRX_ID.`);
    console.log(`Finished processing ${Object.keys(assessmentLookupByRemarks).length} assessment entries from ${chemAssessSheetName} by remarks (keywords).`);


    // --- Step 2: Process the COMPONENT/SUBSTANCE-defining sheet and link to assessments ---
    // IMPORTANT: Replace 'COMPONENT' with the actual name of the sheet that has these headers.
    // Based on the headers you provided, 'COMPONENT' or 'SUBSTANCE' is most likely.
    const componentSheetName = 'COMPONENT'; // <--- ASSUMPTION: You must verify this sheet name in your Excel file!
    const componentWorksheet = workbook.Sheets[componentSheetName];
    // If the sheet doesn't exist or is empty, this will throw an error, which is intended.
    if (!componentWorksheet) {
        throw new Error(`Sheet "${componentSheetName}" not found in the workbook. Please verify the sheet name containing the substance/component data.`);
    }
    const componentData = XLSX.utils.sheet_to_json(componentWorksheet);

    const efsaAdditiveDetails = {};
    console.log(`Processing sheet: ${componentSheetName}`);

    componentData.forEach(row => {
        const trxId = row['TRX_ID']; // Use TRX_ID from this sheet for linking
        const subName = (row['SUB_NAME'] || '').toString().trim();
        const comName = (row['COM_NAME'] || '').toString().trim();
        const subDescription = (row['SUB_DESCRIPTION'] || '').toString().trim(); // This might contain E-numbers
        const comType = (row['COM_TYPE'] || '').toString().trim();
        const subType = (row['SUB_TYPE'] || '').toString().trim();

        let eNumber = null;
        let commonName = '';
        let functionalType = '';

        // Prioritize SUB_DESCRIPTION for E-number extraction first
        const eNumberPattern = /(E\s*\d{3}[a-zA-Z]?)/i;
        let eNumberMatch = subDescription.match(eNumberPattern);

        if (eNumberMatch && eNumberMatch[1]) {
            eNumber = eNumberMatch[1].toUpperCase().replace(/\s/g, '');
            // Try to extract name after E-number from description
            commonName = subDescription.replace(eNumberMatch[0], '').replace(/^\(\w+\)\s*-\s*/, '').trim();
            if (!commonName && subName) commonName = subName; // Fallback to SUB_NAME
            if (!commonName && comName) commonName = comName; // Fallback to COM_NAME
        } else {
            // If E-number not in SUB_DESCRIPTION, try SUB_NAME or COM_NAME if they look like E-numbers
            if (subName.match(eNumberPattern)) {
                eNumber = subName.match(eNumberPattern)[1].toUpperCase().replace(/\s/g, '');
                commonName = subName.replace(eNumberPattern, '').trim();
            } else if (comName.match(eNumberPattern)) {
                eNumber = comName.match(eNumberPattern)[1].toUpperCase().replace(/\s/g, '');
                commonName = comName.replace(eNumberPattern, '').trim();
            }
        }

        // If an E-number is found, proceed
        if (eNumber) {
            // Further refine common name
            if (!commonName) {
                // If no name extracted, try from SUB_NAME or COM_NAME directly if they're not E-numbers
                if (subName && !subName.match(eNumberPattern)) commonName = subName;
                else if (comName && !comName.match(eNumberPattern)) commonName = comName;
                else commonName = eNumber; // Fallback to E-number if no good name found
            }

            // Clean up common unwanted suffixes/prefixes/standalone characters from commonName
            commonName = commonName.replace(/^\(\w+\)$/, '').trim(); // Remove things like "(i)"
            commonName = commonName.replace(/^-/, '').trim(); // Remove leading hyphens
            commonName = commonName.replace(/\s*-\s*$/, '').trim(); // Remove trailing isolated hyphen
            commonName = commonName.replace(/^[ivx]+\s*/i, '').trim(); // Remove Roman numerals like "i", "ii" if standalone
            if (commonName.length <= 1) commonName = eNumber; // If name is still just a single character or empty

            // Determine functional type
            functionalType = subType || comType || 'Unknown Type';
            if (functionalType.toLowerCase().includes('e number')) functionalType = 'Food Additive'; // Generalize

            // --- Link to Assessment Data ---
            let finalAssessment = {
                risk_level: 'Unspecified',
                explanation: 'No specific EFSA assessment details found for this E-number.'
            };

            // 1. Try to link directly by TRX_ID from the component sheet to CHEM_ASSESS
            if (trxId && assessmentLookupByTrxId[trxId]) {
                finalAssessment = assessmentLookupByTrxId[trxId];
            } else {
                // 2. If TRX_ID link fails, try fuzzy matching by E-number/name with CHEM_ASSESS remarks (fallback)
                const lowerCaseENumber = eNumber.toLowerCase();
                const lowerCaseCommonName = commonName.toLowerCase();

                if (assessmentLookupByRemarks[lowerCaseENumber]) {
                    finalAssessment = assessmentLookupByRemarks[lowerCaseENumber];
                } else if (lowerCaseCommonName && assessmentLookupByRemarks[lowerCaseCommonName]) {
                    finalAssessment = assessmentLookupByRemarks[lowerCaseCommonName];
                }
            }

            // Store the additive details
            // Prioritize richer data if already existing or if the new one is more complete
            if (!efsaAdditiveDetails[eNumber]) {
                efsaAdditiveDetails[eNumber] = {
                    name: commonName,
                    type: functionalType,
                    risk_level: finalAssessment.risk_level,
                    explanation: finalAssessment.explanation
                };
            } else {
                const existingEntry = efsaAdditiveDetails[eNumber];
                // Update explanation if new one is more specific
                if (finalAssessment.explanation !== 'No specific EFSA assessment details found for this E-number.' &&
                    (existingEntry.explanation === 'No specific EFSA assessment details found for this E-number.' ||
                     finalAssessment.explanation.length > existingEntry.explanation.length)) {
                    existingEntry.risk_level = finalAssessment.risk_level;
                    existingEntry.explanation = finalAssessment.explanation;
                }
                // Update name if current name is generic (like just E-number) and new one is better
                if (existingEntry.name === eNumber && commonName !== eNumber && commonName.length > 1) {
                    existingEntry.name = commonName;
                }
                // Update type if current type is generic and new one is better
                if (existingEntry.type === 'Unknown Type' && functionalType !== 'Unknown Type') {
                    existingEntry.type = functionalType;
                }
            }
        }
    });

    fs.writeFileSync(outputFilePath, JSON.stringify(efsaAdditiveDetails, null, 2));
    console.log(`EFSA additive data successfully processed and saved to: ${outputFilePath}`);
    console.log(`Total unique additives processed with (attempted) assessment details: ${Object.keys(efsaAdditiveDetails).length}`);

} catch (error) {
    console.error('Error processing EFSA data:', error);
    console.error('Please ensure "OpenFoodToxTX22784_2022.xlsx" is in the same directory, and verify exact sheet and column names for CHEM_ASSESS and the substance-defining sheet (e.g., COMPONENT).');
}