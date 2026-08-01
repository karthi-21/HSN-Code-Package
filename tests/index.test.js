'use strict';

const {
    getAllHsn,
    getCodeByTxt,
    getDesByCode,
    getHsnByExactCode,
    isValidHsnCode,
    getHsnChapter,
    searchHsn,
    getStats
} = require('../index');

// ── getAllHsn ──────────────────────────────────────────────────────────────

describe('getAllHsn', () => {
    test('returns an array', () => {
        expect(Array.isArray(getAllHsn())).toBe(true);
    });

    test('contains more than 10000 entries', () => {
        expect(getAllHsn().length).toBeGreaterThan(10000);
    });

    test('each entry has code and description strings', () => {
        const first = getAllHsn()[0];
        expect(typeof first.code).toBe('string');
        expect(typeof first.description).toBe('string');
    });

    test('returns the same array reference on repeated calls (cached)', () => {
        expect(getAllHsn()).toBe(getAllHsn());
    });

    test('freezes the canonical array and its records without changing state', () => {
        const all = getAllHsn();
        const first = all[0];
        const original = { ...first };
        expect(Object.isFrozen(all)).toBe(true);
        expect(Object.isFrozen(first)).toBe(true);
        expect(() => all.push({ code: 'x', description: 'x' })).toThrow(TypeError);
        expect(() => { all[0] = { code: 'x', description: 'x' }; }).toThrow(TypeError);
        expect(() => { first.description = 'changed'; }).toThrow(TypeError);
        expect(getAllHsn()[0]).toEqual(original);
    });
});

// ── getCodeByTxt ───────────────────────────────────────────────────────────

describe('getCodeByTxt', () => {
    test('finds codes by partial description', () => {
        const results = getCodeByTxt('horse');
        expect(results.length).toBeGreaterThan(0);
        results.forEach(r => expect(r.description.toLowerCase()).toContain('horse'));
    });

    test('is case-insensitive', () => {
        expect(getCodeByTxt('HORSE').length).toBe(getCodeByTxt('horse').length);
    });

    test('returns empty array when no match', () => {
        expect(getCodeByTxt('zzznomatch999')).toEqual([]);
    });

    test('returns empty array for empty string', () => {
        expect(getCodeByTxt('')).toEqual([]);
    });

    test('throws TypeError for null', () => {
        expect(() => getCodeByTxt(null)).toThrow(TypeError);
    });

    test('throws TypeError for undefined', () => {
        expect(() => getCodeByTxt(undefined)).toThrow(TypeError);
    });
});

// ── getDesByCode ───────────────────────────────────────────────────────────

describe('getDesByCode', () => {
    test('returns entries whose code contains the search string', () => {
        const results = getDesByCode('0101');
        expect(results.length).toBeGreaterThan(0);
        results.forEach(r => expect(r.code).toContain('0101'));
    });

    test('accepts numeric input', () => {
        const results = getDesByCode(101);
        expect(Array.isArray(results)).toBe(true);
    });

    test('returns empty array for empty string', () => {
        expect(getDesByCode('')).toEqual([]);
    });

    test('throws TypeError for null', () => {
        expect(() => getDesByCode(null)).toThrow(TypeError);
    });
});

// ── getHsnByExactCode ──────────────────────────────────────────────────────

describe('getHsnByExactCode', () => {
    test('returns the correct entry for a known code', () => {
        const allCodes = getAllHsn();
        const known = allCodes[0];
        const result = getHsnByExactCode(known.code);
        expect(result).toEqual(known);
    });

    test('returns undefined for an unknown code', () => {
        expect(getHsnByExactCode('0000000000')).toBeUndefined();
    });

    test('throws TypeError for null', () => {
        expect(() => getHsnByExactCode(null)).toThrow(TypeError);
    });
});

// ── isValidHsnCode ─────────────────────────────────────────────────────────

