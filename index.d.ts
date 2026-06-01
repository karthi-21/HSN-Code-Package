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
