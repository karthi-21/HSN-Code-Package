# Plan 005: Make GST rate refreshes fail closed and report truthful freshness

> **Executor instructions**: Follow the steps in order and run every verification. This plan intentionally does not invent an official data URL. If authoritative machine-readable data cannot be confirmed, preserve the current checked-in fallback and make automation fail clearly; do not fabricate freshness. Update `plans/README.md` when complete unless a reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- scripts/update-gst-rates.js tests/update-gst-rates.test.js .github/workflows/update-gst-rates.yml data/metadata.json README.md index.d.ts tests/types.test.ts plans/README.md`
> Plan 004 is expected to have changed the script and its test. Reconcile those intentional changes, but STOP if URL/fallback/metadata behavior has independently changed.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/004-replace-spreadsheet-parsers.md`
- **Category**: bug / data integrity
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

The weekly updater points at an interactive search page, silently falls back to a hardcoded chapter map on download or parse failure, rewrites the rate file, and always advances `gstRatesLastUpdated`. Eight weekly bot commits after the feature landed changed only the date. Rate freshness is therefore currently evidence of job execution, not authoritative data verification, which is unsafe for a tax-oriented package.

## Current state

- `scripts/update-gst-rates.js:25` uses `https://services.gst.gov.in/services/searchhsnsac`, described in the same file as usually requiring browser interaction.
- `scripts/update-gst-rates.js:135-149` catches every download/parse error and switches to fallback instead of failing.
- `scripts/update-gst-rates.js:151-172` writes rates and today's metadata date regardless of source quality.

```js
} catch (err) {
    console.log(`Download/parse failed (${err.message}); using chapter-level fallback.`);
    excelMap = null;
}

// ...writes rates even when excelMap is null...
metadata.gstRatesLastUpdated = today;
```

