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

// Advanced HSN lookups
export interface ChapterSummary {
    chapter: string;
    totalCodes: number;
    codeRange: { from: string; to: string };
    codes: HsnCode[];
}
export interface BulkValidationResult {
    valid: string[];
    invalid: string[];
    summary: { total: number; validCount: number; invalidCount: number };
}
/** Returns a summary of all HSN codes within a chapter, or null if none. */
export function getChapterSummary(chapter: string | number): ChapterSummary | null;
/** Returns codes whose description contains ALL given keywords (AND match). */
export function findCodesByDescription(keywords: string[]): HsnCode[];
/** Validates many HSN codes at once. */
export function bulkValidateHsnCodes(codes: Array<string | number>): BulkValidationResult;

// GST rate types
export interface GstRate {
    code: string;
    igstRate: number;
    cgstRate: number;
    sgstRate: number;
    cessRate: number;
    rateSource: string;
    effectiveFrom: string;
    notificationRef: string;
}

export interface HsnCodeWithRate extends HsnCode {
    igstRate?: number;
    cgstRate?: number;
    sgstRate?: number;
    cessRate?: number;
    rateSource?: string;
    effectiveFrom?: string;
}

/** Returns GST rate details for an exact HSN code, or null if not found. */
export function getGstRateByCode(code: string | number): GstRate | null;

/** Returns the HSN entry merged with its GST rate, or undefined if code not found. */
export function getHsnByExactCodeWithRate(code: string | number): HsnCodeWithRate | undefined;

/** Returns all HSN codes that fall under a given IGST rate slab (e.g. 5, 18). */
export function getHsnByRateSlabs(igstRate: number): HsnCode[];

// GSTIN types
export interface GSTINValidationResult {
    isValid: boolean;
    stateCode?: string;
    stateName?: string;
    panNumber?: string;
    entityNumber?: string;
    checkDigit?: string;
    error?: string;
}
export interface GSTINComponents {
    stateCode: string;
    stateName: string;
    pan: string;
    entityNumber: string;
    checkDigit: string;
}
export function validateGSTIN(gstin: string): GSTINValidationResult;
export function formatGSTIN(gstin: string): string;
export function getStateFromGSTIN(gstin: string): string;
export function isValidPAN(pan: string): boolean;
export function getGSTINComponents(gstin: string): GSTINComponents;

// SAC types
export interface SacCode { code: string; description: string; }
export interface CodeDetails { code: string; description: string; type: 'HSN' | 'SAC'; }
export function getAllSac(): SacCode[];
export function getSacByCode(code: string | number): SacCode | undefined;
export function searchSac(query: string, options?: SearchOptions): SacCode[];
export function getCodeDetails(code: string | number): CodeDetails | undefined;

// Export types
export function exportToCSV(data: object[], options?: { delimiter?: string; headers?: string[] }): string;
export function exportToJSON(data: unknown, options?: { pretty?: boolean }): string;
export function generateGSTR1Summary(
    items: Array<{ taxableValue: number; gstRate: number; isInterState?: boolean; cessRate?: number }>
): object[];
