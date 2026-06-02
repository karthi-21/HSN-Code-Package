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

## Advanced HSN lookups

### `getChapterSummary(chapter)`
Returns a summary for a chapter (code count, range, and the full list), or `null` if the chapter has no codes.

```js
const { getChapterSummary } = require('hsn-code-package');

getChapterSummary('52');
// {
//   chapter: '52',
//   totalCodes: 120,
//   codeRange: { from: '52010011', to: '52129990' },
//   codes: [ { code, description }, ... ]
// }
```

### `findCodesByDescription(keywords)`
Returns codes whose description contains **all** of the supplied keywords (AND match).

```js
const { findCodesByDescription } = require('hsn-code-package');

findCodesByDescription(['cotton', 'carded']);
// All codes mentioning both "cotton" and "carded"
```

### `bulkValidateHsnCodes(codes)`
Validates many codes at once.

```js
const { bulkValidateHsnCodes } = require('hsn-code-package');

bulkValidateHsnCodes(['52010011', '00000000']);
// {
//   valid:   ['52010011'],
//   invalid: ['00000000'],
//   summary: { total: 2, validCount: 1, invalidCount: 1 }
// }
```

---

## GSTIN & PAN validation

```js
const {
  validateGSTIN, formatGSTIN, getStateFromGSTIN, isValidPAN, getGSTINComponents
} = require('hsn-code-package');
```

### `validateGSTIN(gstin)`
Validates a GSTIN structurally and via its MOD-36 checksum. Returns a result object.

```js
validateGSTIN('27AAPFU0939F1ZV');
// {
//   isValid: true,
//   stateCode: '27',
//   stateName: 'Maharashtra',
//   panNumber: 'AAPFU0939F',
//   entityNumber: '1',
//   checkDigit: 'V'
// }

validateGSTIN('27AAPFU0939F1Z'); // { isValid: false, error: 'GSTIN must be 15 characters, got 14' }
```

### `isValidPAN(pan)`
Returns `true` for a structurally valid PAN (`AAAAA0000A`).

```js
isValidPAN('AAPFU0939F'); // true
isValidPAN('12345');      // false
```

### `formatGSTIN(gstin)` / `getStateFromGSTIN(gstin)` / `getGSTINComponents(gstin)`

```js
formatGSTIN('  27aapfu0939f1zv  '); // '27AAPFU0939F1ZV'
getStateFromGSTIN('27AAPFU0939F1ZV'); // 'Maharashtra'
getGSTINComponents('27AAPFU0939F1ZV');
// { stateCode: '27', stateName: 'Maharashtra', pan: 'AAPFU0939F', entityNumber: '1', checkDigit: 'V' }
```

---

## GST rate data

The package ships pre-built GST rate data sourced from **CBIC Notification No. 09/2025-CT(Rate)** (effective 22 Sep 2025). Rates are kept up-to-date via a weekly automated job.

### `getGstRateByCode(code)`
Returns the GST rate for an exact HSN code, or `null` if no rate is available.

```js
getGstRateByCode('52010011');
// {
//   code: '52010011',
//   igstRate: 5,
//   cgstRate: 2.5,
//   sgstRate: 2.5,
//   cessRate: 0,
//   effectiveFrom: '2025-09-22',
//   notificationRef: 'Notification No. 09/2025-CT(Rate)'
// }
```

### `getHsnByExactCodeWithRate(code)`
Returns the HSN entry merged with its GST rate data.

```js
getHsnByExactCodeWithRate('52010011');
// { code: '52010011', description: '...', igstRate: 5, cgstRate: 2.5, ... }
```

### `getHsnByRateSlabs(igstRate)`
Returns all HSN codes under a given IGST rate slab.

```js
getHsnByRateSlabs(5);   // All items taxed at 5% IGST
getHsnByRateSlabs(18);  // All items taxed at 18% IGST
```

### Automated rate updates

A GitHub Actions workflow runs every Monday at 08:00 UTC to check for and apply any CBIC rate changes. If the update fails, a GitHub issue is automatically opened.

To manually trigger an update: **Actions → Update GST Rates → Run workflow**.

---

## SAC codes (services)

SAC (Services Accounting Code) lookups, backed by `data/sac_codes.json`.

```js
const { getAllSac, getSacByCode, searchSac, getCodeDetails } = require('hsn-code-package');

getSacByCode('9954');      // { code: '9954', description: 'Construction services' }
searchSac('education', { limit: 5 });
getCodeDetails('9954');    // { code, description, type: 'SAC' }
getCodeDetails('52010011');// { code, description, type: 'HSN' }
```

---

## Export utilities

```js
const { exportToCSV, exportToJSON, generateGSTR1Summary } = require('hsn-code-package');

exportToCSV([{ code: '52010011', description: 'COTTON' }]);
// "code,description\n52010011,COTTON"

exportToJSON(getSacByCode('9954'), { pretty: true });

generateGSTR1Summary([
  { taxableValue: 10000, gstRate: 18, isInterState: false },
  { taxableValue: 3000,  gstRate: 12, isInterState: false }
]);
// Tax-rate-wise breakdown with cgst/sgst/igst/cess/totalTax
```

---

## CLI

A `hsn` command is installed with the package (or run via `npx hsn`).

```bash
hsn search cotton --limit 10
hsn validate 52010011
hsn chapter 52
hsn stats
hsn gstin 27AAPFU0939F1ZV
hsn sac education --limit 5
hsn export silk --format csv
hsn help
```

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
