'use strict';

const path = require('path');

let _cache = null;

function _load() {
    if (!_cache) {
        _cache = require(path.join(__dirname, 'data', 'hsn_codes.json'));
    }
    return _cache;
}

let _ratesCache = null;
function _loadRates() {
    if (!_ratesCache) {
        _ratesCache = require(path.join(__dirname, 'data', 'gst_rates.json'));
    }
    return _ratesCache;
}

function _assertString(value, name) {
    if (value === null || value === undefined) {
        throw new TypeError(`${name} must be a string, got ${value}`);
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new TypeError(`${name} must be a string or number, got ${typeof value}`);
    }
}

/**
 * Returns all HSN codes.
 * @returns {Array<{code: string, description: string}>}
 */
function getAllHsn() {
    return _load();
}

/**
 * Searches HSN codes by description (case-insensitive, partial match).
 * @param {string} txt
 * @returns {Array<{code: string, description: string}>}
 */
function getCodeByTxt(txt) {
    _assertString(txt, 'txt');
    const query = String(txt).toLowerCase().trim();
    if (!query) return [];
    return _load().filter(item => item.description.toLowerCase().includes(query));
}

/**
 * Searches HSN codes by code (partial match — use getHsnByExactCode for strict lookup).
 * @param {string|number} code
 * @returns {Array<{code: string, description: string}>}
 */
function getDesByCode(code) {
    _assertString(code, 'code');
    const query = String(code).trim();
    if (!query) return [];
    return _load().filter(item => item.code.includes(query));
}

/**
 * Returns the single HSN entry for an exact code, or undefined if not found.
 * @param {string|number} code
 * @returns {{code: string, description: string} | undefined}
 */
function getHsnByExactCode(code) {
    _assertString(code, 'code');
    const query = String(code).trim();
    return _load().find(item => item.code === query);
}

/**
 * Checks whether a given code exists in the HSN list.
 * @param {string|number} code
 * @returns {boolean}
 */
function isValidHsnCode(code) {
    if (code === null || code === undefined) return false;
    const query = String(code).trim();
    return _load().some(item => item.code === query);
}

/**
 * Returns all HSN codes belonging to a chapter (first two digits of code).
 * @param {string|number} chapter - e.g. '01', '10', 1
 * @returns {Array<{code: string, description: string}>}
 */
function getHsnChapter(chapter) {
    _assertString(chapter, 'chapter');
    const prefix = String(chapter).trim().padStart(2, '0');
    // Codes are stored without leading zeros (7-8 digits), so pad each code to 8 digits before matching
    return _load().filter(item => item.code.padStart(8, '0').startsWith(prefix));
}

/**
 * Advanced search with match type and pagination.
 * @param {string} query
 * @param {{ matchType?: 'contains'|'startsWith'|'exact', limit?: number, offset?: number }} options
 * @returns {Array<{code: string, description: string}>}
 */
function searchHsn(query, options) {
    _assertString(query, 'query');
    const q = String(query).trim().toLowerCase();
    if (!q) return [];

    const { matchType = 'contains', limit = 0, offset = 0 } = options || {};

    let results = _load().filter(item => {
        const desc = item.description.toLowerCase();
        if (matchType === 'exact') return desc === q;
        if (matchType === 'startsWith') return desc.startsWith(q);
        return desc.includes(q);
    });

    if (offset > 0) results = results.slice(offset);
    if (limit > 0) results = results.slice(0, limit);

    return results;
}

/**
 * Returns metadata about the bundled HSN dataset.
 * @returns {{ version: string, lastUpdated: string, totalCodes: number, chapterCount: number, source: string }}
 */
function getStats() {
    return require(path.join(__dirname, 'data', 'metadata.json'));
}

/**
 * Returns a summary of all HSN codes within a chapter (first two digits).
 * @param {string|number} chapter
 * @returns {{ chapter: string, totalCodes: number, codeRange: {from: string, to: string}, codes: Array } | null}
 */
