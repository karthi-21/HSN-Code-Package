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
  test('groups mixed intra-state and inter-state items without changing totals', () => {
    const items = [
      { taxableValue: 100, gstRate: 10, isInterState: false },
      { taxableValue: 200, igstRate: 10, isInterState: true, cessRate: 1 }
    ];
    const summary = generateGSTR1Summary(items);
    expect(summary).toEqual([{
      taxRate: 10,
      taxableValue: 300,
      igst: 20,
      cgst: 5,
      sgst: 5,
      cess: 2,
      totalTax: 32,
      count: 2
    }]);
  });
  test('preserves valid zero taxable value, rate and cess', () => {
    expect(generateGSTR1Summary([
      { taxableValue: 0, gstRate: 0, cessRate: 0 }
    ])).toEqual([{
      taxRate: 0,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalTax: 0,
      count: 1
    }]);
  });
  test.each([
    ['null item', null, TypeError, 'item'],
    ['array item', [], TypeError, 'item'],
    ['missing taxable value', { gstRate: 18 }, TypeError, 'taxableValue'],
    ['taxable numeric string', { taxableValue: '100', gstRate: 18 }, TypeError, 'taxableValue'],
    ['negative taxable value', { taxableValue: -1, gstRate: 18 }, RangeError, 'taxableValue'],
    ['NaN taxable value', { taxableValue: NaN, gstRate: 18 }, TypeError, 'taxableValue'],
    ['infinite taxable value', { taxableValue: Infinity, gstRate: 18 }, TypeError, 'taxableValue'],
    ['missing both rates', { taxableValue: 100 }, TypeError, 'gstRate'],
    ['rate numeric string', { taxableValue: 100, gstRate: '18' }, TypeError, 'gstRate'],
    ['negative rate', { taxableValue: 100, gstRate: -1 }, RangeError, 'gstRate'],
    ['NaN rate', { taxableValue: 100, gstRate: NaN }, TypeError, 'gstRate'],
    ['infinite fallback rate', { taxableValue: 100, igstRate: -Infinity }, TypeError, 'igstRate'],
    ['invalid boolean', { taxableValue: 100, gstRate: 18, isInterState: 'false' }, TypeError, 'isInterState'],
    ['invalid cess', { taxableValue: 100, gstRate: 18, cessRate: '1' }, TypeError, 'cessRate'],
    ['negative cess', { taxableValue: 100, gstRate: 18, cessRate: -1 }, RangeError, 'cessRate'],
    ['infinite cess', { taxableValue: 100, gstRate: 18, cessRate: Infinity }, TypeError, 'cessRate']
  ])('rejects %s with an indexed field error', (_label, item, ErrorType, field) => {
    const invoke = () => generateGSTR1Summary([
      { taxableValue: 0, gstRate: 0 },
      item
    ]);
    expect(invoke).toThrow(ErrorType);
    expect(invoke).toThrow(`items[1].${field}`);
  });
  test('throws on non-array', () => {
    expect(() => generateGSTR1Summary(null)).toThrow(TypeError);
  });
});
