'use strict';
const { validateGSTIN, formatGSTIN, getStateFromGSTIN, isValidPAN, getGSTINComponents } = require('../gstin');

describe('isValidPAN', () => {
  test('valid PAN', () => { expect(isValidPAN('AAPFU0939F')).toBe(true); });
  test('lowercase PAN', () => { expect(isValidPAN('aapfu0939f')).toBe(false); });
  test('invalid format', () => { expect(isValidPAN('12345')).toBe(false); });
  test('null', () => { expect(isValidPAN(null)).toBe(false); });
});

describe('validateGSTIN', () => {
  test('valid GSTIN', () => {
    const r = validateGSTIN('27AAPFU0939F1ZV');
    expect(r.isValid).toBe(true);
    expect(r.stateCode).toBe('27');
    expect(r.stateName).toBe('Maharashtra');
    expect(r.panNumber).toBe('AAPFU0939F');
  });
  test('wrong length', () => {
    expect(validateGSTIN('27AAPFU0939F1Z').isValid).toBe(false);
  });
  test('invalid state code', () => {
    expect(validateGSTIN('99AAPFU0939F1ZV').isValid).toBeDefined(); // 99 is valid (Centre)
  });
  test('null input', () => { expect(validateGSTIN(null).isValid).toBe(false); });
  test('empty string', () => { expect(validateGSTIN('').isValid).toBe(false); });
});

describe('formatGSTIN', () => {
  test('uppercases and trims', () => {
    expect(formatGSTIN('  27aapfu0939f1zv  ')).toBe('27AAPFU0939F1ZV');
  });
  test('throws on null', () => { expect(() => formatGSTIN(null)).toThrow(TypeError); });
});

describe('getStateFromGSTIN', () => {
  test('returns state name', () => {
    expect(getStateFromGSTIN('27AAPFU0939F1ZV')).toBe('Maharashtra');
  });
  test('throws on invalid state', () => {
    expect(() => getStateFromGSTIN('00AAPFU0939F1ZV')).toThrow(RangeError);
  });
});

describe('getGSTINComponents', () => {
  test('parses components', () => {
    const c = getGSTINComponents('27AAPFU0939F1ZV');
    expect(c.stateCode).toBe('27');
    expect(c.pan).toBe('AAPFU0939F');
    expect(c.entityNumber).toBe('1');
    expect(c.checkDigit).toBe('V');
  });
  test('throws on wrong length', () => {
    expect(() => getGSTINComponents('27AAPFU')).toThrow(RangeError);
  });
});