function getChapterSummary(chapter) {
    _assertString(chapter, 'chapter');
    const prefix = String(chapter).trim().padStart(2, '0');
    const codes = _load().filter(item => item.code.padStart(8, '0').startsWith(prefix));
    if (codes.length === 0) return null;
    const sortedCodes = codes.map(c => c.code).sort();
    return {
        chapter: prefix,
        totalCodes: codes.length,
        codeRange: { from: sortedCodes[0], to: sortedCodes[sortedCodes.length - 1] },
        codes
    };
}

/**
 * Finds codes whose description contains ALL of the given keywords (AND match).
 * @param {string[]} keywords
 * @returns {Array<{code: string, description: string}>}
 */
function findCodesByDescription(keywords) {
    if (!Array.isArray(keywords)) throw new TypeError('keywords must be an array');
    if (keywords.length === 0) return [];
    const lower = keywords.map(k => String(k).toLowerCase().trim()).filter(Boolean);
    if (lower.length === 0) return [];
    return _load().filter(item => {
        const desc = item.description.toLowerCase();
        return lower.every(k => desc.includes(k));
    });
}

/**
 * Validates many HSN codes at once.
 * @param {Array<string|number>} codes
 * @returns {{ valid: string[], invalid: string[], summary: {total: number, validCount: number, invalidCount: number} }}
 */
function bulkValidateHsnCodes(codes) {
    if (!Array.isArray(codes)) throw new TypeError('codes must be an array');
    const valid = [];
    const invalid = [];
    for (const code of codes) {
        if (isValidHsnCode(code)) valid.push(String(code));
        else invalid.push(String(code));
    }
    return { valid, invalid, summary: { total: codes.length, validCount: valid.length, invalidCount: invalid.length } };
}

/**
 * Returns GST rate details for an exact HSN code, or null if not found.
 * @param {string|number} code
 * @returns {object|null}
 */
function getGstRateByCode(code) {
    _assertString(code, 'code');
    const q = String(code).trim();
    const rates = _loadRates();
    return rates.find(r => r.code === q) || null;
}

/**
 * Returns the HSN entry merged with its GST rate, or undefined if code not found.
 * @param {string|number} code
 * @returns {object|undefined}
 */
function getHsnByExactCodeWithRate(code) {
    _assertString(code, 'code');
    const entry = getHsnByExactCode(code);
    if (!entry) return undefined;
    const rate = getGstRateByCode(code);
    return rate ? { ...entry, ...rate } : entry;
}

/**
 * Returns all HSN codes that fall under a given IGST rate slab (e.g. 5, 18).
 * @param {number} igstRate
 * @returns {Array<{code: string, description: string}>}
 */
function getHsnByRateSlabs(igstRate) {
    if (typeof igstRate !== 'number') throw new TypeError('igstRate must be a number');
    const rates = _loadRates();
    const matchingCodes = new Set(rates.filter(r => r.igstRate === igstRate).map(r => r.code));
    return _load().filter(item => matchingCodes.has(item.code));
}

const gstin = require('./gstin');
const sac = require('./sac');
const exportUtils = require('./export');

module.exports = {
    getAllHsn,
    getCodeByTxt,
    getDesByCode,
    getHsnByExactCode,
    isValidHsnCode,
    getHsnChapter,
    searchHsn,
    getStats,
    // Advanced HSN lookups
    getChapterSummary,
    findCodesByDescription,
    bulkValidateHsnCodes,
    // GST rates
    getGstRateByCode,
    getHsnByExactCodeWithRate,
    getHsnByRateSlabs,
    // GSTIN
    validateGSTIN: gstin.validateGSTIN,
    formatGSTIN: gstin.formatGSTIN,
    getStateFromGSTIN: gstin.getStateFromGSTIN,
    isValidPAN: gstin.isValidPAN,
    getGSTINComponents: gstin.getGSTINComponents,
    // SAC
    getAllSac: sac.getAllSac,
    getSacByCode: sac.getSacByCode,
    searchSac: sac.searchSac,
    getCodeDetails: sac.getCodeDetails,
    // Export
    exportToCSV: exportUtils.exportToCSV,
    exportToJSON: exportUtils.exportToJSON,
    generateGSTR1Summary: exportUtils.generateGSTR1Summary
};
