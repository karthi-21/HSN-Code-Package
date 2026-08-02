# Plan 008: Prevent mutation of cached public datasets

> **Executor instructions**: Follow the plan step by step and run all verification gates. Preserve cache reuse and lookup behavior while making canonical data immutable. Stop on any STOP condition. Update `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- index.js sac.js index.d.ts tests/index.test.js tests/sac.test.js tests/gst-rates.test.js tests/types.test.ts README.md plans/README.md`
> If in-scope code changed, compare Current state with live code. Material cache/API drift is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-enforce-types-in-ci.md`
- **Category**: tech-debt / bug
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

The package returns cached JSON arrays and objects directly. A consumer can mutate one returned HSN, SAC, rate, or metadata object and silently change later validations/searches for every module user in the same process. The fix must prevent shared-state corruption without allocating deep copies of 12,604 entries on every lookup.

## Current state

- `index.js:5-12` caches the required HSN JSON and `getAllHsn` returns it directly:

```js
let _cache = null;
function _load() {
    if (!_cache) {
        _cache = require(path.join(__dirname, 'data', 'hsn_codes.json'));
    }
    return _cache;
}

function getAllHsn() {
    return _load();
}
```

- `index.js:14-20` does the same for GST rates, and `getGstRateByCode` returns an internal object.
- `index.js:127-129` returns the mutable object from Node's JSON require cache for metadata.
- `sac.js:5-11` and `getAllSac` expose the SAC cache directly.
- Search functions return new arrays but reuse the same mutable entry objects.
- `tests/index.test.js:31-33` intentionally expects repeated `getAllHsn` calls to share an array reference. Preserve this performance property.
- TypeScript declarations currently describe mutable `HsnCode[]` and `SacCode[]`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm test -- --runInBand tests/index.test.js tests/sac.test.js tests/gst-rates.test.js` | exit 0 |
| Types | `npm run typecheck` | exit 0 |
| Full tests | `npm test -- --runInBand` | exit 0 |

## Scope

**In scope**:

- `index.js`
- `sac.js`
- `index.d.ts`
- `tests/index.test.js`
- `tests/sac.test.js`
- `tests/gst-rates.test.js`
- `tests/types.test.ts`
- `README.md` API behavior notes only
- `plans/README.md` status row only

**Out of scope**:

- Replacing linear searches with `Map` indexes.
- Changing result ordering, matching semantics, code normalization, or cache lifetime.
- Freezing caller-provided arrays passed to calculation/export functions.
- Changing package version or publishing a release.

## Git workflow

- Branch: `codex/008-freeze-public-data`
- Suggested commit: `fix: protect cached datasets from mutation`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Add one-time shallow-record/deep-collection freezing

Add a private helper in `index.js` that freezes every top-level record in a JSON array and then freezes the array. Use it exactly once when populating `_cache` and `_ratesCache`. Data records are flat primitives, so recursive object traversal is unnecessary.

Cache metadata in a private variable, freeze its top-level object on first load, and return that same frozen object from `getStats`.

Add the equivalent one-time record/array freezing in `sac.js`. Ensure `getCodeDetails` cannot load a separate mutable HSN view: either reuse a shared immutable loader without introducing a circular dependency or freeze the directly required HSN array/records before reading. Do not export cache helpers.

Preserve repeated-call identity for `getAllHsn` and `getAllSac`.

**Verify**: `node --check index.js && node --check sac.js` → exit 0.

### Step 2: Add mutation regression tests

Use strict-mode tests and cover:

- HSN array push/replacement attempts fail and length remains unchanged.
- HSN entry property mutation fails and exact lookup still finds the original code.
- SAC array/entry mutation fails and exact lookup remains correct.
- A rate entry returned by `getGstRateByCode` cannot be changed.
- Metadata returned by `getStats` cannot be changed.
- Search/chapter result arrays themselves remain caller-owned and can be reordered without changing the cache, while their canonical entries remain immutable.
- Repeated `getAllHsn`/`getAllSac` calls still return the same reference.

Do not leave mutations in global module state between tests; assertions must prove state remains unchanged.

**Verify**: `npm test -- --runInBand tests/index.test.js tests/sac.test.js tests/gst-rates.test.js` → exit 0.

### Step 3: Make TypeScript mutability honest

Mark fields on immutable canonical data records as `readonly`, including `HsnCode`, `SacCode`, `GstRate`, and `HsnStats`. Return `ReadonlyArray<...>` from `getAllHsn` and `getAllSac`. Search functions may continue returning mutable arrays containing readonly records. Leave `CodeDetails` mutable because `getCodeDetails` returns a defensive copy rather than a canonical cached record.

Update affected local type assignments in `tests/types.test.ts` from mutable arrays to `ReadonlyArray`. Add compile-time use that reads fields and collections. Do not add failing `@ts-expect-error` cases unless the repository's single-file typecheck reliably includes them.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Document the immutable-data contract

Add a concise README note near HSN/SAC lookup APIs: bundled records are immutable shared data; callers that need editable records should clone them. Do not promise deep immutability for arbitrary future nested fields; describe the current record contract.

**Verify**: `rg -n "immutable|clone" README.md` → API note is present.

### Step 5: Run performance and baseline checks

Use a direct runtime check to prove cache identity and freezing, then run the full suite. Do not add a benchmark dependency.

**Verify**: `node -e "const h=require('./'); const a=h.getAllHsn(); if(a!==h.getAllHsn()||!Object.isFrozen(a)||!Object.isFrozen(a[0])||!Object.isFrozen(h.getStats())) process.exit(1)" && npm test -- --runInBand && npm run typecheck` → exit 0.

## Test plan

- Extend existing dataset-specific suites; do not create a separate cache test framework.
- Test array, record, rate, and metadata mutation boundaries.
- Prove cached identity/performance semantics remain unchanged.
- Prove derived result arrays are independently reorderable but entries are protected.
- Update TypeScript smoke assignments for readonly arrays and records.

## Done criteria

- [ ] Canonical HSN, SAC, rate, and metadata objects are frozen once at load.
- [ ] Consumer mutation attempts cannot alter later lookup results.
- [ ] Repeated complete-dataset calls retain stable reference identity.
- [ ] Type declarations communicate readonly records and complete datasets.
- [ ] Focused tests, full tests, typecheck, and syntax checks pass.
- [ ] No JSON data files changed and no per-call deep cloning was introduced.

## STOP conditions

- Live code or documented behavior explicitly supports consumers mutating returned canonical entries.
- A required fix would deep-clone all 12,604 records on every lookup.
- Freezing causes a documented supported integration to fail and no compatible immutable boundary is available.
- Plan 001 has not landed and readonly declaration changes are not CI-gated.

## Maintenance notes

Any future nested object added to a dataset record requires revisiting the freeze helper; the current one-level record freeze is sufficient only because all shipped fields are primitives. Reviewers should ensure new APIs do not bypass immutable loaders by requiring JSON files directly.
