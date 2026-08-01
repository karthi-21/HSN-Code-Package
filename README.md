# hsn-code-package

> Zero-dependency HSN/SAC code lookup and GST toolkit for India — search 12,000+ codes, look up GST rates, validate GSTIN/PAN, compute CGST/SGST/IGST, and export invoice data.

[![npm version](https://img.shields.io/npm/v/hsn-code-package.svg)](https://www.npmjs.com/package/hsn-code-package)
[![node](https://img.shields.io/node/v/hsn-code-package.svg)](https://nodejs.org)

**[🚀 Live Demo](https://hsn-gst-demo.karthi-21.com/)** — See every feature in action, no setup needed.

## What is this?

> Try it live at **[hsn-gst-demo.karthi-21.com](https://hsn-gst-demo.karthi-21.com/)** before installing.

`hsn-code-package` bundles the full CBIC/WCO Harmonized System Nomenclature (HSN) code list along with Service Accounting Codes (SAC) and a set of pure utility functions for GST work in India. It has **no runtime dependencies** — the data ships as JSON inside the package and everything runs on the Node.js standard library.

It provides:

- **HSN code lookup** — search, validate, and browse 12,604 HSN codes by code or description.
- **GST rate data** — chapter-level CGST/SGST/IGST rates derived from CBIC Notification 09/2025-CT(Rate).
- **GST calculation** — rate-agnostic helpers for tax, reverse tax, invoice totals, and round-off.
- **GSTIN & PAN validation** — format checks plus MOD-36 checksum verification and state decoding.
- **SAC codes** — 496 service accounting codes with search.
- **Export utilities** — CSV/JSON export and a GSTR-1 rate-wise summary.
- **CLI** — `hsn` command for lookups, validation, and export from the terminal.
- **TypeScript** — complete type definitions bundled (no `@types` needed).

## Installation

```bash
npm install hsn-code-package
```

Requires **Node.js >= 14**.

## Quick start

```js
const hsn = require('hsn-code-package');

// 1. Look up an HSN code
hsn.getHsnByExactCode('52010011');
// → { code: '52010011', description: 'COTTON, NOT CARDED OR COMBED ... BENGAL DESHI' }

// 2. Find its GST rate
hsn.getGstRateByCode('52010011');
// → { code: '52010011', igstRate: 5, cgstRate: 2.5, sgstRate: 2.5, cessRate: 0, ... }

// 3. Calculate GST on an amount
hsn.calculateGSTBreakdown(10000, 5, { isInterState: false });
// → { taxableAmount: 10000, cgst: 250, sgst: 250, igst: 0, cess: 0, totalTax: 500, grandTotal: 10500 }

// 4. Validate a GSTIN
hsn.validateGSTIN('27AAPFU0939F1ZV');
// → { isValid: true, stateCode: '27', stateName: 'Maharashtra', panNumber: 'AAPFU0939F', ... }
```

## Table of contents

- [HSN code lookup](#hsn-code-lookup)
- [GST rate data](#gst-rate-data)
- [GST calculation utilities](#gst-calculation-utilities)
- [GSTIN & PAN validation](#gstin--pan-validation)
- [SAC codes (services)](#sac-codes-services)
- [Export utilities](#export-utilities)
- [CLI](#cli)
- [TypeScript](#typescript)
- [Data sources & update schedule](#data-sources--update-schedule)
- [Migrating from v1 / v2.x](#migrating-from-v1--v2x)
- [Live demo](#live-demo)
- [Contributing](#contributing)

---

## HSN code lookup

### `getAllHsn()`

Returns every HSN code in the dataset.

```js
hsn.getAllHsn();
// → [ { code: '1011010', description: '...' }, ... ]  (12,604 entries)
```

### `getCodeByTxt(txt)`

Case-insensitive partial search on the description.

```js
hsn.getCodeByTxt('cotton');
// → [ { code: '12072010', description: '...COTTON SEEDS : OF SEED QUALITY' }, ... ]
```

### `getDesByCode(code)`

Returns all entries whose code string **contains** the given value (partial match). Use `getHsnByExactCode` for a strict lookup.

```js
hsn.getDesByCode('5201');
// → [ { code: '52010011', description: '...' }, { code: '52010012', ... }, ... ]
```

### `getHsnByExactCode(code)`

Returns the single entry for an exact code, or `undefined`.

```js
hsn.getHsnByExactCode('52010011');
// → { code: '52010011', description: 'COTTON, NOT CARDED OR COMBED ...' }
```

### `isValidHsnCode(code)`

Returns `true` if the exact code exists.

```js
hsn.isValidHsnCode('52010011'); // → true
hsn.isValidHsnCode('00000000'); // → false
```

### `getHsnChapter(chapter)`

Returns all codes under a chapter (first two digits). Accepts `'52'`, `'5'`, or `52`.

```js
hsn.getHsnChapter('52'); // → all chapter-52 (cotton) codes
```

### `searchHsn(query, options)`

Advanced description search with match type and pagination.

```js
hsn.searchHsn('silk', { matchType: 'contains', limit: 10, offset: 0 });
```

| Option      | Type                                       | Default      | Description                          |
| ----------- | ------------------------------------------ | ------------ | ------------------------------------ |
| `matchType` | `'contains' \| 'startsWith' \| 'exact'`    | `'contains'` | How the description is matched.      |
| `limit`     | `number`                                   | `0`          | Max results (`0` = unlimited).       |
| `offset`    | `number`                                   | `0`          | Results to skip (for pagination).    |

### `getStats()`

Returns metadata about the bundled dataset.

```js
hsn.getStats();
// → { version: '2.3.0', lastUpdated: '2026-06-02', totalCodes: 12604,
//     chapterCount: 86, source: 'CBIC / WCO Harmonized System Nomenclature' }
```

### `getChapterSummary(chapter)`

Returns a summary of a chapter, or `null` if none exist.

```js
hsn.getChapterSummary('52');
// → { chapter: '52', totalCodes: 123, codeRange: { from: '...', to: '...' }, codes: [...] }
```

### `findCodesByDescription(keywords)`

Returns codes whose description contains **all** of the given keywords (AND match).

```js
hsn.findCodesByDescription(['cotton', 'carded']);
// → entries matching both terms
```

### `bulkValidateHsnCodes(codes)`

Validates many codes at once.

```js
hsn.bulkValidateHsnCodes(['52010011', '00000000']);
// → { valid: ['52010011'], invalid: ['00000000'],
//     summary: { total: 2, validCount: 1, invalidCount: 1 } }
```

---

## GST rate data

> **Note:** GST rates are chapter-level mappings derived from **CBIC Notification No. 09/2025-CT(Rate) dated 17 Sep 2025**, effective 2025-09-22. They are a best-effort classification at the chapter level — always confirm against the official notification for legal/billing use.

### `getGstRateByCode(code)`

Returns GST rate details for an exact code, or `null`.

```js
hsn.getGstRateByCode('52010011');
// → { code: '52010011', igstRate: 5, cgstRate: 2.5, sgstRate: 2.5, cessRate: 0,
//     rateSource: 'chapter-level', effectiveFrom: '2025-09-22',
//     notificationRef: 'Notification No. 09/2025-CT(Rate)' }
```

### `getHsnByExactCodeWithRate(code)`

Returns the HSN entry merged with its GST rate, or `undefined` if the code does not exist.

```js
hsn.getHsnByExactCodeWithRate('52010011');
// → { code: '52010011', description: '...', igstRate: 5, cgstRate: 2.5, ... }
```

### `getHsnByRateSlabs(igstRate)`

Returns all HSN codes under a given IGST rate slab.

```js
hsn.getHsnByRateSlabs(5); // → all codes taxed at 5% IGST
```

---

## GST calculation utilities

These are **pure, rate-agnostic** helpers — you pass the rate in; they do not look it up. All monetary results are rounded to 2 decimals (half-up).

### `calculateTax(taxableAmount, rate)`

```js
hsn.calculateTax(10000, 18);
// → { taxableAmount: 10000, rate: 18, taxAmount: 1800, total: 11800 }
```

### `calculateGSTBreakdown(taxableAmount, gstRate, options)`

Splits GST into CGST/SGST (intra-state) or IGST (inter-state), plus optional cess.

```js
hsn.calculateGSTBreakdown(10000, 18, { isInterState: false });
// → { taxableAmount: 10000, cgst: 900, sgst: 900, igst: 0, cess: 0,
//     totalTax: 1800, grandTotal: 11800 }
```

| Option         | Type      | Default | Description                          |
| -------------- | --------- | ------- | ------------------------------------ |
| `isInterState` | `boolean` | `false` | `true` → IGST, `false` → CGST+SGST.  |
| `cessRate`     | `number`  | `0`     | Additional cess percentage.          |

### `reverseCalculateTax(grandTotal, rate)`

Extracts the base amount and tax from a tax-inclusive total.

```js
hsn.reverseCalculateTax(11800, 18);
// → { grandTotal: 11800, rate: 18, taxableAmount: 10000, taxAmount: 1800 }
```

### `getApplicableTaxType(supplierStateCode, placeOfSupplyStateCode)`

Returns `'CGST_SGST'` when the two state codes match, otherwise `'IGST'`.

```js
hsn.getApplicableTaxType('27', '27'); // → 'CGST_SGST'
hsn.getApplicableTaxType('27', '33'); // → 'IGST'
```

### `calculateInvoiceTotals(items, isInterState)`

Aggregates a list of line items into invoice totals with round-off.

```js
hsn.calculateInvoiceTotals(
  [{ taxableValue: 10000, gstRate: 18 }, { taxableValue: 5000, gstRate: 5 }],
  false
);
// → { totalTaxableValue, totalCGST, totalSGST, totalIGST, totalCess,
//     totalTax, grandTotal, roundOff }
```

Each item: `{ taxableValue: number, gstRate: number, cessRate?: number }`.

### `groupItemsByTaxRate(items)`

Groups line items by their GST rate (useful for GSTR-1 summaries).

```js
hsn.groupItemsByTaxRate([{ taxableValue: 1000, gstRate: 18 }, { taxableValue: 500, gstRate: 5 }]);
// → { '18': [ {...} ], '5': [ {...} ] }
```

### `applyRoundOffRules(amount)`

Rounds a monetary amount to 2 decimals using half-up rounding.

```js
hsn.applyRoundOffRules(10.005); // → 10.01
```

---

## GSTIN & PAN validation

### `validateGSTIN(gstin)`

Validates format, state code, and MOD-36 checksum. Returns a result object.

```js
hsn.validateGSTIN('27AAPFU0939F1ZV');
// → { isValid: true, stateCode: '27', stateName: 'Maharashtra',
//     panNumber: 'AAPFU0939F', entityNumber: '1', checkDigit: 'V' }

hsn.validateGSTIN('27AAPFU0939F1ZX');
// → { isValid: false, error: 'Invalid checksum: expected V, got X' }
```

### `formatGSTIN(gstin)`

Trims and uppercases a GSTIN string.

```js
hsn.formatGSTIN('27aapfu0939f1zv '); // → '27AAPFU0939F1ZV'
```

### `getStateFromGSTIN(gstin)`

Returns the state name for a GSTIN's first two digits. Throws on unknown codes.

```js
hsn.getStateFromGSTIN('27AAPFU0939F1ZV'); // → 'Maharashtra'
```

### `isValidPAN(pan)`

Checks PAN format (`AAAAA9999A`).

```js
hsn.isValidPAN('AAPFU0939F'); // → true
```

### `getGSTINComponents(gstin)`

Decomposes a GSTIN into its parts (does not run the checksum).

```js
hsn.getGSTINComponents('27AAPFU0939F1ZV');
// → { stateCode: '27', stateName: 'Maharashtra', pan: 'AAPFU0939F',
//     entityNumber: '1', checkDigit: 'V' }
```

---

## SAC codes (services)

### `getAllSac()`

Returns all 496 SAC entries.

```js
hsn.getAllSac(); // → [ { code: '9954', description: 'Construction services' }, ... ]
```

### `getSacByCode(code)`

Returns the single SAC entry for an exact code, or `undefined`.

```js
hsn.getSacByCode('9954'); // → { code: '9954', description: 'Construction services' }
```

### `searchSac(query, options)`

Description search with the same `SearchOptions` as `searchHsn`.

```js
hsn.searchSac('construction', { matchType: 'contains', limit: 5 });
```

### `getCodeDetails(code)`

Looks a code up in **both** HSN and SAC datasets and tags the result.

```js
hsn.getCodeDetails('9954'); // → { code: '9954', description: '...', type: 'SAC' }
hsn.getCodeDetails('52010011'); // → { code: '52010011', description: '...', type: 'HSN' }
```

---

## Export utilities

### `exportToCSV(data, options)`

Converts an array of objects to CSV (with quoting/escaping).

```js
hsn.exportToCSV(hsn.getCodeByTxt('cotton'));
// → "code,description\n12072010,..."
```

| Option      | Type       | Default                 | Description                       |
| ----------- | ---------- | ----------------------- | --------------------------------- |
| `delimiter` | `string`   | `','`                   | Field delimiter.                  |
| `headers`   | `string[]` | keys of the first row   | Explicit column order/selection.  |

### `exportToJSON(data, options)`

Serialises to JSON (pretty by default).

```js
hsn.exportToJSON(hsn.getCodeByTxt('cotton'), { pretty: false });
```

### `generateGSTR1Summary(items)`

Produces a rate-wise summary suitable for GSTR-1 reporting.

```js
hsn.generateGSTR1Summary([{ taxableValue: 10000, gstRate: 18, isInterState: false }]);
// → [ { taxRate: 18, taxableValue: 10000, igst: 0, cgst: 900, sgst: 900,
//       cess: 0, totalTax: 1800, count: 1 } ]
```

Each item requires a non-negative finite `taxableValue` and either `gstRate` or
the compatible `igstRate` field. `cessRate` defaults to `0`, and `isInterState`
defaults to `false`. When both rate fields are supplied, `gstRate` takes
precedence. Malformed items, non-finite numbers, negative values, and a
non-boolean `isInterState` throw an indexed field error instead of being
included in the summary.

---

## CLI

Installed as the `hsn` binary (use `npx hsn` if installed locally).

```bash
hsn search <query> [--limit N] [--type contains|startsWith|exact]
hsn validate <code>
hsn chapter <chapter>
hsn stats
hsn gstin <gstin>
hsn sac <query> [--limit N]
hsn export <query> [--format csv|json]
hsn help
```

Examples:

```bash
hsn search cotton --limit 3
hsn validate 52010011
hsn gstin 27AAPFU0939F1ZV
hsn export silk --format json
```

---

## TypeScript

Type definitions are bundled — there is **no separate `@types` package**.

```ts
import { getHsnByExactCode, calculateGSTBreakdown, HsnCode, GSTBreakdown } from 'hsn-code-package';

const entry: HsnCode | undefined = getHsnByExactCode('52010011');
const tax: GSTBreakdown = calculateGSTBreakdown(10000, 18, { isInterState: false });
```

Exported interfaces include `HsnCode`, `SearchOptions`, `HsnStats`, `GstRate`, `HsnCodeWithRate`, `GSTINValidationResult`, `GSTINComponents`, `SacCode`, `CodeDetails`, `TaxResult`, `GSTBreakdown`, `ReverseTaxResult`, `InvoiceLineItem`, `InvoiceTotals`, `GSTBreakdownOptions`, `ChapterSummary`, and `BulkValidationResult`.

---

## Data sources & update schedule

- **HSN/SAC codes:** CBIC / WCO Harmonized System Nomenclature.
- **GST rates:** CBIC Notification No. 09/2025-CT(Rate) dated 17 Sep 2025 (effective 2025-09-22), mapped at the **chapter level**.
- GST rate data is refreshed weekly via a GitHub Actions workflow (`.github/workflows/update-gst-rates.yml`).

Rates are provided as a developer convenience and classified at chapter granularity. For legal, billing, or filing purposes, verify against the official CBIC notification.

## Migrating from v1 / v2.x

| From      | Change                                                                                   |
| --------- | ---------------------------------------------------------------------------------------- |
| v1.x      | Package now exports a named-function API (e.g. `getHsnByExactCode`) instead of a default lookup object. HSN entries use `{ code, description }`. |
| v2.0–v2.1 | Added GST calculation utilities (`calculateTax`, `calculateGSTBreakdown`, …). No breaking changes to HSN lookup functions. |
| v2.2      | Added GSTIN/PAN validation, SAC codes, export utilities, and the `hsn` CLI. No breaking changes. |
| v2.3      | Added GST rate data (`getGstRateByCode`, `getHsnByExactCodeWithRate`, `getHsnByRateSlabs`) and advanced HSN lookups. No breaking changes. |

No function signatures or return shapes changed within the 2.x line — upgrades are additive.

## Live demo

**[https://hsn-gst-demo.karthi-21.com/](https://hsn-gst-demo.karthi-21.com/)**

An interactive showcase built on top of this package — try HSN lookups, GSTIN validation, GST calculations, SAC search, invoice generation, and CSV export right in the browser. No installation required.

## Author

Built and maintained by **[Karthikeyan](https://karthi-21.com/)**.

## Contributing

Issues and pull requests are welcome at the [GitHub repository](https://github.com/karthi-21/HSN-Code-Package).

```bash
npm install       # install dev dependencies
npm test          # run the test suite with coverage
npm run typecheck # type-check the bundled .d.ts against the smoke test
```

Please keep the package free of runtime dependencies and ensure `npm test` and `npm run typecheck` pass before opening a PR.

## License

ISC
