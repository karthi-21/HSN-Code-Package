'use strict';
const { exportToCSV, exportToJSON, generateGSTR1Summary } = require('../export');

describe('exportToCSV', () => {
  test('produces CSV with header row', () => {
    const csv = exportToCSV([{ code: '52010011', description: 'COTTON' }]);
    expect(csv).toContain('code,description');
    expect(csv).toContain('52010011');
  });
  test('escapes commas in values', () => {
    const csv = exportToCSV([{ a: 'hello, world', b: 1 }]);
    expect(csv).toContain('"hello, world"');
  });
  test('empty array returns empty string', () => {
    expect(exportToCSV([])).toBe('');
  });
  test('throws on non-array', () => {
    expect(() => exportToCSV('x')).toThrow(TypeError);
  });
});

describe('exportToJSON', () => {
  test('returns JSON string', () => {
    const json = exportToJSON([{ code: '1' }]);
    expect(JSON.parse(json)).toEqual([{ code: '1' }]);
  });
});

describe('generateGSTR1Summary', () => {
  test('groups by rate', () => {
    const items = [
      { taxableValue: 10000, gstRate: 18, isInterState: false },
      { taxableValue: 5000, gstRate: 18, isInterState: false },
      { taxableValue: 3000, gstRate: 12, isInterState: false }
    ];
    const summary = generateGSTR1Summary(items);
    expect(summary.length).toBe(2);
    const g18 = summary.find(s => s.taxRate === 18);
    expect(g18.taxableValue).toBe(15000);
  });
  test('throws on non-array', () => {
    expect(() => generateGSTR1Summary(null)).toThrow(TypeError);
  });
});