- All 12,604 checked-in rate entries currently have `rateSource: "chapter-level"`.
- `data/metadata.json:4` says `gstRatesLastUpdated: "2026-07-27"`, although git history shows the rate content last materially entered on 2026-06-02.
- `.github/workflows/update-gst-rates.yml:33-37` uses `continue-on-error`, then may commit metadata-only changes; `force_update` can attempt an empty commit.
- README explicitly calls the mappings chapter-level and best effort. Preserve this disclaimer and make the schedule description honest.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm test -- --runInBand tests/update-gst-rates.test.js` | exit 0 |
| Types | `npm run typecheck` | exit 0 |
| Full tests | `npm test -- --runInBand` | exit 0 |
| No-op history check | `git diff --exit-code -- data/gst_rates.json` | exit 0 during tests/local dry runs |

## Scope

**In scope**:

- `scripts/update-gst-rates.js`
- `tests/update-gst-rates.test.js`
- `.github/workflows/update-gst-rates.yml`
- `data/metadata.json`
- `README.md` rate-source/update sections
- `index.d.ts`
- `tests/types.test.ts`
- `plans/README.md` status row only

**Out of scope**:

- Changing any rate value, chapter mapping, notification reference, or effective date.
- Claiming exact HSN-level legal accuracy.
- Scraping browser-only pages, bypassing anti-automation, or reverse-engineering private endpoints.
- Committing a new authoritative source URL unless it is directly documented by CBIC/GST and returns a stable machine-readable file.
- Releasing or publishing the package.

## Git workflow

- Branch: `codex/005-fail-closed-rate-refresh`
- Suggested commit: `fix: make GST rate refresh fail closed`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Separate generation from fallback policy

Refactor the updater into testable functions with dependency injection for download bytes, current date, and output paths. Keep the `require.main === module` guard introduced by plan 004.

Replace the hardcoded interactive-page URL with `process.env.GST_RATE_SOURCE_URL`. Absence of this variable must produce an actionable error and no writes. The workflow must pass `${{ vars.GST_RATE_SOURCE_URL }}` into the updater. Follow at most three redirects only when each redirect stays on the original configured hostname; reject cross-host redirects.

Scheduled/default execution must follow this state machine:

1. Download from a configured, explicitly authoritative spreadsheet URL.
2. Reject non-200 responses, redirects outside the allowed official host, unexpected content type/signature, oversized responses, empty workbooks, low row counts, duplicate normalized codes, non-finite/negative rates, and zero overlap with bundled HSN codes.
3. If any validation fails, write nothing and exit nonzero.
4. Build proposed rates only after validation succeeds.
5. Default to read-only check mode. Return whether validated proposed content differs without writing repository files.
6. Permit writes only with an explicit local/manual `--write` flag; write atomically only when proposed rate/provenance content differs.
7. Advance `gstRatesLastUpdated` only during an explicit material write, never for a scheduled check, failed check, or unchanged fallback regeneration.

Retain the chapter map as explicitly named static fallback data for existing runtime behavior, but do not automatically regenerate from it during scheduled refresh. If a manual fallback flag is retained, require an explicit CLI flag and label every result `chapter-level`; it must not advance authoritative verification metadata. The scheduled GitHub Action must never use `--write`.

**Verify**: `node --check scripts/update-gst-rates.js` → exit 0.

### Step 2: Correct current metadata without inventing verification

Keep backward-compatible `gstRatesLastUpdated` but set it to `2026-06-02`, the date current rate content first entered git, not the latest bot run. Add `gstRateSource: "chapter-level"` to metadata. Do not add a `lastVerified` date because no authoritative verification was evidenced during the audit.

Update `HsnStats` and `tests/types.test.ts` for `gstRateSource`. Keep `gstNotificationRef` unchanged.

**Verify**: `node -e "const m=require('./data/metadata.json'); if(m.gstRatesLastUpdated!=='2026-06-02'||m.gstRateSource!=='chapter-level') process.exit(1)"` → exit 0.

### Step 3: Add fail-closed tests

Extend `tests/update-gst-rates.test.js` with injected/fake downloader and temp-directory output tests. Cover:

- Download failure, timeout, non-200 response, invalid content type/signature, parse failure, empty data, insufficient rows, duplicates, invalid rates, and no HSN overlap all reject and leave rate/metadata files byte-for-byte unchanged.
- A valid authoritative workbook produces deterministic proposed entries; default/check mode performs no writes and reports whether content differs.
- An explicit `--write` run changes rates and metadata only when validated content materially differs.
- Reprocessing identical authoritative content performs no writes and does not advance the date in either mode.
- Explicit fallback mode, if retained, labels every entry `chapter-level` and cannot masquerade as an authoritative refresh.
- `main()` returns or propagates a nonzero failure rather than swallowing it.

Use only temp directories and local in-memory workbook buffers. Never hit the network in tests.

**Verify**: `npm test -- --runInBand tests/update-gst-rates.test.js` → exit 0; every failed validation asserts unchanged output files.

### Step 4: Correct workflow failure and commit behavior

Update `.github/workflows/update-gst-rates.yml` to a read-only detector so:

- Permissions use `contents: read` and `issues: write`; remove repository write permission.
- The updater receives `GST_RATE_SOURCE_URL` from the same-named GitHub Actions repository variable; a missing variable is a reported failed check, not a fallback refresh.
- The updater runs in explicit `--check` mode and never modifies or commits repository files.
- A validated material difference opens an issue containing only the workflow-run link and a request for manual review; do not attach or paste the external workbook or generated rate table.
- A failed validation/download opens the existing diagnostic issue and then leaves the job failed.
- An unchanged dataset exits successfully without an issue.
- Remove `force_update`, git configuration, commit, and push steps entirely.

Document the manual application command using explicit `--write`; a maintainer must inspect the resulting diff before committing it. The workflow must not run that command.

Do not broaden workflow permissions.

**Verify**: `! rg -n "contents: write|git commit|git push|--write|force_update" .github/workflows/update-gst-rates.yml` → exit 0 with no matches; the scheduled workflow has no repository-write path.

### Step 5: Make documentation match reality

Update README language from “refreshed weekly” to “checked weekly in read-only mode when an authoritative machine-readable source is configured.” Explain that the bundled file currently uses chapter-level fallback classifications generated on 2026-06-02, distinguish dataset update date from workflow check history, and document the explicit local/manual `--write` command plus required diff review. Preserve the legal verification warning.

**Verify**: `rg -n "checked weekly|chapter-level|2026-06-02|verify" README.md` → all concepts appear in the data-source section.

### Step 6: Run the repository baseline

**Verify**: `npm test -- --runInBand && npm run typecheck && git diff --check` → exit 0.

## Test plan

- Treat writes as a transaction: every failure-path test compares before/after bytes.
- Test behavior, not live external availability.
- Include deterministic successful, unchanged, failed, and explicit-fallback paths.
- Keep all rate values unchanged in committed `data/gst_rates.json`.

## Done criteria

- [ ] Scheduled/default failures cannot rewrite rates or metadata.
- [ ] Metadata no longer represents weekly fallback runs as rate updates.
- [ ] Workflow has read-only repository permissions and contains no commit, push, or `--write` path.
- [ ] Validated changes create a review issue rather than modifying the repository.
- [ ] Failed updater runs both report the issue and fail the job.
- [ ] README accurately describes current chapter-level provenance.
- [ ] Focused tests, full tests, and typecheck pass.
- [ ] `data/gst_rates.json` has no value changes.

## STOP conditions

- No authoritative, stable machine-readable source URL can be confirmed: keep the updater fail-closed and report that external configuration is required; do not invent or scrape a source.
- A proposed change alters any tax rate or notification interpretation.
- Correctness appears to require legal judgment about CBIC classifications.
- Workflow changes require broader GitHub permissions.
- Plan 004 has not removed vulnerable parser versions.

## Maintenance notes

`gstRatesLastUpdated` must describe material dataset content, not cron activity. GitHub Actions history is the audit trail for checks. Keep scheduled checks read-only even after an authoritative source is configured; applying tax data remains an explicit human-reviewed action. Future authoritative sources need documented ownership, validation thresholds, effective-date handling, and fixture-based tests.
