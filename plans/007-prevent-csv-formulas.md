# Plan 007: Prevent spreadsheet formulas in CSV exports

> **Executor instructions**: Follow every step and verification gate. Implement defensive CSV handling only; do not broaden this into a general export rewrite. Stop on any STOP condition. Update `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- export.js tests/export.test.js index.d.ts tests/types.test.ts README.md plans/README.md`
> Plan 003 is expected to have changed these files. Reconcile those changes first; STOP if CSV escaping behavior or options have independently changed.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: `plans/003-validate-gstr1-inputs.md`
- **Category**: security
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

`exportToCSV` accepts arbitrary records and produces files intended for spreadsheet use, but it only quotes CSV syntax. Cells beginning with spreadsheet formula control characters can remain executable when opened by desktop spreadsheet software. The safe default should neutralize formulas while retaining an explicit opt-out for callers that require byte-preserving exports.

## Current state

- `export.js:3-19` converts every header and value through this helper:

```js
function escape(val) {
  const s = String(val == null ? '' : val);
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
```

- The helper handles delimiter, quote, and line-feed syntax but does not account for carriage returns or formula interpretation.
- `index.d.ts:196-199` exposes only `delimiter` and `headers` options.
- `tests/export.test.js:4-20` covers headers, comma quoting, empty arrays, and non-array input.
- Match two-space indentation used by `export.js` and its tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm test -- --runInBand tests/export.test.js` | exit 0 |
| Types | `npm run typecheck` | exit 0 |
| Full tests | `npm test -- --runInBand` | exit 0 |

## Scope

**In scope**:

- `export.js`
- `tests/export.test.js`
- `index.d.ts`
- `tests/types.test.ts`
- `README.md` export section only
- `plans/README.md` status row only

**Out of scope**:

- GSTR-1 validation or tax arithmetic; plan 003 owns it.
- Changing JSON export behavior.
- Adding a CSV library or runtime dependency.
- Claiming protection when a caller explicitly opts out.

## Git workflow

- Branch: `codex/007-prevent-csv-formulas`
- Suggested commit: `fix: prevent formulas in CSV exports`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Add a safe-by-default CSV option

Extend `exportToCSV` options with `preventFormulaInjection`, defaulting to `true`. Validate that a supplied value is boolean. Before standard CSV quoting, neutralize string cells whose first non-whitespace character is one of the spreadsheet formula-control characters (`=`, `+`, `-`, or `@`) or whose first character is a tab or carriage return. Prefix the cell with a single apostrophe, which spreadsheet programs display as literal content rather than evaluating.

Apply the same rule to explicit/default headers because headers are caller-controlled too. Do not modify numbers or booleans solely because their string representation contains punctuation later in the cell. Then apply normal CSV escaping, including both line feed and carriage return detection.

When `preventFormulaInjection: false`, preserve pre-plan output exactly except for the independent carriage-return CSV correctness fix.

**Verify**: `node --check export.js` → exit 0.

### Step 2: Add focused security and compatibility tests

Extend `tests/export.test.js` with table-driven cases for every dangerous leading character, leading whitespace before such a character, tab/carriage-return prefixes, header cells, and ordinary text containing the same punctuation later in the value. Assert literal output without invoking spreadsheet software.

Add an opt-out test proving `preventFormulaInjection: false` preserves the caller's original cell text. Add a carriage-return quoting test. Avoid including any network, shell, or external spreadsheet execution in tests.

**Verify**: `npm test -- --runInBand tests/export.test.js` → exit 0; default defenses and explicit opt-out both pass.

### Step 3: Update TypeScript and documentation

Add `preventFormulaInjection?: boolean` to the `exportToCSV` options type and exercise both boolean values in `tests/types.test.ts`. In the README export table, document that formula prevention defaults to true, how it changes affected cells, and that disabling it is appropriate only when the caller controls all exported values.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Run the baseline

**Verify**: `npm test -- --runInBand && npm run typecheck && git diff --check` → exit 0.

## Test plan

- Preserve all existing CSV tests.
- Test all leading formula-control categories without executing generated content.
- Test leading whitespace, headers, safe punctuation within text, newlines, carriage returns, quotes, delimiters, nullish values, and opt-out behavior.
- Verify new option typing in `tests/types.test.ts`.

## Done criteria

- [ ] Formula-like header/value cells are neutralized by default.
- [ ] Ordinary text and numeric values retain existing output.
- [ ] Explicit opt-out is typed, documented, and tested.
- [ ] Carriage-return cells are validly quoted.
- [ ] Focused tests, full tests, and typecheck pass.
- [ ] No runtime dependency is added.

## STOP conditions

- Plan 003 has not landed and in-scope files contain unresolved overlapping edits.
- Repository documentation or an existing contract requires byte-for-byte default CSV output for formula-leading user data.
- The proposed defense would evaluate or execute generated CSV in tests.
- A fix requires adding a runtime dependency.

## Maintenance notes

CSV quoting and spreadsheet formula prevention are different layers; future refactors must retain both. Reviewers should scrutinize any change that disables formula prevention by default or sanitizes only values while leaving headers exposed.
