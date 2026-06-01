'use strict';
/**
 * Build-time script: converts code_list.xlsx → data/hsn_codes.json
 * Run once during development or CI: node scripts/build-data.js
 * The output JSON is committed and shipped with the package — no Excel parsing at runtime.
 */

const path = require('path');
const fs = require('fs');
const excelToJson = require('convert-excel-to-json');

const ROOT = path.join(__dirname, '..');
const SOURCE_XLSX = path.join(ROOT, 'code_list.xlsx');
const OUTPUT_DIR = path.join(ROOT, 'data');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'hsn_codes.json');
const METADATA_JSON = path.join(OUTPUT_DIR, 'metadata.json');

if (!fs.existsSync(SOURCE_XLSX)) {
    console.error(`ERROR: Source file not found: ${SOURCE_XLSX}`);
    process.exit(1);
}

console.log('Reading:', SOURCE_XLSX);

const raw = excelToJson({
    sourceFile: SOURCE_XLSX,
    header: { rows: 3 },
    columnToKey: { B: 'code', C: 'description' }
});

const codes = (raw.Sheet1 || [])
    .filter(row => row.code !== undefined && row.description !== undefined)
    .map(row => ({
        code: String(row.code).trim(),
        description: String(row.description).trim()
    }));

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(codes, null, 2), 'utf8');

const chapters = new Set(codes.map(c => c.code.slice(0, 2)));
const metadata = {
    version: '2.0.0',
    lastUpdated: new Date().toISOString().slice(0, 10),
    totalCodes: codes.length,
    chapterCount: chapters.size,
    source: 'CBIC / WCO Harmonized System Nomenclature'
};

fs.writeFileSync(METADATA_JSON, JSON.stringify(metadata, null, 2), 'utf8');

console.log(`Done. ${codes.length} HSN codes across ${chapters.size} chapters written to data/`);
