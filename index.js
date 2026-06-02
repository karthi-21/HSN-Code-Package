'use strict';

const path = require('path');

let _cache = null;

function _load() {
    if (!_cache) {
        _cache = require(path.join(__dirname, 'data', 'hsn_codes.json'));
    }
    return _cache;
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

const gst = require('./gst');

module.exports = {
    getAllHsn,
    getCodeByTxt,
    getDesByCode,
    getHsnByExactCode,
    isValidHsnCode,
    getHsnChapter,
    searchHsn,
    getStats,
    // GST calculation utilities (issue #3)
    applyRoundOffRules: gst.applyRoundOffRules,
    calculateTax: gst.calculateTax,
    calculateGSTBreakdown: gst.calculateGSTBreakdown,
    reverseCalculateTax: gst.reverseCalculateTax,
    getApplicableTaxType: gst.getApplicableTaxType,
    calculateInvoiceTotals: gst.calculateInvoiceTotals,
    groupItemsByTaxRate: gst.groupItemsByTaxRate
};
