# Plan 004: Replace vulnerable spreadsheet parsers

> **Executor instructions**: Execute every step and verification gate. Do not substitute a different dependency or broaden parser behavior without approval. Stop on any STOP condition. Update `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- package.json package-lock.json scripts/build-data.js scripts/update-gst-rates.js tests/build-data.test.js tests/update-gst-rates.test.js plans/README.md`
> If an existing in-scope file changed, compare it with Current state. Material drift is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-enforce-types-in-ci.md`
- **Category**: security / migration
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

The rate updater parses downloaded spreadsheet content with npm-registry `xlsx@0.18.5`, and the HSN builder pulls `xlsx@0.12.13` through `convert-excel-to-json`. Both are below the patched SheetJS releases for prototype pollution and ReDoS. Because the update workflow reads remote bytes with repository write permissions, both direct and transitive legacy parsers must be removed rather than leaving a reachable vulnerable copy in the lockfile.

## Current state

- `package.json:63-67` contains both parser paths:

```json
"devDependencies": {
  "convert-excel-to-json": "^1.7.0",
  "jest": "^30.4.2",
  "typescript": "^5.9.3",
  "xlsx": "^0.18.5"
}
```

- `scripts/build-data.js:8-35` uses `convert-excel-to-json` to read sheet `Sheet1`, skip three header rows, and map columns B/C to `{code, description}`.
- `scripts/update-gst-rates.js:98-113` uses `xlsx.read(buffer, { type: 'buffer' })` and `sheet_to_json`.
- `package-lock.json` locks top-level `xlsx@0.18.5` and nested `convert-excel-to-json/node_modules/xlsx@0.12.13`.
- Official SheetJS documentation identifies `0.20.3` as the current version and distributes it from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; versions through `0.20.1` are affected by ReDoS. Pin the versioned URL, never the evergreen `latest` URL.
- Scripts use CommonJS, synchronous filesystem calls, and four-space indentation. Preserve those conventions.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install/update lock | `npm install --save-dev https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | exit 0; package and lock updated |
| Remove old converter | `npm uninstall --save-dev convert-excel-to-json` | exit 0; package and lock updated |
| Dependency proof | `npm ls xlsx convert-excel-to-json` | exit 0; one `xlsx@0.20.3`, no converter |
| Focused tests | `npm test -- --runInBand tests/build-data.test.js tests/update-gst-rates.test.js` | exit 0 |
| Full verification | `npm test -- --runInBand && npm run typecheck` | exit 0 |

## Suggested executor toolkit

- Consult the official SheetJS Node installation documentation: `https://docs.sheetjs.com/docs/getting-started/installation/nodejs/`.
- Consult the official SheetJS ReDoS advisory: `https://cdn.sheetjs.com/advisories/CVE-2024-22363`.

## Scope

**In scope**:

- `package.json`
- `package-lock.json`
- `scripts/build-data.js`
- `scripts/update-gst-rates.js`
- `tests/build-data.test.js` (create)
- `tests/update-gst-rates.test.js` (create if absent)
- `plans/README.md` status row only

**Out of scope**:

- Changing HSN/SAC/rate data contents or metadata dates.
- Changing the download URL, fallback policy, or workflow behavior; plan 005 owns those.
- Adding runtime dependencies. The parser must remain a development-only dependency.
- Vendoring a tarball in the repository or using an unversioned dependency URL.

## Git workflow

- Branch: `codex/004-replace-spreadsheet-parsers`
- Suggested commit: `fix: replace vulnerable spreadsheet parsers`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Install the supported parser and remove both legacy paths

Install the versioned SheetJS `0.20.3` tarball as a dev dependency, then remove `convert-excel-to-json`. Run `npm ls` and inspect `package-lock.json` to ensure neither `xlsx@0.18.5`, `xlsx@0.12.13`, nor `convert-excel-to-json` remains anywhere in the dependency graph.

**Verify**: `npm ls xlsx convert-excel-to-json && ! rg -n '"version": "0\.(12\.13|18\.5)"|node_modules/convert-excel-to-json' package-lock.json` → `npm ls` reports only `xlsx@0.20.3`; search exits with no matches.

