# Plan 003: Reject invalid GSTR-1 summary inputs

> **Executor instructions**: Follow the plan exactly, run every verification command, and stop on any STOP condition. Update `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- export.js tests/export.test.js index.d.ts tests/types.test.ts README.md plans/README.md`
> If any path changed, reconcile the excerpts below with live code before proceeding. Material contract drift is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/001-enforce-types-in-ci.md`
- **Category**: bug / tests
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

`generateGSTR1Summary` produces tax-filing-oriented totals but currently turns missing or `NaN` values into zero and permits string concatenation or non-finite arithmetic. Those failures produce plausible output instead of an explicit error. The function needs a strict, documented input contract and useful result types.

## Current state

- `export.js:27-48` contains no per-item validation and uses truthiness defaults:

```js
const rate = item.gstRate != null ? item.gstRate : item.igstRate || 0;
const tv = item.taxableValue || 0;
const cessAmount = item.cessRate ? tv * item.cessRate / 100 : 0;
```

- `tests/export.test.js:29-43` checks grouping and non-array input only.
- `index.d.ts:201-203` requires `gstRate` but returns the unhelpful `object[]`, while runtime also accepts `igstRate`.
- Public numeric validators in `gst.js` are private. Keep `export.js` self-contained unless plan 002 has created an appropriate exported helper; do not expose an internal helper solely for this plan.
- Match the two-space indentation already used by `export.js` and `tests/export.test.js`.

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
- `README.md` GSTR-1 section only
- `plans/README.md` status row only

**Out of scope**:

- CSV formula handling; plan 007 owns it.
- Changing GST calculation formulas, rate grouping, output ordering, or rounding policy.
- Validating whether a supplied rate is legally correct for an HSN code.
- Adding runtime dependencies.

## Git workflow

- Branch: `codex/003-validate-gstr1-inputs`
- Suggested commit: `fix: validate GSTR-1 summary inputs`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Define the runtime input contract

Add private validation helpers in `export.js` and enforce these rules for every array element:

- Item must be a non-null, non-array object.
- `taxableValue` must be a finite number greater than or equal to zero; it is required and must never default to zero.
- Resolve the rate from `gstRate` when it is not `null`/`undefined`, otherwise from `igstRate`. At least one is required. The resolved rate must be a finite non-negative number.
- `cessRate` defaults only when it is `null`/`undefined`; when supplied, it must be a finite non-negative number.
- `isInterState` defaults to `false`; when supplied, it must be boolean.
- Error messages must include the zero-based item index and invalid field name without echoing whole input objects.

Replace all `|| 0` numeric fallbacks in this function with nullish/default logic after validation. Preserve valid zero values.

**Verify**: `node --check export.js` → exit 0.

### Step 2: Add explicit public TypeScript types

In `index.d.ts`, add:

- `GSTR1LineItem` describing the accepted runtime fields. Model the rate alternatives so at least one of `gstRate` or `igstRate` is required; do not leave both optional in a single loose interface.
- `GSTR1SummaryRow` with `taxRate`, `taxableValue`, `igst`, `cgst`, `sgst`, `cess`, `totalTax`, and `count`, all as numbers.
- Change `generateGSTR1Summary` to accept `ReadonlyArray<GSTR1LineItem>` and return `GSTR1SummaryRow[]`.

Extend `tests/types.test.ts` with one `gstRate` item, one legacy/runtime-compatible `igstRate` item, and a typed result row read. Do not introduce `any`.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Add regression and boundary tests

Extend `tests/export.test.js` with table-driven invalid cases for missing taxable value, missing both rate fields, numeric strings, negative numbers, `NaN`, infinities, invalid `isInterState`, and invalid cess. Assert the error class and that the message identifies the item index and field.

Add valid cases for zero taxable value, zero rate, zero cess, `igstRate` fallback, and mixed inter/intra-state groups. Preserve existing expected totals.

**Verify**: `npm test -- --runInBand tests/export.test.js` → exit 0; all new invalid cases throw and valid zero cases remain in the summary.

### Step 4: Document rejection behavior

In the README's `generateGSTR1Summary` section, document required fields, the `igstRate` compatibility alternative, defaults, and that malformed/non-finite/negative numeric input throws. Keep the legal-data disclaimer unchanged.

**Verify**: `rg -n "generateGSTR1Summary|igstRate|finite" README.md` → the function section contains the new contract.

### Step 5: Run the full baseline

**Verify**: `npm test -- --runInBand && npm run typecheck && git diff --check` → exit 0.

## Test plan

Follow `tests/export.test.js` structure. Cover:

- Existing grouping happy path.
- Required/non-negative/finite numeric fields.
- Preservation of numeric zero.
- Boolean-only `isInterState`.
- Both supported rate field names.
- Exact typed return shape in the TypeScript smoke test.

## Done criteria

- [ ] Invalid line items fail before any partial summary is returned.
- [ ] Zero values are accepted and not replaced by defaults.
- [ ] `generateGSTR1Summary` no longer returns `object[]` in TypeScript.
- [ ] Focused tests, full tests, and typecheck pass.
- [ ] README describes the runtime contract.
- [ ] Only in-scope files and plan status changed.

## STOP conditions

- Existing tests or documented clients require invalid/missing numeric fields to be treated as zero.
- Plan 001 has not landed and typecheck is not a required CI gate.
- Supporting `igstRate` conflicts with an explicit newer API decision in live documentation.
- Fixing input validation requires changing tax formulas or group ordering.

## Maintenance notes

Future fields added to GSTR-1 items must be validated before arithmetic and added to both public declarations and type smoke tests. Reviewers should reject truthiness-based numeric defaults on this path.
