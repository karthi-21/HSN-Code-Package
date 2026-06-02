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
});
