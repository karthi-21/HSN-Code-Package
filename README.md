# hsn-code-package

Fast, **zero-runtime-dependency** HSN code lookup for Node.js.

Search 12,000+ HSN (Harmonized System of Nomenclature) codes by description or code number, validate codes, browse by chapter, and paginate large result sets — all backed by pre-built JSON data so there is nothing to parse at startup.

[![npm version](https://img.shields.io/npm/v/hsn-code-package)](https://www.npmjs.com/package/hsn-code-package)

---

## What are HSN codes?

HSN codes are 6-8 digit uniform codes developed by the World Customs Organization (WCO) in 1988 to systematically classify goods worldwide. In India they are extended to 8 digits for GST purposes and maintained by CBIC.

---

## Installation

```bash
npm install hsn-code-package
```

No extra dependencies are installed. The package ships pre-built JSON data.

---

## Quick start

```js
const {
  getAllHsn,
  getCodeByTxt,
  getDesByCode,
  getHsnByExactCode,
  isValidHsnCode,
  getHsnChapter,
  searchHsn,
  getStats
} = require('hsn-code-package');
```

---

## API

### `getAllHsn()`
Returns every HSN code entry.

```js
const all = getAllHsn();
// [ { code: '1011010', description: 'LIVE HORSES ...' }, ... ]
console.log(all.length); // 12604
```

---

### `getCodeByTxt(txt)`
Case-insensitive partial search on descriptions. Returns all matching entries.

```js
getCodeByTxt('cotton');
// [ { code: '...', description: '... COTTON ...' }, ... ]
```

| Param | Type | Description |
|-------|------|-------------|
| `txt` | `string` | Search text (partial match, case-insensitive) |

---

### `getDesByCode(code)`
Returns all entries whose code **contains** the given value (partial match).
Use `getHsnByExactCode` when you need a strict lookup.

```js
getDesByCode('5201');
// All entries whose code contains '5201'
```

---

### `getHsnByExactCode(code)`
Returns the single entry matching the exact code, or `undefined`.

```js
const entry = getHsnByExactCode('52010011');
// { code: '52010011', description: 'COTTON, NOT CARDED ...' }

isValidHsnCode('00000000'); // undefined — code not found
```

---

### `isValidHsnCode(code)`
Returns `true` if the exact code exists, `false` otherwise. Safe to call with `null` or `undefined`.

```js
isValidHsnCode('52010011'); // true
isValidHsnCode('00000000'); // false
isValidHsnCode(null);       // false
```

Useful for **form validation** in GST invoice workflows.

---

### `getHsnChapter(chapter)`
Returns all codes under a chapter (first two digits of the full 8-digit code).

```js
getHsnChapter('52'); // All cotton-related codes (chapter 52)
getHsnChapter(1);    // Live animals (chapter 01) — numeric input accepted
```

---

### `searchHsn(query, options?)`
Advanced search with match type and pagination.

```js
// First 10 results containing 'silk'
searchHsn('silk', { limit: 10 });

// Codes whose description starts with 'raw'
searchHsn('raw', { matchType: 'startsWith', limit: 5 });

// Paginate — skip first 20, take next 10
searchHsn('cotton', { offset: 20, limit: 10 });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `matchType` | `'contains' \| 'startsWith' \| 'exact'` | `'contains'` | How to match against description |
| `limit` | `number` | `0` (unlimited) | Max results to return |
| `offset` | `number` | `0` | Results to skip (for pagination) |

---

### `getStats()`
Returns metadata about the bundled dataset.

```js
getStats();
// {
//   version: '2.0.0',
//   lastUpdated: '2026-06-01',
//   totalCodes: 12604,
//   chapterCount: 86,
//   source: 'CBIC / WCO Harmonized System Nomenclature'
// }
```

---

## GST calculation utilities

Pure, zero-dependency helpers for GST tax math. These are **rate-agnostic** — you pass the GST rate in (automatic rate lookup from HSN codes is tracked in a separate enhancement).

### `calculateTax(taxableAmount, rate)`
```js
calculateTax(10000, 18);
// { taxableAmount: 10000, rate: 18, taxAmount: 1800, total: 11800 }
```

### `calculateGSTBreakdown(taxableAmount, gstRate, options?)`
Splits GST into CGST/SGST (intra-state) or IGST (inter-state), with optional cess.
```js
calculateGSTBreakdown(10000, 18);
// { taxableAmount: 10000, cgst: 900, sgst: 900, igst: 0, cess: 0, totalTax: 1800, grandTotal: 11800 }

calculateGSTBreakdown(10000, 28, { isInterState: true, cessRate: 25 });
// { ..., igst: 2800, cess: 2500, totalTax: 5300, grandTotal: 15300 }
```

### `reverseCalculateTax(grandTotal, rate)`
Extracts base + tax from a tax-inclusive amount.
```js
reverseCalculateTax(11800, 18);
// { grandTotal: 11800, rate: 18, taxableAmount: 10000, taxAmount: 1800 }
```

### `getApplicableTaxType(supplierStateCode, placeOfSupplyStateCode)`
```js
getApplicableTaxType('33', '33'); // 'CGST_SGST'
getApplicableTaxType('33', '29'); // 'IGST'
```

### `calculateInvoiceTotals(items, isInterState)`
Sums line items into invoice totals with GST round-off.
```js
calculateInvoiceTotals([
  { taxableValue: 10000, gstRate: 18 },
  { taxableValue: 5000, gstRate: 12 }
], false);
// { totalTaxableValue: 15000, totalCGST: 1200, totalSGST: 1200, totalIGST: 0,
//   totalCess: 0, totalTax: 2400, grandTotal: 17400, roundOff: 0 }
```

### `groupItemsByTaxRate(items)`
Groups line items by GST rate (useful for GSTR-1 summaries).

### `applyRoundOffRules(amount)`
Rounds a monetary amount to 2 decimals (half-up).

---

## TypeScript

Type definitions are bundled. No `@types/` package needed.

```ts
import { getHsnByExactCode, isValidHsnCode, HsnCode } from 'hsn-code-package';

const entry: HsnCode | undefined = getHsnByExactCode('52010011');
```

---

## Migrating from v1

| v1 | v2 | Notes |
|----|-----|-------|
| `getDesByCode(code)` | `getDesByCode(code)` | Same, but now validates input and won't crash on `null` |
| `getCodeByTxt(txt)` | `getCodeByTxt(txt)` | Same, but now validates input |
| `getAllHsn()` | `getAllHsn()` | Same, but result is cached after first call |
| _(not available)_ | `getHsnByExactCode(code)` | New — strict single-result lookup |
| _(not available)_ | `isValidHsnCode(code)` | New — boolean validation |
| _(not available)_ | `getHsnChapter(chapter)` | New — chapter-level browse |
| _(not available)_ | `searchHsn(query, options)` | New — paginated / typed search |
| _(not available)_ | `getStats()` | New — dataset metadata |

**Breaking change**: `module.exports` in v1 was broken (bitwise OR evaluated to `0`). If you were using `require('hsn-code-package')` directly as a function it would have failed silently. v2 correctly exports named functions.

---

## Data updates

The HSN dataset is maintained in `data/hsn_codes.json`. To rebuild from the source Excel:

```bash
node scripts/build-data.js
```

This re-converts `code_list.xlsx` and updates `data/hsn_codes.json` and `data/metadata.json`.

---

## Contributing

Issues and feature requests: [GitHub Issues](https://github.com/karthi-21/HSN-Code-Package/issues)
