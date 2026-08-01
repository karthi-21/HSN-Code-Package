'use strict';

/**
 * GST rate data pipeline.
 *
 * 1. Attempts to download the CBIC GST rate Excel from the GST portal.
 * 2. Parses it with the `xlsx` library.
 * 3. Transforms the data into data/gst_rates.json.
 * 4. Updates data/metadata.json with a gstRatesLastUpdated field.
 *
 * If the download fails (the CBIC portal usually requires browser interaction),
 * the script falls back to chapter-level rate mappings hardcoded from CBIC
 * Notification No. 09/2025-CT(Rate) (effective 22 Sep 2025).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HSN_FILE = path.join(DATA_DIR, 'hsn_codes.json');
const RATES_FILE = path.join(DATA_DIR, 'gst_rates.json');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

const CBIC_URL = 'https://services.gst.gov.in/services/searchhsnsac';
const EFFECTIVE_FROM = '2025-09-22';
const NOTIFICATION_REF = 'Notification No. 09/2025-CT(Rate)';

/**
 * Chapter-level IGST rate map from CBIC Notification 09/2025-CT(Rate).
 * Where a chapter has multiple sub-rates, the most representative / common
 * rate is used as the chapter default.
 */
const CHAPTER_RATE_MAP = {
    '01': 0, '02': 0, '03': 5, '04': 0, '05': 0, '06': 5, '07': 0, '08': 0,
    '09': 5, '10': 0, '11': 0, '12': 5, '13': 18, '14': 5, '15': 5, '16': 12,
    '17': 5, '18': 18, '19': 18, '20': 12, '21': 18, '22': 18, '23': 5, '24': 28,
    '25': 5, '26': 5, '27': 5, '28': 18, '29': 18, '30': 12, '31': 5, '32': 18,
    '33': 18, '34': 18, '35': 18, '36': 18, '37': 18, '38': 18, '39': 18, '40': 18,
    '41': 5, '42': 18, '43': 5, '44': 12, '45': 12, '46': 12, '47': 12, '48': 12,
    '49': 0, '50': 5, '51': 5, '52': 5, '53': 5, '54': 5, '55': 5, '56': 12,
    '57': 12, '58': 12, '59': 12, '60': 5, '61': 5, '62': 5, '63': 5, '64': 18,
    '65': 18, '66': 18, '67': 12, '68': 18, '69': 18, '70': 18, '71': 3, '72': 18,
    '73': 18, '74': 18, '75': 18, '76': 18, '78': 18, '79': 18, '80': 18, '81': 18,
    '82': 18, '83': 18, '84': 18, '85': 18, '86': 12, '87': 28, '88': 18, '89': 5,
    '90': 18, '91': 18, '92': 18, '93': 18, '94': 18, '95': 18, '96': 18, '97': 12,
    '98': 18, '99': 18
};

/**
 * Resolves the IGST rate for a single 8-digit (padded) HSN code, applying
 * chapter-71 special cases.
 * @param {string} paddedCode 8-digit code
 * @returns {number|undefined}
 */
function resolveRate(paddedCode) {
    const chapter = paddedCode.slice(0, 2);

    // Chapter 71 special cases.
    if (chapter === '71') {
        const heading = paddedCode.slice(0, 4);
        // Precious metals / gems (7101-7114) and imitation jewellery (7117) -> 3%
        const headingNum = parseInt(heading, 10);
        if (headingNum >= 7101 && headingNum <= 7114) return 3;
        if (heading === '7117') return 3;
        return 3;
    }

    return CHAPTER_RATE_MAP[chapter];
}

/**
 * Attempts to download the CBIC Excel. Rejects on any failure.
 * @returns {Promise<Buffer>}
 */
function downloadExcel(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 15000 }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`Unexpected status code ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('timeout', () => req.destroy(new Error('Request timed out')));
        req.on('error', reject);
    });
}

/**
 * Parses a CBIC Excel buffer into a code -> igstRate map.
 * @param {Buffer} buffer
 * @returns {Map<string, number>}
 */
function parseExcel(buffer) {
    // eslint-disable-next-line global-require
    const xlsx = require('xlsx');
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const map = new Map();
    for (const row of rows) {
        const codeRaw = row.HSN || row.hsn || row.Code || row.code || row['HSN Code'];
        const rateRaw = row.Rate || row.rate || row.IGST || row.igst || row['GST Rate'];
        if (codeRaw === undefined || codeRaw === '') continue;
        const code = String(codeRaw).replace(/\D/g, '');
        const rate = parseFloat(String(rateRaw).replace('%', ''));
        if (!code || Number.isNaN(rate)) continue;
        map.set(code.padStart(8, '0'), rate);
    }
    return map;
}

function buildEntry(code, igstRate, rateSource) {
    return {
        code,
        igstRate,
        cgstRate: igstRate / 2,
        sgstRate: igstRate / 2,
        cessRate: 0,
        rateSource,
        effectiveFrom: EFFECTIVE_FROM,
        notificationRef: NOTIFICATION_REF
    };
}

async function main() {
    const hsnCodes = require(HSN_FILE);
    let excelMap = null;
    let rateSource = 'chapter-level';

    try {
        console.log(`Attempting to download CBIC GST rate data from ${CBIC_URL} ...`);
        const buffer = await downloadExcel(CBIC_URL);
        excelMap = parseExcel(buffer);
        if (excelMap.size > 0) {
            rateSource = 'cbic-excel';
            console.log(`Parsed ${excelMap.size} rate rows from CBIC Excel.`);
        } else {
            console.log('CBIC Excel parsed but contained no usable rows; using fallback.');
            excelMap = null;
        }
    } catch (err) {
        console.log(`Download/parse failed (${err.message}); using chapter-level fallback.`);
        excelMap = null;
    }

    const rates = [];
    for (const item of hsnCodes) {
        const padded = String(item.code).padStart(8, '0');
        let igstRate;
        if (excelMap) {
            igstRate = excelMap.get(padded);
            if (igstRate === undefined) igstRate = resolveRate(padded);
        } else {
            igstRate = resolveRate(padded);
        }
        if (igstRate === undefined || igstRate === null) continue;
        rates.push(buildEntry(item.code, igstRate, excelMap && excelMap.has(padded) ? 'cbic-excel' : rateSource));
    }

    fs.writeFileSync(RATES_FILE, JSON.stringify(rates));
    console.log(`Wrote ${rates.length} rate entries to ${RATES_FILE}.`);

    const metadata = require(METADATA_FILE);
    const today = new Date().toISOString().split('T')[0];
    metadata.gstRatesLastUpdated = today;
    metadata.gstNotificationRef = 'Notification No. 09/2025-CT(Rate) dated 17 Sep 2025';
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2) + '\n');
    console.log(`Updated metadata gstRatesLastUpdated -> ${today}.`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { parseExcel };
