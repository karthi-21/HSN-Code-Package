# Plan 002: Support downward invoice round-off safely

> **Executor instructions**: Follow each step and verification gate. Stop on any listed STOP condition instead of broadening the change. Update the plan row in `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- gst.js tests/gst.test.js plans/README.md`
> If either file changed, compare the Current state excerpts with live code. A material mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-enforce-types-in-ci.md`
- **Category**: bug
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

Invoice totals legitimately round either upward or downward to a whole rupee. The current code calculates a negative `roundOff` for downward cases, then passes it to a helper that rejects all negative numbers. This converts valid invoice input into a runtime exception on a public monetary path.

## Current state

- `gst.js:10-17` uses one validator for both monetary inputs and signed intermediate results:

```js
function _assertNumber(value, name) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new TypeError(`${name} must be a number, got ${value}`);
    }
    if (value < 0) {
        throw new RangeError(`${name} must not be negative, got ${value}`);
    }
}
```

- `gst.js:156-158` creates a signed adjustment:

```js
const rawGrandTotal = acc.totalTaxableValue + acc.totalTax;
const grandTotal = applyRoundOffRules(Math.round(rawGrandTotal));
const roundOff = applyRoundOffRules(grandTotal - rawGrandTotal);
```

- `tests/gst.test.js:113-117` checks only an upward/integer outcome and never asserts a negative adjustment.
- Preserve four-space indentation and Jest `describe`/`test` style from `tests/gst.test.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm test -- --runInBand tests/gst.test.js` | exit 0, all GST tests pass |
| Types | `npm run typecheck` | exit 0 |
| Syntax | `node --check gst.js` | exit 0, no output |

## Scope

**In scope**:

- `gst.js`
- `tests/gst.test.js`
- `plans/README.md` status row only

**Out of scope**:

- Changing whole-rupee invoice rounding policy.
- Supporting negative taxable values, tax rates, or cess rates.
- Replacing floating-point arithmetic or changing the documented two-decimal algorithm.
- Changes to GSTR-1 summaries in `export.js`; plan 003 owns those.

## Git workflow

- Branch: `codex/002-fix-invoice-roundoff`
- Suggested commit: `fix: support downward invoice round-off`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Separate finite-number validation from non-negative validation

Introduce a small private rounding primitive that accepts any finite signed number and rejects non-numbers, `NaN`, and positive/negative infinity. Keep `_assertNumber` as the non-negative public-input validator, but tighten it to reject all non-finite values. `applyRoundOffRules` must continue calling the non-negative validator so its existing negative-input `RangeError` contract remains intact, then delegate the arithmetic to the private signed rounding primitive. Only the internal `roundOff` calculation may call the signed primitive directly.

Do not export either validator.

**Verify**: `node --check gst.js` → exit 0.

### Step 2: Add the downward-rounding regression tests

In `tests/gst.test.js`:

- Preserve the existing `applyRoundOffRules(-1)` test proving the public helper rejects negative amounts.
- Add an invoice case whose raw grand total has fractional rupees below the midpoint; assert the integer grand total, negative `roundOff`, and unchanged tax totals.
- Retain tests proving negative taxable amounts and rates throw `RangeError`.
- Add cases proving `NaN` and infinity throw `TypeError` rather than propagating invalid totals.

**Verify**: `npm test -- --runInBand tests/gst.test.js` → all tests pass, including at least four new assertions covering signed adjustment and non-finite input.

### Step 3: Run the full baseline

**Verify**: `npm test -- --runInBand && npm run typecheck && git diff --check` → exit 0.

## Test plan

Model new cases after `tests/gst.test.js:13-24` and `tests/gst.test.js:95-120`.

- Downward invoice adjustment returns a negative two-decimal `roundOff` through the private signed primitive.
- Upward adjustment still behaves as before.
- The public `applyRoundOffRules` helper continues rejecting negative arguments.
- Negative public tax inputs remain rejected.
- `NaN`, `Infinity`, and `-Infinity` cannot appear in results.

## Done criteria

- [ ] The previously throwing downward-rounding case returns an `InvoiceTotals` object.
- [ ] Internal `roundOff` can be negative while `applyRoundOffRules`, taxable values, and rates retain their non-negative public contract.
- [ ] Focused and full tests pass.
- [ ] Typecheck and syntax checks pass.
- [ ] Only in-scope files and the plan status row changed.

## STOP conditions

- Correcting the bug appears to require changing whether invoices round to whole rupees.
- The fix cannot be contained to a private signed-rounding primitive while preserving `applyRoundOffRules` negative-input behavior.
- The current implementation no longer routes `roundOff` through `applyRoundOffRules`.

## Maintenance notes

Keep the private signed rounding primitive separate from the public non-negative `applyRoundOffRules` contract. Future credit-note support would require an explicit product/API decision; this plan does not authorize negative invoice line values.
