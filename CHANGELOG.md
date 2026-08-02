# Changelog

All notable changes to this package are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## 3.0.0 - 2026-08-02

### Breaking changes

- `getAllHsn()` and `getAllSac()` now return stable frozen arrays whose records
  are also frozen. TypeScript declarations expose these as `ReadonlyArray` and
  make canonical HSN, SAC, GST-rate, and metadata fields readonly.
- `generateGSTR1Summary()` now rejects missing, non-finite, negative, and
  incorrectly typed values instead of coercing them to zero.
- `exportToCSV()` now neutralizes spreadsheet-formula strings by default.
  Set `preventFormulaInjection: false` to retain the previous behavior.
- Invalid `hsn validate` and `hsn gstin` CLI commands now exit with status `1`.
- `HsnStats` now requires `gstRatesLastUpdated`, `gstRateSource`, and
  `gstNotificationRef`.

### Security

- Replaced the vulnerable legacy Excel parser stack with integrity-pinned
  SheetJS 0.20.3 from the official SheetJS CDN.
- Added formula-injection protection to CSV headers and string cells while
  preserving legitimate signed numeric strings.
- Changed the scheduled GST-rate workflow to a source-gated, read-only check.
  It cannot commit or push generated data.

### Fixed

- Invoice totals now support downward round-off adjustments, use symmetric
  signed cent rounding, and never expose negative zero.
- GSTR-1 summaries now fail clearly on invalid financial inputs.
- CLI validation failures now return shell-friendly nonzero statuses.
- The GST-rate refresh validates HTTPS downloads, redirects, file signatures,
  workbook size, row quality, duplicates, and source overlap before proposing
  changes.
- GST-rate metadata now reports `mixed` whenever chapter-level fallback rates
  remain and reports `authoritative-excel` only for complete workbook coverage.
- Proposed GST rates and metadata are staged together before either target is
  replaced, narrowing the consistency window during local writes.

### Tooling

- CI and npm publishing now require the strict TypeScript smoke test.
- Expanded regression coverage for build scripts, rate ingestion, CLI behavior,
  immutable data, validation, CSV safety, and rounding.