### Step 2: Refactor the HSN builder into testable parse and write stages

Replace `convert-excel-to-json` usage in `scripts/build-data.js` with `xlsx@0.20.3`. Extract a pure `parseHsnWorkbook(sourcePath)` function that:

- Reads the workbook.
- Uses sheet `Sheet1`; if absent, throws an error naming the missing sheet.
- Converts the sheet to row arrays with blank cells preserved.
- Skips the first three rows.
- Reads the first and second cells returned for each row. The repository workbook range starts at physical column B (`!ref` is `B1:C12607`), so `sheet_to_json(..., {header: 1})` normalizes physical B/C to row indexes 0/1. Assert this mapping through repository-workbook parity rather than assuming absolute worksheet indexes.
- Drops rows missing either value and returns trimmed string `{code, description}` entries in source order.

Move existing writes into `main()`, guard execution with `if (require.main === module)`, and export only the pure parser needed by tests. Preserve current CLI output and generated JSON formatting. Do not update committed data while implementing this plan.

**Verify**: `node --check scripts/build-data.js` → exit 0.

### Step 3: Make the rate parser import-safe for focused tests

Keep `parseExcel` behavior unchanged except for the upgraded parser. Guard `main()` with `if (require.main === module)` and export `parseExcel` for tests. Do not alter URL, fallback, metadata, or write behavior in this plan.

**Verify**: `node -e "const m=require('./scripts/update-gst-rates'); if(typeof m.parseExcel!=='function') process.exit(1)"` → exit 0 without network access or file writes.

### Step 4: Add parser characterization tests

Create `tests/build-data.test.js` and `tests/update-gst-rates.test.js` using Jest and the upgraded `xlsx` package to construct in-memory workbooks or temporary files under the operating-system temp directory.

For HSN parsing, cover the three skipped header rows, B/C extraction, trimming, missing-row filtering, order preservation, and missing `Sheet1` error. Also parse the repository's `code_list.xlsx` read-only and assert the result equals `data/hsn_codes.json`; this is the migration parity gate.

For rate parsing, cover accepted header aliases, percentage strings, numeric rates, code digit normalization/padding, skipped malformed rows, and empty sheets. Tests must not make network requests or write repository data files.

**Verify**: `npm test -- --runInBand tests/build-data.test.js tests/update-gst-rates.test.js` → exit 0; parser parity and rate cases pass.

### Step 5: Run security and repository gates

Run the full suite, typecheck, dependency tree, and a dry-run package build. The parser must not appear in runtime tarball contents.

**Verify**: `npm test -- --runInBand && npm run typecheck && npm ls xlsx convert-excel-to-json && npm pack --dry-run` → exit 0; only `xlsx@0.20.3` is installed and no parser files are packed.

## Test plan

- Model Jest structure after existing files under `tests/`.
- Tests must use local/in-memory fixtures and never contact CBIC/GST services.
- Assert full `code_list.xlsx` parity with committed HSN JSON without writing output.
- Assert importing either script cannot execute `main()`.
- Assert both parsers fail clearly on structurally invalid workbooks.

## Done criteria

- [ ] Dependency graph contains exactly one SheetJS release, `xlsx@0.20.3`.
- [ ] `convert-excel-to-json`, `xlsx@0.18.5`, and `xlsx@0.12.13` are absent from manifest and lockfile.
- [ ] HSN parsing produces byte-equivalent logical entries to the current committed dataset.
- [ ] Script imports perform no network or write side effects.
- [ ] Focused tests, full tests, typecheck, and package dry run pass.
- [ ] No data JSON or metadata file changed.

## STOP conditions

- Official versioned `0.20.3` tarball cannot be installed or its integrity cannot be locked reproducibly.
- HSN parser parity fails because the old converter performed undocumented transformations.
- The migration would modify committed code/rate datasets.
- A newer plan or repository policy explicitly selects a different maintained parser.

## Maintenance notes

Keep the SheetJS URL version-pinned and review official advisories before future upgrades. The npm-registry `xlsx` release line is stale; do not replace the tarball URL with `^0.18.5` during dependency cleanup.
