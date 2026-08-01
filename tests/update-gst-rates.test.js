'use strict';

const xlsx = require('xlsx');
const { parseExcel } = require('../scripts/update-gst-rates');

function workbookBuffer(rows) {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Rates');
    return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

describe('parseExcel', () => {
    test.each([
        ['HSN', 'Rate'],
        ['hsn', 'rate'],
        ['Code', 'IGST'],
        ['code', 'igst'],
        ['HSN Code', 'GST Rate']
    ])('supports the %s and %s header aliases', (codeHeader, rateHeader) => {
        const map = parseExcel(workbookBuffer([
            [codeHeader, rateHeader],
            ['52010011', '18%']
        ]));
        expect(map.get('52010011')).toBe(18);
    });

    test('parses numeric rates and normalizes and pads codes', () => {
        const map = parseExcel(workbookBuffer([
            ['HSN', 'Rate'],
            [1234, 5],
            ['HSN 5201.0011', '12%']
        ]));
        expect([...map]).toEqual([
            ['00001234', 5],
            ['52010011', 12]
        ]);
    });

    test('skips malformed rows', () => {
        const map = parseExcel(workbookBuffer([
            ['HSN', 'Rate'],
            ['', 18],
            ['not-a-code', 18],
            ['52010011', 'not-a-rate'],
            ['52010012', 5]
        ]));
        expect([...map]).toEqual([['52010012', 5]]);
    });

    test('returns an empty map for a workbook without data rows', () => {
        const map = parseExcel(workbookBuffer([['HSN', 'Rate']]));
        expect(map).toEqual(new Map());
    });
});
