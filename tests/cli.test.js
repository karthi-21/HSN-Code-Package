'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');

function runCli(...args) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' });
}

describe('CLI exit status', () => {
  test('valid HSN exits zero and prints the validation message', () => {
    const result = runCli('validate', '52010011');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Valid HSN code: 52010011');
  });

  test('invalid HSN exits one and preserves the validation message', () => {
    const result = runCli('validate', '00000000');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Invalid HSN code: 00000000');
  });

  test('valid GSTIN exits zero', () => {
    const result = runCli('gstin', '27AAPFU0939F1ZV');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Valid GSTIN: 27AAPFU0939F1ZV');
  });

  test('invalid GSTIN exits one and prints the error', () => {
    const result = runCli('gstin', '27AAPFU0939F1ZX');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Invalid GSTIN:');
  });

  test('missing required argument exits one', () => {
    const result = runCli('validate');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: hsn validate <code>');
  });

  test('unknown command exits one', () => {
    const result = runCli('unknown');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command: unknown');
  });

  test('help exits zero', () => {
    const result = runCli('help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('USAGE');
  });
});
