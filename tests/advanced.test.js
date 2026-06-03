'use strict';
const { getChapterSummary, findCodesByDescription, bulkValidateHsnCodes } = require('../index');

describe('getChapterSummary', () => {
  test('returns summary for valid chapter', () => {
    const s = getChapterSummary('52');
    expect(s).toBeDefined();
    expect(s.chapter).toBe('52');
    expect(s.totalCodes).toBeGreaterThan(0);
    expect(s.codes).toBeInstanceOf(Array);
    expect(s.codeRange).toHaveProperty('from');
    expect(s.codeRange).toHaveProperty('to');
  });
  test('returns null for empty chapter', () => {
    expect(getChapterSummary('99')).toBeNull();
  });
  test('accepts numeric chapter', () => {
    const s = getChapterSummary(1);
    expect(s).toBeDefined();
  });
  test('throws on invalid input', () => {
    expect(() => getChapterSummary(null)).toThrow(TypeError);
  });
});

describe('findCodesByDescription', () => {
  test('finds by multiple keywords (AND)', () => {
    const r = findCodesByDescription(['cotton', 'carded']);
    expect(r.length).toBeGreaterThan(0);
    r.forEach(item => {
      const desc = item.description.toLowerCase();
      expect(desc).toContain('cotton');
      expect(desc).toContain('carded');
    });
  });
  test('empty array returns empty', () => {
    expect(findCodesByDescription([])).toEqual([]);
  });
  test('throws on non-array', () => {
    expect(() => findCodesByDescription('cotton')).toThrow(TypeError);
  });
});

describe('bulkValidateHsnCodes', () => {
  test('validates multiple codes', () => {
    const result = bulkValidateHsnCodes(['52010011', '00000000', '52010013']);
    expect(result.summary.total).toBe(3);
    expect(result.valid).toContain('52010011');
    expect(result.invalid).toContain('00000000');
  });
  test('throws on non-array', () => {
    expect(() => bulkValidateHsnCodes('x')).toThrow(TypeError);
  });
});
