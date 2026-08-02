# Plan 001: Enforce public type declarations in CI and publishing

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the STOP conditions occurs, stop and report; do not improvise. When done, update this plan's status row in `plans/README.md`, unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- .github/workflows/ci.yml .github/workflows/publish.yml index.d.ts tests/types.test.ts plans/README.md`
> If any in-scope file changed, compare the Current state excerpts with live code before proceeding. A material mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

The package publishes a hand-maintained `index.d.ts`, but neither pull-request CI nor the release workflow runs the existing typecheck command. The declaration file already omits runtime GST metadata and a merged rate property. Making type verification mandatory prevents future JavaScript/type drift from reaching npm and establishes a reliable gate for the plans that follow.

## Current state

- `package.json:20-24` already defines `npm run typecheck`; do not replace this command.
- `.github/workflows/ci.yml:27-31` installs dependencies and runs only `npm test`.
- `.github/workflows/publish.yml:18-19` runs only tests before publishing.
- `data/metadata.json` contains `gstRatesLastUpdated` and `gstNotificationRef`, but `index.d.ts:27-33` currently declares:

```ts
export interface HsnStats {
    version: string;
    lastUpdated: string;
    totalCodes: number;
    chapterCount: number;
    source: string;
}
```

- `getHsnByExactCodeWithRate` spreads the complete rate object into its return value, but `index.d.ts:146-153` omits `notificationRef`:

```ts
export interface HsnCodeWithRate extends HsnCode {
    igstRate?: number;
    cgstRate?: number;
    sgstRate?: number;
    cessRate?: number;
    rateSource?: string;
    effectiveFrom?: string;
}
```

- Test style uses a compile-only smoke file with explicit assignments in `tests/types.test.ts`; extend that pattern.
- Workflow style uses short named steps in CI and direct `run` steps in publishing. Match the local file rather than reformatting unrelated YAML.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Types | `npm run typecheck` | exit 0, no diagnostics |
| Tests | `npm test -- --runInBand` | exit 0, all suites pass |
| YAML diff | `git diff --check -- .github/workflows/ci.yml .github/workflows/publish.yml` | exit 0, no output |

## Scope

**In scope**:

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`
- `index.d.ts`
- `tests/types.test.ts`
- `plans/README.md` status row only

**Out of scope**:

- Runtime JavaScript and JSON data files.
- Changing `engines.node`, the Node matrix, package version, or module format.
- Adding a linter, formatter, or new type-test framework.

## Git workflow

- Branch: `codex/001-enforce-types-in-ci`
- Use conventional commit style matching the repository, for example `fix: enforce typecheck before publish`.
- Do not push or open a pull request unless explicitly instructed.

## Steps

### Step 1: Complete the declarations for current runtime metadata

Add `gstRatesLastUpdated: string` and `gstNotificationRef: string` to `HsnStats`. Add `notificationRef?: string` to `HsnCodeWithRate`. Do not rename existing fields or make currently optional rate fields required.

Extend `tests/types.test.ts` with property reads assigned to `string` variables for both metadata fields and the optional merged `notificationRef`. Add those bindings to the existing final `void` expression.

**Verify**: `npm run typecheck` → exit 0 with no TypeScript diagnostics.

### Step 2: Add typecheck to pull-request CI

In `.github/workflows/ci.yml`, add a named step after the test step that runs `npm run typecheck`. Keep it inside every Node matrix job so the declared `engines`-compatible syntax is exercised on each currently tested runtime.

**Verify**: `rg -n "npm run typecheck" .github/workflows/ci.yml` → exactly one match in the test job.

### Step 3: Block publishing when declarations fail

In `.github/workflows/publish.yml`, add `npm run typecheck` to the pre-publish `test` job after `npm test`. Do not duplicate it in the `publish` job; the `needs: test` dependency is the release gate.

**Verify**: `rg -n "npm run typecheck" .github/workflows/publish.yml` → exactly one match before the publish job.

### Step 4: Run the repository baseline

Run the full JavaScript suite and typecheck. Confirm no unrelated files were changed.

**Verify**: `npm test -- --runInBand && npm run typecheck && git diff --check` → exit 0; all tests pass and no whitespace errors are reported.

## Test plan

- Extend `tests/types.test.ts`; do not create a new framework.
- Prove `getStats()` exposes typed GST freshness/reference fields.
- Prove `getHsnByExactCodeWithRate()` exposes an optional typed `notificationRef`.
- Preserve every existing type assignment.

## Done criteria

- [ ] `npm test -- --runInBand` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] Both CI workflows contain the typecheck gate in the intended pre-publish/test job.
- [ ] Runtime files and package versions are unchanged.
- [ ] Only in-scope files and the plan status row are modified.

## STOP conditions

- The runtime metadata no longer contains either planned field.
- `getHsnByExactCodeWithRate` no longer merges the rate object.
- Adding the workflow gate requires changing secrets, permissions, or release triggers.
- Any existing type assignment fails for a reason unrelated to the added fields.

## Maintenance notes

Any future public JavaScript export or return-field change must update `index.d.ts` and `tests/types.test.ts` in the same pull request. Reviewers should confirm the publish job still depends on the job that runs both Jest and TypeScript.
