'use strict';

const path = require('path');

let _cache = null;

function _load() {
    if (!_cache) {
        _cache = require(path.join(__dirname, 'data', 'sac_codes.json'));
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
 * Returns all SAC code entries.
 * @returns {Array<{code: string, description: string}>}
 */
function getAllSac() {
    return _load();
}

/**
 * Returns the single SAC entry for an exact code, or undefined.
 * @param {string|number} code
 * @returns {{code: string, description: string} | undefined}
 */
function getSacByCode(code) {
    _assertString(code, 'code');
    const query = String(code).trim();
    return _load().find(item => item.code === query);
}

/**
 * Advanced SAC search with match type and pagination.
 * @param {string} query
 * @param {{ matchType?: 'contains'|'startsWith'|'exact', limit?: number, offset?: number }} [options]
 * @returns {Array<{code: string, description: string}>}
 */
function searchSac(query, options) {
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
 * Looks up a code in both the HSN and SAC datasets.
 * @param {string|number} code
 * @returns {{code: string, description: string, type: 'HSN'|'SAC'} | undefined}
 */
function getCodeDetails(code) {
    _assertString(code, 'code');
    const query = String(code).trim();

    // Load HSN data directly to avoid a circular dependency on ./index.
    const hsnData = require(path.join(__dirname, 'data', 'hsn_codes.json'));
    const hsn = hsnData.find(item => item.code === query);
    if (hsn) return Object.assign({}, hsn, { type: 'HSN' });

    const sac = _load().find(item => item.code === query);
    if (sac) return Object.assign({}, sac, { type: 'SAC' });

    return undefined;
}

module.exports = {
    getAllSac,
    getSacByCode,
    searchSac,
    getCodeDetails
};
