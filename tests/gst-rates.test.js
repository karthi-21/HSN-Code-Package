'use strict';
const { getGstRateByCode, getHsnByExactCodeWithRate, getHsnByRateSlabs } = require('../index');

describe('getGstRateByCode', () => {
  test('returns rate object for known code', () => {
    // Chapter 52 (cotton) should be 5%
    const rates = require('../data/gst_rates.json');
    if (rates.length === 0) return; // skip if no rates
    const firstCode = rates[0].code;
    const r = getGstRateByCode(firstCode);
    expect(r).not.toBeNull();
    expect(r).toHaveProperty('igstRate');
    expect(r).toHaveProperty('cgstRate');
    expect(r).toHaveProperty('sgstRate');
    expect(r).toHaveProperty('cessRate');
  });
  test('returns null for unknown code', () => {
    expect(getGstRateByCode('00000000')).toBeNull();
  });
  test('throws on invalid input', () => {
    expect(() => getGstRateByCode(null)).toThrow(TypeError);
  });
  test('returns the same frozen rate without allowing mutation', () => {
    const rates = require('../data/gst_rates.json');
    const rate = getGstRateByCode(rates[0].code);
    const originalRate = rate.igstRate;
    expect(rate).toBe(getGstRateByCode(rates[0].code));
    expect(Object.isFrozen(rate)).toBe(true);
    expect(() => { rate.igstRate = 99; }).toThrow(TypeError);
    expect(getGstRateByCode(rates[0].code).igstRate).toBe(originalRate);
  });
});

describe('getHsnByExactCodeWithRate', () => {
  test('merges HSN entry with rate', () => {
    const rates = require('../data/gst_rates.json');
    if (rates.length === 0) return;
    const entry = getHsnByExactCodeWithRate(rates[0].code);
    if (entry) {
      expect(entry).toHaveProperty('code');
      expect(entry).toHaveProperty('description');
    }
  });
  test('returns undefined for unknown code', () => {
    expect(getHsnByExactCodeWithRate('00000000')).toBeUndefined();
  });
});

describe('getHsnByRateSlabs', () => {
  test('returns array for valid rate', () => {
    const results = getHsnByRateSlabs(5);
    expect(Array.isArray(results)).toBe(true);
  });
  test('returns empty array for unused rate', () => {
    expect(getHsnByRateSlabs(99)).toEqual([]);
  });
  test('throws on non-number', () => {
    expect(() => getHsnByRateSlabs('5')).toThrow(TypeError);
  });
  test('returns a reorderable array containing frozen HSN records', () => {
    const results = getHsnByRateSlabs(5);
    expect(Object.isFrozen(results)).toBe(false);
    expect(Object.isFrozen(results[0])).toBe(true);
    expect(() => results.reverse()).not.toThrow();
  });
});
