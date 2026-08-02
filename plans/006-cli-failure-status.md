# Plan 006: Return failing CLI statuses for invalid identifiers

> **Executor instructions**: Follow all steps and verification gates. Update the status row in `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat a4b5782..HEAD -- bin/cli.js tests/cli.test.js README.md plans/README.md`
> If the CLI changed materially, stop and reconcile the intended command contract before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-enforce-types-in-ci.md`
- **Category**: bug / tests
- **Planned at**: commit `a4b5782`, 2026-08-01

## Why this matters

The CLI prints an invalid HSN or GSTIN message but exits successfully. Shell scripts, CI jobs, and validation pipelines therefore cannot distinguish valid identifiers from validation failures using standard process status. The display text can remain unchanged while invalid results return a nonzero status.

## Current state

- `bin/cli.js:54-64` prints an invalid HSN message and then breaks from the switch without setting failure status.
- `bin/cli.js:86-99` behaves the same for invalid GSTIN values.

```js
} else {
  console.log(red(`✗ Invalid HSN code: ${code}`));
}
break;
```

- Missing arguments and unknown commands already use `process.exit(1)`; preserve this convention.
- There are no CLI integration tests. Existing tests use Jest under `tests/`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm test -- --runInBand tests/cli.test.js` | exit 0 |
| Syntax | `node --check bin/cli.js` | exit 0 |
| Full tests | `npm test -- --runInBand && npm run typecheck` | exit 0 |

## Scope

**In scope**:

- `bin/cli.js`
- `tests/cli.test.js` (create)
- `README.md` CLI section only
- `plans/README.md` status row only

**Out of scope**:

- Replacing the hand-written argument parser.
- Changing command names, colors, success output, or result limits.
- Deciding exit semantics for empty search results or export results; only identifier validation commands are covered.

## Git workflow

- Branch: `codex/006-cli-failure-status`
- Suggested commit: `fix: return nonzero status for invalid CLI identifiers`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Set failure status on invalid validation results

For the invalid branch of `hsn validate` and `hsn gstin`, keep the current user-facing message and set `process.exitCode = 1` before leaving the case. Prefer `exitCode` over immediate `process.exit` so buffered output can flush. Valid identifiers must retain status 0.

**Verify**: `node --check bin/cli.js` → exit 0.

### Step 2: Add process-level CLI tests

Create `tests/cli.test.js` using `child_process.spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' })`. Cover:

- Valid HSN: status 0 and valid message.
- Invalid HSN: status 1 and invalid message.
- Valid GSTIN: status 0 and valid message.
- Invalid GSTIN: status 1 and error message.
- Missing argument and unknown command remain status 1.
- `help` remains status 0.

Do not snapshot ANSI codes; strip them or assert stable text fragments.

**Verify**: `npm test -- --runInBand tests/cli.test.js` → exit 0; all child-process status assertions pass.

### Step 3: Document automation semantics

Add one sentence to the README CLI section stating that validation commands exit 0 for valid identifiers and 1 for invalid input/usage.

**Verify**: `rg -n "exit.*0|status.*0" README.md` → one clear statement in the CLI section.

### Step 4: Run the baseline

**Verify**: `npm test -- --runInBand && npm run typecheck && git diff --check` → exit 0.

## Test plan

Use real child processes so tests verify observable exit codes rather than mocked internals. Use known identifiers already present in `tests/index.test.js` and `tests/gstin.test.js`; do not introduce network fixtures.

## Done criteria

- [ ] Invalid HSN and GSTIN validations return status 1.
- [ ] Valid validations and help return status 0.
- [ ] Existing messages remain recognizable.
- [ ] Focused tests, full tests, typecheck, and syntax checks pass.
- [ ] Only in-scope files and plan status changed.

## STOP conditions

- A documented CLI contract explicitly requires invalid identifiers to exit 0.
- Tests cannot invoke the executable without changing package installation behavior.
- The fix appears to require a broad CLI parser rewrite.

## Maintenance notes

Future machine-oriented CLI commands should define exit status independently from human-readable output. Reviewers should require process-level tests for any new command that claims to validate data.
