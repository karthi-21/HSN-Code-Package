'use strict';

/**
 * GST calculation utilities — pure, rate-agnostic helpers.
 *
 * These functions do NOT look up tax rates from HSN codes (that depends on
 * rate data being added to the dataset — see issue #2). You pass the rate in.
 */

function _assertFiniteNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError(`${name} must be a finite number, got ${value}`);
    }
}

function _assertNumber(value, name) {
    _assertFiniteNumber(value, name);
    if (value < 0) {
        throw new RangeError(`${name} must not be negative, got ${value}`);
    }
}

function _roundToCents(value) {
    const magnitude = Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
    if (magnitude === 0) return 0;
    return Math.sign(value) * magnitude;
}

/**
 * Rounds a monetary amount to 2 decimal places using standard half-up rounding.
 * GST invoices are expressed to 2 decimals.
 * @param {number} amount
 * @returns {number}
 */
function applyRoundOffRules(amount) {
    _assertNumber(amount, 'amount');
    return _roundToCents(amount);
}

/**
 * Calculates tax on a taxable amount at a given rate.
 * @param {number} taxableAmount
 * @param {number} rate - percentage, e.g. 18 for 18%
 * @returns {{ taxableAmount: number, rate: number, taxAmount: number, total: number }}
 */
function calculateTax(taxableAmount, rate) {
    _assertNumber(taxableAmount, 'taxableAmount');
    _assertNumber(rate, 'rate');
    const taxAmount = applyRoundOffRules((taxableAmount * rate) / 100);
    return {
        taxableAmount: applyRoundOffRules(taxableAmount),
        rate,
        taxAmount,
        total: applyRoundOffRules(taxableAmount + taxAmount)
    };
}

/**
 * Splits GST into CGST/SGST (intra-state) or IGST (inter-state) plus optional cess.
 * @param {number} taxableAmount
 * @param {number} gstRate - total GST percentage (e.g. 18)
 * @param {{ isInterState?: boolean, cessRate?: number }} [options]
 * @returns {{ taxableAmount: number, cgst: number, sgst: number, igst: number, cess: number, totalTax: number, grandTotal: number }}
 */
function calculateGSTBreakdown(taxableAmount, gstRate, options) {
    _assertNumber(taxableAmount, 'taxableAmount');
    _assertNumber(gstRate, 'gstRate');

    const { isInterState = false, cessRate = 0 } = options || {};
    _assertNumber(cessRate, 'cessRate');

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
        igst = applyRoundOffRules((taxableAmount * gstRate) / 100);
    } else {
        cgst = applyRoundOffRules((taxableAmount * (gstRate / 2)) / 100);
        sgst = applyRoundOffRules((taxableAmount * (gstRate / 2)) / 100);
    }

    const cess = applyRoundOffRules((taxableAmount * cessRate) / 100);
    const totalTax = applyRoundOffRules(cgst + sgst + igst + cess);
    const grandTotal = applyRoundOffRules(taxableAmount + totalTax);

    return {
        taxableAmount: applyRoundOffRules(taxableAmount),
        cgst,
        sgst,
        igst,
        cess,
        totalTax,
        grandTotal
    };
}

/**
 * Extracts the base amount and tax from a tax-inclusive total.
 * @param {number} grandTotal - amount that already includes tax
 * @param {number} rate - percentage, e.g. 18
 * @returns {{ grandTotal: number, rate: number, taxableAmount: number, taxAmount: number }}
 */
function reverseCalculateTax(grandTotal, rate) {
    _assertNumber(grandTotal, 'grandTotal');
    _assertNumber(rate, 'rate');
    const taxableAmount = applyRoundOffRules((grandTotal * 100) / (100 + rate));
    const taxAmount = applyRoundOffRules(grandTotal - taxableAmount);
    return {
        grandTotal: applyRoundOffRules(grandTotal),
        rate,
        taxableAmount,
        taxAmount
    };
}

/**
 * Determines whether a supply attracts IGST or CGST+SGST.
 * @param {string} supplierStateCode - 2-digit GST state code, e.g. '33'
 * @param {string} placeOfSupplyStateCode - 2-digit GST state code, e.g. '29'
 * @returns {'IGST' | 'CGST_SGST'}
 */
function getApplicableTaxType(supplierStateCode, placeOfSupplyStateCode) {
    if (!supplierStateCode || !placeOfSupplyStateCode) {
        throw new TypeError('Both supplierStateCode and placeOfSupplyStateCode are required');
    }
    return String(supplierStateCode).trim() === String(placeOfSupplyStateCode).trim()
        ? 'CGST_SGST'
        : 'IGST';
}

/**
 * Calculates totals for an invoice of line items.
 * Each item: { taxableValue, gstRate, cessRate? }
 * @param {Array<{ taxableValue: number, gstRate: number, cessRate?: number }>} items
 * @param {boolean} isInterState
 * @returns {{ totalTaxableValue: number, totalCGST: number, totalSGST: number, totalIGST: number, totalCess: number, totalTax: number, grandTotal: number, roundOff: number }}
 */
function calculateInvoiceTotals(items, isInterState) {
    if (!Array.isArray(items)) {
        throw new TypeError(`items must be an array, got ${typeof items}`);
    }

    const acc = {
        totalTaxableValue: 0,
        totalCGST: 0,
        totalSGST: 0,
        totalIGST: 0,
        totalCess: 0,
        totalTax: 0
    };

    for (const item of items) {
        const breakdown = calculateGSTBreakdown(item.taxableValue, item.gstRate, {
            isInterState: !!isInterState,
            cessRate: item.cessRate || 0
        });
        acc.totalTaxableValue += breakdown.taxableAmount;
        acc.totalCGST += breakdown.cgst;
        acc.totalSGST += breakdown.sgst;
        acc.totalIGST += breakdown.igst;
        acc.totalCess += breakdown.cess;
        acc.totalTax += breakdown.totalTax;
    }

    const rawGrandTotal = acc.totalTaxableValue + acc.totalTax;
    const grandTotal = applyRoundOffRules(Math.round(rawGrandTotal));
    const rawRoundOff = grandTotal - rawGrandTotal;
    _assertFiniteNumber(rawRoundOff, 'roundOff');
    const roundOff = _roundToCents(rawRoundOff);

    return {
        totalTaxableValue: applyRoundOffRules(acc.totalTaxableValue),
        totalCGST: applyRoundOffRules(acc.totalCGST),
        totalSGST: applyRoundOffRules(acc.totalSGST),
        totalIGST: applyRoundOffRules(acc.totalIGST),
        totalCess: applyRoundOffRules(acc.totalCess),
        totalTax: applyRoundOffRules(acc.totalTax),
        grandTotal,
        roundOff
    };
}

/**
 * Groups invoice line items by their GST rate (useful for GSTR-1 summaries).
 * @param {Array<{ gstRate: number }>} items
 * @returns {Object<string, Array>} keyed by rate
 */
function groupItemsByTaxRate(items) {
    if (!Array.isArray(items)) {
        throw new TypeError(`items must be an array, got ${typeof items}`);
    }
    return items.reduce((groups, item) => {
        const key = String(item.gstRate);
        (groups[key] = groups[key] || []).push(item);
        return groups;
    }, {});
}

module.exports = {
    applyRoundOffRules,
    calculateTax,
    calculateGSTBreakdown,
    reverseCalculateTax,
    getApplicableTaxType,
    calculateInvoiceTotals,
    groupItemsByTaxRate
};
