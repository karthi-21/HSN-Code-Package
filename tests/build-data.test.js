'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const xlsx = require('xlsx');
const { parseHsnWorkbook } = require('../scripts/build-data');

const tempDirs = [];

function writeWorkbook(rows, sheetName = 'Sheet1') {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsn-build-data-'));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'fixture.xlsx');
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, sheetName);
    xlsx.writeFile(workbook, sourcePath);
    return sourcePath;
}

afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

describe('parseHsnWorkbook', () => {
    test('skips three header rows and reads trimmed B/C values in order', () => {
        const sourcePath = writeWorkbook([
            ['title'],
            ['subtitle'],
            ['Code', 'Description'],
            [' 01011010 ', ' Pure-bred breeding animals '],
            ['', 'missing code'],
            ['01011020', ''],
            [' 52010011 ', ' Cotton, not carded or combed ']
        ]);

        expect(parseHsnWorkbook(sourcePath)).toEqual([
            { code: '01011010', description: 'Pure-bred breeding animals' },
            { code: '52010011', description: 'Cotton, not carded or combed' }
        ]);
    });

    test('requires the expected Sheet1 worksheet', () => {
        const sourcePath = writeWorkbook([['header']], 'Other');
        expect(() => parseHsnWorkbook(sourcePath)).toThrow('Sheet1');
    });

    test('matches the committed HSN data for the repository workbook', () => {
        const sourcePath = path.join(__dirname, '..', 'code_list.xlsx');
        const expected = require('../data/hsn_codes.json');
        expect(parseHsnWorkbook(sourcePath)).toEqual(expected);
    });
});
