'use strict';
const { getAllSac, getSacByCode, searchSac, getCodeDetails } = require('../sac');

describe('getAllSac', () => {
  test('returns array with entries', () => {
    const all = getAllSac();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(50);
  });
  test('entries have code and description', () => {
    const entry = getAllSac()[0];
    expect(entry).toHaveProperty('code');
    expect(entry).toHaveProperty('description');
  });
  test('returns the same frozen array with frozen records', () => {
    const all = getAllSac();
    const first = all[0];
    const original = { ...first };
    expect(all).toBe(getAllSac());
    expect(Object.isFrozen(all)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => all.push({ code: 'x', description: 'x' })).toThrow(TypeError);
    expect(() => { all[0] = { code: 'x', description: 'x' }; }).toThrow(TypeError);
    expect(() => { first.description = 'changed'; }).toThrow(TypeError);
    expect(getAllSac()[0]).toEqual(original);
  });
});

describe('getSacByCode', () => {
  test('finds known code', () => {
    const r = getSacByCode('9954');
    expect(r).toBeDefined();
    expect(r.code).toBe('9954');
  });
  test('returns undefined for unknown code', () => {
    expect(getSacByCode('000000')).toBeUndefined();
  });
  test('throws on no argument', () => {
    expect(() => getSacByCode()).toThrow(TypeError);
  });
});

describe('searchSac', () => {
  test('finds by keyword', () => {
    const r = searchSac('education');
    expect(r.length).toBeGreaterThan(0);
  });
  test('respects limit', () => {
    const r = searchSac('services', { limit: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
  });
  test('throws on non-string', () => {
    expect(() => searchSac(null)).toThrow(TypeError);
  });
  test('returns a reorderable array containing frozen records', () => {
    const canonicalFirst = getAllSac()[0];
    const results = searchSac('services', { limit: 5 });
    expect(Object.isFrozen(results)).toBe(false);
    expect(Object.isFrozen(results[0])).toBe(true);
    expect(() => results.reverse()).not.toThrow();
    expect(getAllSac()[0]).toBe(canonicalFirst);
  });
});

describe('getCodeDetails', () => {
  test('returns SAC type for SAC code', () => {
    const r = getCodeDetails('9954');
    expect(r).toBeDefined();
    expect(r.type).toBe('SAC');
  });
  test('returns undefined for unknown code', () => {
    expect(getCodeDetails('00000000xyz')).toBeUndefined();
  });
  test('throws on no argument', () => {
    expect(() => getCodeDetails()).toThrow(TypeError);
  });
  test('returns mutable defensive copies for SAC and HSN details', () => {
    const sac = getSacByCode('9954');
    const sacDetails = getCodeDetails('9954');
    sacDetails.description = 'changed';
    expect(getSacByCode('9954').description).toBe(sac.description);

    const { getAllHsn, getHsnByExactCode } = require('../index');
    const hsn = getAllHsn()[0];
    const hsnDetails = getCodeDetails(hsn.code);
    hsnDetails.description = 'changed';
    expect(getHsnByExactCode(hsn.code).description).toBe(hsn.description);
  });
});
