'use strict';

const {
    applyRoundOffRules,
    calculateTax,
    calculateGSTBreakdown,
    reverseCalculateTax,
    getApplicableTaxType,
    calculateInvoiceTotals,
    groupItemsByTaxRate
} = require('../gst');

describe('applyRoundOffRules', () => {
    test('rounds to 2 decimals (half-up)', () => {
        expect(applyRoundOffRules(10.005)).toBe(10.01);
        expect(applyRoundOffRules(10.004)).toBe(10);
        expect(applyRoundOffRules(250)).toBe(250);
    });
    test('throws on non-number', () => {
        expect(() => applyRoundOffRules('x')).toThrow(TypeError);
    });
    test('throws on negative', () => {
        expect(() => applyRoundOffRules(-1)).toThrow(RangeError);
    });
});

describe('calculateTax', () => {
    test('computes tax and total', () => {
        const r = calculateTax(10000, 18);
        expect(r.taxAmount).toBe(1800);
        expect(r.total).toBe(11800);
        expect(r.rate).toBe(18);
    });
    test('handles zero rate', () => {
        const r = calculateTax(500, 0);
        expect(r.taxAmount).toBe(0);
        expect(r.total).toBe(500);
    });
    test('throws on invalid input', () => {
        expect(() => calculateTax(null, 18)).toThrow(TypeError);
        expect(() => calculateTax(100, 'x')).toThrow(TypeError);
    });
});

describe('calculateGSTBreakdown', () => {
    test('intra-state splits into CGST + SGST', () => {
        const r = calculateGSTBreakdown(10000, 18);
        expect(r.cgst).toBe(900);
        expect(r.sgst).toBe(900);
        expect(r.igst).toBe(0);
        expect(r.totalTax).toBe(1800);
        expect(r.grandTotal).toBe(11800);
    });
    test('inter-state uses IGST', () => {
        const r = calculateGSTBreakdown(10000, 18, { isInterState: true });
        expect(r.igst).toBe(1800);
        expect(r.cgst).toBe(0);
        expect(r.sgst).toBe(0);
        expect(r.grandTotal).toBe(11800);
    });
    test('applies cess', () => {
        const r = calculateGSTBreakdown(10000, 28, { isInterState: true, cessRate: 25 });
        expect(r.igst).toBe(2800);
        expect(r.cess).toBe(2500);
        expect(r.totalTax).toBe(5300);
        expect(r.grandTotal).toBe(15300);
    });
});

describe('reverseCalculateTax', () => {
    test('extracts base and tax from inclusive total', () => {
        const r = reverseCalculateTax(11800, 18);
        expect(r.taxableAmount).toBe(10000);
        expect(r.taxAmount).toBe(1800);
    });
    test('round trip with calculateTax', () => {
        const fwd = calculateTax(2500, 12);
        const rev = reverseCalculateTax(fwd.total, 12);
        expect(rev.taxableAmount).toBe(2500);
    });
});

describe('getApplicableTaxType', () => {
    test('same state -> CGST_SGST', () => {
        expect(getApplicableTaxType('33', '33')).toBe('CGST_SGST');
    });
    test('different state -> IGST', () => {
        expect(getApplicableTaxType('33', '29')).toBe('IGST');
    });
    test('throws when a code is missing', () => {
        expect(() => getApplicableTaxType('33')).toThrow(TypeError);
    });
});

describe('calculateInvoiceTotals', () => {
    const items = [
        { taxableValue: 10000, gstRate: 18 },
        { taxableValue: 5000, gstRate: 12 }
    ];
    test('sums intra-state invoice', () => {
        const t = calculateInvoiceTotals(items, false);
        expect(t.totalTaxableValue).toBe(15000);
        expect(t.totalCGST).toBe(1200);
        expect(t.totalSGST).toBe(1200);
        expect(t.totalIGST).toBe(0);
        expect(t.totalTax).toBe(2400);
    });
    test('sums inter-state invoice', () => {
        const t = calculateInvoiceTotals(items, true);
        expect(t.totalIGST).toBe(2400);
        expect(t.totalCGST).toBe(0);
    });
    test('produces a round-off and integer grand total', () => {
        const t = calculateInvoiceTotals([{ taxableValue: 100.5, gstRate: 18 }], false);
        expect(Number.isInteger(t.grandTotal)).toBe(true);
        expect(typeof t.roundOff).toBe('number');
    });
    test('throws on non-array', () => {
        expect(() => calculateInvoiceTotals('x', false)).toThrow(TypeError);
    });
});

describe('groupItemsByTaxRate', () => {
    test('groups by gstRate', () => {
        const grouped = groupItemsByTaxRate([
            { gstRate: 18, name: 'a' },
            { gstRate: 12, name: 'b' },
            { gstRate: 18, name: 'c' }
        ]);
        expect(grouped['18']).toHaveLength(2);
        expect(grouped['12']).toHaveLength(1);
    });
    test('throws on non-array', () => {
        expect(() => groupItemsByTaxRate(null)).toThrow(TypeError);
    });
});