describe('isValidHsnCode', () => {
    test('returns true for a valid code', () => {
        const code = getAllHsn()[0].code;
        expect(isValidHsnCode(code)).toBe(true);
    });

    test('returns false for an invalid code', () => {
        expect(isValidHsnCode('0000000000')).toBe(false);
    });

    test('returns false for null without throwing', () => {
        expect(isValidHsnCode(null)).toBe(false);
    });

    test('returns false for undefined without throwing', () => {
        expect(isValidHsnCode(undefined)).toBe(false);
    });
});

// ── getHsnChapter ──────────────────────────────────────────────────────────

describe('getHsnChapter', () => {
    test('returns entries for chapter 01 (live animals)', () => {
        const results = getHsnChapter('01');
        expect(results.length).toBeGreaterThan(0);
        // Codes are stored without leading zeros, so padded code must start with '01'
        results.forEach(r => expect(r.code.padStart(8, '0').startsWith('01')).toBe(true));
    });

    test('accepts numeric chapter input', () => {
        const results = getHsnChapter(1);
        expect(results.length).toBeGreaterThan(0);
    });

    test('pads single digit chapter (1 → 01)', () => {
        expect(getHsnChapter('1').length).toBe(getHsnChapter('01').length);
    });

    test('returns empty array for unknown chapter', () => {
        expect(getHsnChapter('99')).toEqual([]);
    });

    test('throws TypeError for null', () => {
        expect(() => getHsnChapter(null)).toThrow(TypeError);
    });
});

// ── searchHsn ─────────────────────────────────────────────────────────────

describe('searchHsn', () => {
    test('default contains search', () => {
        const results = searchHsn('cotton');
        expect(results.length).toBeGreaterThan(0);
    });

    test('limit option reduces result count', () => {
        const all = searchHsn('cotton');
        const limited = searchHsn('cotton', { limit: 3 });
        expect(limited.length).toBe(Math.min(3, all.length));
    });

    test('offset option skips results', () => {
        const all = searchHsn('cotton');
        const offset = searchHsn('cotton', { offset: 1 });
        if (all.length > 1) {
            expect(offset[0]).toEqual(all[1]);
        }
    });

    test('exact matchType returns only exact description matches', () => {
        const results = searchHsn('cotton', { matchType: 'exact' });
        results.forEach(r => expect(r.description.toLowerCase()).toBe('cotton'));
    });

    test('startsWith matchType works', () => {
        const results = searchHsn('live', { matchType: 'startsWith', limit: 5 });
        results.forEach(r => expect(r.description.toLowerCase().startsWith('live')).toBe(true));
    });

    test('returns empty array for empty query', () => {
        expect(searchHsn('')).toEqual([]);
    });

    test('throws TypeError for null', () => {
        expect(() => searchHsn(null)).toThrow(TypeError);
    });

    test('returns a reorderable array containing frozen records', () => {
        const canonicalFirst = getAllHsn()[0];
        const results = searchHsn('live', { limit: 5 });
        expect(Object.isFrozen(results)).toBe(false);
        expect(Object.isFrozen(results[0])).toBe(true);
        expect(() => results.reverse()).not.toThrow();
        expect(getAllHsn()[0]).toBe(canonicalFirst);
    });
});

// ── getStats ───────────────────────────────────────────────────────────────

describe('getStats', () => {
    test('returns an object with expected shape', () => {
        const stats = getStats();
        expect(typeof stats.version).toBe('string');
        expect(typeof stats.lastUpdated).toBe('string');
        expect(typeof stats.totalCodes).toBe('number');
        expect(typeof stats.chapterCount).toBe('number');
        expect(typeof stats.source).toBe('string');
    });

    test('totalCodes matches getAllHsn length', () => {
        expect(getStats().totalCodes).toBe(getAllHsn().length);
    });

    test('returns the same frozen metadata without allowing mutation', () => {
        const stats = getStats();
        const originalVersion = stats.version;
        expect(stats).toBe(getStats());
        expect(Object.isFrozen(stats)).toBe(true);
        expect(() => { stats.version = 'changed'; }).toThrow(TypeError);
        expect(getStats().version).toBe(originalVersion);
    });
});
