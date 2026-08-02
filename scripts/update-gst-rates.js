'use strict';

/**
 * GST rate data pipeline.
 *
 * Downloads and validates an explicitly configured authoritative workbook,
 * then atomically updates the committed rate data only when content changes.
 * Scheduled failures never regenerate data from the static chapter map.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HSN_FILE = path.join(DATA_DIR, 'hsn_codes.json');
const RATES_FILE = path.join(DATA_DIR, 'gst_rates.json');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

const EFFECTIVE_FROM = '2025-09-22';
const NOTIFICATION_REF = 'Notification No. 09/2025-CT(Rate)';
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MIN_RATE_ROWS = 100;
const MIN_OVERLAP_RATIO = 0.8;
const DOWNLOAD_TIMEOUT_MS = 15000;
const ALLOWED_CONTENT_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'application/zip'
]);

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
 * Downloads an Excel workbook, following at most three same-host redirects.
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
function downloadExcel(url, options) {
    const { get = https.get, timeoutMs = DOWNLOAD_TIMEOUT_MS, maxBytes = MAX_RESPONSE_BYTES } = options || {};
    const originalUrl = new URL(url);
    if (originalUrl.protocol !== 'https:') {
        return Promise.reject(new Error('GST_RATE_SOURCE_URL must use HTTPS'));
    }

    function request(currentUrl, redirectCount) {
        return new Promise((resolve, reject) => {
            const req = get(currentUrl, { timeout: timeoutMs }, (res) => {
                const statusCode = res.statusCode || 0;
                if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
                    res.resume();
                    if (redirectCount >= MAX_REDIRECTS) {
                        reject(new Error(`Too many redirects (maximum ${MAX_REDIRECTS})`));
                        return;
                    }
                    const nextUrl = new URL(res.headers.location, currentUrl);
                    if (nextUrl.host !== originalUrl.host) {
                        reject(new Error(`Cross-host redirect rejected: ${nextUrl.host}`));
                        return;
                    }
                    request(nextUrl, redirectCount + 1).then(resolve, reject);
                    return;
                }
                if (statusCode !== 200) {
                    res.resume();
                    reject(new Error(`Unexpected status code ${statusCode}`));
                    return;
                }

                const contentLength = Number(res.headers['content-length']);
                if (Number.isFinite(contentLength) && contentLength > maxBytes) {
                    res.resume();
                    reject(new Error(`Workbook exceeds ${maxBytes} byte limit`));
                    return;
                }

                const chunks = [];
                let size = 0;
                res.on('data', (chunk) => {
                    size += chunk.length;
                    if (size > maxBytes) {
                        req.destroy(new Error(`Workbook exceeds ${maxBytes} byte limit`));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on('end', () => resolve({
                    buffer: Buffer.concat(chunks),
                    contentType: String(res.headers['content-type'] || '')
                }));
            });
            req.on('timeout', () => req.destroy(new Error('Request timed out')));
            req.on('error', reject);
        });
    }

    return request(originalUrl, 0);
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
    if (!sheet) throw new Error('Workbook does not contain a worksheet');
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const map = new Map();
    const codeHeaders = ['HSN', 'hsn', 'Code', 'code', 'HSN Code'];
    const rateHeaders = ['Rate', 'rate', 'IGST', 'igst', 'GST Rate'];
    for (const [index, row] of rows.entries()) {
        const codeRaw = codeHeaders.map(key => row[key]).find(value => value !== undefined && value !== null && value !== '');
        const rateRaw = rateHeaders.map(key => row[key]).find(value => value !== undefined && value !== null && value !== '');
        if (codeRaw === undefined) throw new Error(`Row ${index + 2} is missing an HSN code`);
        if (rateRaw === undefined) throw new Error(`Row ${index + 2} is missing a GST rate`);
        const code = String(codeRaw).replace(/\D/g, '');
        const rate = Number(String(rateRaw).replace('%', '').trim());
        if (!code) throw new Error(`Row ${index + 2} has an invalid HSN code`);
        if (!Number.isFinite(rate) || rate < 0) {
            throw new Error(`Row ${index + 2} has an invalid GST rate`);
        }
        const normalizedCode = code.padStart(8, '0');
        if (map.has(normalizedCode)) {
            throw new Error(`Duplicate normalized HSN code ${normalizedCode}`);
        }
        map.set(normalizedCode, rate);
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

function validateWorkbookDownload(downloaded, maxBytes) {
    if (!downloaded || !Buffer.isBuffer(downloaded.buffer)) {
        throw new Error('Downloader did not return a workbook buffer');
    }
    if (downloaded.buffer.length > maxBytes) {
        throw new Error(`Workbook exceeds ${maxBytes} byte limit`);
    }
    const contentType = String(downloaded.contentType || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        throw new Error(`Unexpected workbook content type: ${contentType || 'missing'}`);
    }
    const buffer = downloaded.buffer;
    const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    const cfbSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const isCfb = buffer.length >= cfbSignature.length
        && cfbSignature.every((byte, index) => buffer[index] === byte);
    if (!isZip && !isCfb) throw new Error('Workbook file signature is invalid');
}

function buildRates(hsnCodes, excelMap) {
    const rates = [];
    for (const item of hsnCodes) {
        const padded = String(item.code).padStart(8, '0');
        let igstRate = excelMap.get(padded);
        if (igstRate === undefined) igstRate = resolveRate(padded);
        if (igstRate === undefined || igstRate === null) continue;
        rates.push(buildEntry(item.code, igstRate, excelMap.has(padded) ? 'cbic-excel' : 'chapter-level'));
    }
    return rates;
}

function stagedWriteFiles(files) {
    const stamp = `${process.pid}.${Date.now()}`;
    const staged = files.map(({ targetPath, content }, index) => ({
        targetPath,
        content,
        tempPath: `${targetPath}.${stamp}.${index}.tmp`
    }));
    try {
        for (const file of staged) fs.writeFileSync(file.tempPath, file.content);
        for (const file of staged) fs.renameSync(file.tempPath, file.targetPath);
    } finally {
        for (const file of staged) {
            if (fs.existsSync(file.tempPath)) fs.unlinkSync(file.tempPath);
        }
    }
}

function summarizeRateSource(rates) {
    const authoritativeCount = rates.filter(rate => rate.rateSource === 'cbic-excel').length;
    const fallbackCount = rates.length - authoritativeCount;
    if (authoritativeCount === 0) return 'chapter-level';
    if (fallbackCount === 0) return 'authoritative-excel';
    return 'mixed';
}

async function refreshRates(options) {
    const {
        sourceUrl = process.env.GST_RATE_SOURCE_URL,
        download = downloadExcel,
        now = () => new Date(),
        hsnFile = HSN_FILE,
        ratesFile = RATES_FILE,
        metadataFile = METADATA_FILE,
        minimumRows = MIN_RATE_ROWS,
        minimumOverlapRatio = MIN_OVERLAP_RATIO,
        maxBytes = MAX_RESPONSE_BYTES,
        write = false,
        writeBatch = stagedWriteFiles
    } = options || {};

    if (!sourceUrl) {
        throw new Error('GST_RATE_SOURCE_URL is required; configure an authoritative machine-readable Excel URL');
    }

    const downloaded = await download(sourceUrl);
    validateWorkbookDownload(downloaded, maxBytes);
    const excelMap = parseExcel(downloaded.buffer);
    if (excelMap.size === 0) throw new Error('Authoritative workbook contains no rate rows');
    if (excelMap.size < minimumRows) {
        throw new Error(`Authoritative workbook contains only ${excelMap.size} rate rows; minimum is ${minimumRows}`);
    }

    const hsnCodes = JSON.parse(fs.readFileSync(hsnFile, 'utf8'));
    const knownCodes = new Set(hsnCodes.map(item => String(item.code).padStart(8, '0')));
    const overlap = [...excelMap.keys()].filter(code => knownCodes.has(code)).length;
    if (overlap === 0) throw new Error('Authoritative workbook has zero overlap with bundled HSN codes');
    const overlapRatio = overlap / excelMap.size;
    if (overlapRatio < minimumOverlapRatio) {
        throw new Error(
            `Authoritative workbook overlap is ${(overlapRatio * 100).toFixed(1)}%; minimum is ${(minimumOverlapRatio * 100).toFixed(1)}%`
        );
    }

    const rates = buildRates(hsnCodes, excelMap);
    const rateSource = summarizeRateSource(rates);
    const proposedRates = JSON.stringify(rates);
    const currentRates = JSON.stringify(JSON.parse(fs.readFileSync(ratesFile, 'utf8')));
    if (proposedRates === currentRates) {
        return { changed: false, rateRows: excelMap.size, overlap, rateSource };
    }

    if (!write) {
        return { changed: true, rateRows: excelMap.size, overlap, rateSource };
    }

    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    metadata.gstRatesLastUpdated = now().toISOString().split('T')[0];
    metadata.gstRateSource = rateSource;
    const proposedMetadata = JSON.stringify(metadata, null, 2) + '\n';

    writeBatch([
        { targetPath: ratesFile, content: proposedRates },
        { targetPath: metadataFile, content: proposedMetadata }
    ]);
    return { changed: true, rateRows: excelMap.size, overlap, rateSource };
}

async function main(options) {
    const result = await refreshRates(options);
    if (result.changed && options && options.write) {
        console.log(`Updated GST rates from ${result.rateRows} authoritative rows (${result.overlap} matched codes).`);
    } else if (result.changed) {
        console.log(`Validated ${result.rateRows} authoritative rows; material changes require review.`);
    } else {
        console.log('Authoritative GST rate content is unchanged; no files written.');
    }
    return result;
}

if (require.main === module) {
    const write = process.argv.slice(2).includes('--write');
    const unknownArgs = process.argv.slice(2).filter(arg => arg !== '--check' && arg !== '--write');
    if (unknownArgs.length > 0 || (write && process.argv.slice(2).includes('--check'))) {
        console.error('Usage: node scripts/update-gst-rates.js [--check | --write]');
        process.exitCode = 1;
    } else {
        main({ write }).then((result) => {
            console.log(`GST_RATE_CHANGED=${result.changed}`);
        }).catch((err) => {
            console.error('Fatal error:', err);
            process.exitCode = 1;
        });
    }
}

module.exports = { downloadExcel, parseExcel, refreshRates, stagedWriteFiles, main };
