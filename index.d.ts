export interface HsnCode {
    code: string;
    description: string;
}

export interface SearchOptions {
    /** Default: 'contains' */
    matchType?: 'contains' | 'startsWith' | 'exact';
    /** Max results to return. 0 = unlimited. Default: 0 */
    limit?: number;
    /** Number of results to skip (for pagination). Default: 0 */
    offset?: number;
}

export interface HsnStats {
    version: string;
    lastUpdated: string;
    totalCodes: number;
    chapterCount: number;
    source: string;
}

/** Returns all 12,000+ HSN codes. */
export function getAllHsn(): HsnCode[];

/** Case-insensitive partial search on description. */
export function getCodeByTxt(txt: string): HsnCode[];

/** Returns all codes whose code string contains the given value (partial match). */
export function getDesByCode(code: string | number): HsnCode[];

/** Returns the single entry matching the exact code, or undefined. */
export function getHsnByExactCode(code: string | number): HsnCode | undefined;

/** Returns true if the exact code exists in the HSN list. */
export function isValidHsnCode(code: string | number): boolean;

/** Returns all codes under a chapter (first two digits), e.g. '01' or 1. */
export function getHsnChapter(chapter: string | number): HsnCode[];

/** Advanced description search with matchType and pagination support. */
export function searchHsn(query: string, options?: SearchOptions): HsnCode[];

/** Returns metadata about the bundled dataset (version, date, totals). */
export function getStats(): HsnStats;

// ── GST calculation utilities (issue #3) ────────────────────────────────────

export interface TaxResult {
    taxableAmount: number;
    rate: number;
    taxAmount: number;
    total: number;
}

export interface GSTBreakdown {
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalTax: number;
    grandTotal: number;
}

export interface ReverseTaxResult {
    grandTotal: number;
    rate: number;
    taxableAmount: number;
    taxAmount: number;
}

export interface InvoiceLineItem {
    taxableValue: number;
    gstRate: number;
    cessRate?: number;
}

export interface InvoiceTotals {
    totalTaxableValue: number;
    totalCGST: number;
    totalSGST: number;
    totalIGST: number;
    totalCess: number;
    totalTax: number;
    grandTotal: number;
    roundOff: number;
}

export interface GSTBreakdownOptions {
    isInterState?: boolean;
    cessRate?: number;
}

/** Rounds a monetary amount to 2 decimal places (half-up). */
export function applyRoundOffRules(amount: number): number;

/** Calculates tax on a taxable amount at a given percentage rate. */
export function calculateTax(taxableAmount: number, rate: number): TaxResult;

/** Splits GST into CGST/SGST (intra-state) or IGST (inter-state) plus optional cess. */
export function calculateGSTBreakdown(
    taxableAmount: number,
    gstRate: number,
    options?: GSTBreakdownOptions
): GSTBreakdown;

/** Extracts the base amount and tax from a tax-inclusive total. */
export function reverseCalculateTax(grandTotal: number, rate: number): ReverseTaxResult;

/** Determines whether a supply attracts IGST or CGST+SGST based on state codes. */
export function getApplicableTaxType(
    supplierStateCode: string,
    placeOfSupplyStateCode: string
): 'IGST' | 'CGST_SGST';

/** Calculates totals for an invoice of line items. */
export function calculateInvoiceTotals(
    items: InvoiceLineItem[],
    isInterState: boolean
): InvoiceTotals;

/** Groups invoice line items by their GST rate (useful for GSTR-1 summaries). */
export function groupItemsByTaxRate<T extends { gstRate: number }>(
    items: T[]
): Record<string, T[]>;
