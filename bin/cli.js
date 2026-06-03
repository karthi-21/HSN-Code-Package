#!/usr/bin/env node
'use strict';

const {
  searchHsn, getHsnByExactCode, isValidHsnCode, getStats,
  getChapterSummary
} = require('../index');
const { validateGSTIN, getGSTINComponents } = require('../gstin');
const { searchSac } = require('../sac');
const { exportToCSV } = require('../export');

const args = process.argv.slice(2);
const command = args[0];

function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function red(s) { return `\x1b[31m${s}\x1b[0m`; }
function dim(s) { return `\x1b[2m${s}\x1b[0m`; }

function printHelp() {
  console.log(`
${bold('hsn')} — HSN/SAC code lookup and GST utilities

${bold('USAGE')}
  hsn search <query> [--limit N] [--type contains|startsWith|exact]
  hsn validate <code>
  hsn chapter <chapter>
  hsn stats
  hsn gstin <gstin>
  hsn sac <query> [--limit N]
  hsn export <query> [--format csv|json]
  hsn help
`);
}

function getFlag(name, defaultVal) {
  const idx = args.indexOf(name);
  if (idx === -1) return defaultVal;
  return args[idx + 1];
}

switch (command) {
  case 'search': {
    const query = args[1];
    if (!query) { console.error('Usage: hsn search <query>'); process.exit(1); }
    const limit = parseInt(getFlag('--limit', '20'), 10);
    const matchType = getFlag('--type', 'contains');
    const results = searchHsn(query, { limit, matchType });
    if (results.length === 0) { console.log(red('No results found.')); break; }
    console.log(bold(`Found ${results.length} results for "${query}":\n`));
    results.forEach(r => console.log(`  ${green(r.code.padEnd(12))} ${r.description}`));
    break;
  }
  case 'validate': {
    const code = args[1];
    if (!code) { console.error('Usage: hsn validate <code>'); process.exit(1); }
    if (isValidHsnCode(code)) {
      const entry = getHsnByExactCode(code);
      console.log(green(`✓ Valid HSN code: ${code}`));
      console.log(`  Description: ${entry.description}`);
    } else {
      console.log(red(`✗ Invalid HSN code: ${code}`));
    }
    break;
  }
  case 'chapter': {
    const ch = args[1];
    if (!ch) { console.error('Usage: hsn chapter <chapter>'); process.exit(1); }
    const summary = getChapterSummary(ch);
    if (!summary) { console.log(red(`No codes found for chapter ${ch}`)); break; }
    console.log(bold(`Chapter ${summary.chapter}: ${summary.totalCodes} codes\n`));
    summary.codes.slice(0, 20).forEach(r => console.log(`  ${green(r.code.padEnd(12))} ${r.description}`));
    if (summary.totalCodes > 20) console.log(dim(`  ... and ${summary.totalCodes - 20} more`));
    break;
  }
  case 'stats': {
    const s = getStats();
    console.log(bold('\nHSN Dataset Stats'));
    console.log(`  Version:      ${s.version}`);
    console.log(`  Last Updated: ${s.lastUpdated}`);
    console.log(`  Total Codes:  ${s.totalCodes}`);
    console.log(`  Chapters:     ${s.chapterCount}`);
    console.log(`  Source:       ${s.source}\n`);
    break;
  }
  case 'gstin': {
    const gstin = args[1];
    if (!gstin) { console.error('Usage: hsn gstin <gstin>'); process.exit(1); }
    const result = validateGSTIN(gstin);
    if (result.isValid) {
      const c = getGSTINComponents(gstin);
      console.log(green(`✓ Valid GSTIN: ${gstin.toUpperCase()}`));
      console.log(`  State:         ${c.stateName} (${c.stateCode})`);
      console.log(`  PAN:           ${c.pan}`);
      console.log(`  Entity Number: ${c.entityNumber}`);
      console.log(`  Check Digit:   ${c.checkDigit}`);
    } else {
      console.log(red(`✗ Invalid GSTIN: ${result.error}`));
    }
    break;
  }
  case 'sac': {
    const query = args[1];
    if (!query) { console.error('Usage: hsn sac <query>'); process.exit(1); }
    const limit = parseInt(getFlag('--limit', '20'), 10);
    const results = searchSac(query, { limit });
    if (results.length === 0) { console.log(red('No SAC results found.')); break; }
    console.log(bold(`Found ${results.length} SAC results for "${query}":\n`));
    results.forEach(r => console.log(`  ${green(r.code.padEnd(10))} ${r.description}`));
    break;
  }
  case 'export': {
    const query = args[1];
    if (!query) { console.error('Usage: hsn export <query>'); process.exit(1); }
    const fmt = getFlag('--format', 'csv');
    const results = searchHsn(query, { limit: 0 });
    if (fmt === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(exportToCSV(results));
    }
    break;
  }
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
