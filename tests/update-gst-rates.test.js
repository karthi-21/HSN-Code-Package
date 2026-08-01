'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const xlsx = require('xlsx');
const { downloadExcel, parseExcel, refreshRates, main } = require('../scripts/update-gst-rates');

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const tempDirs = [];

function workbookBuffer(rows) {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Rates');
    return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

function downloadedWorkbook(rows) {
    return { buffer: workbookBuffer(rows), contentType: XLSX_CONTENT_TYPE };
}

function rateEntry(code, igstRate, rateSource = 'chapter-level') {
    return {
        code,
        igstRate,
        cgstRate: igstRate / 2,
        sgstRate: igstRate / 2,
        cessRate: 0,
        rateSource,
        effectiveFrom: '2025-09-22',
        notificationRef: 'Notification No. 09/2025-CT(Rate)'
    };
}

function createFixture() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsn-rate-refresh-'));
    tempDirs.push(tempDir);
    const hsnFile = path.join(tempDir, 'hsn_codes.json');
    const ratesFile = path.join(tempDir, 'gst_rates.json');
    const metadataFile = path.join(tempDir, 'metadata.json');
    const hsnCodes = [
        { code: '52010011', description: 'Cotton one' },
        { code: '52010012', description: 'Cotton two' },
        { code: '1011010', description: 'Horse' }
    ];
    const rates = [
        rateEntry('52010011', 5),
        rateEntry('52010012', 5),
        rateEntry('1011010', 0)
    ];
    const metadata = {
        version: '2.3.0',
        lastUpdated: '2026-06-02',
        gstRatesLastUpdated: '2026-06-02',
        gstRateSource: 'chapter-level',
        gstNotificationRef: 'Notification No. 09/2025-CT(Rate) dated 17 Sep 2025'
    };
    fs.writeFileSync(hsnFile, JSON.stringify(hsnCodes));
    fs.writeFileSync(ratesFile, JSON.stringify(rates));
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + '\n');
    return { hsnFile, ratesFile, metadataFile };
}

function fixtureBytes(fixture) {
    return {
        rates: fs.readFileSync(fixture.ratesFile),
        metadata: fs.readFileSync(fixture.metadataFile)
    };
}

function expectBytesUnchanged(fixture, before) {
    expect(fs.readFileSync(fixture.ratesFile)).toEqual(before.rates);
    expect(fs.readFileSync(fixture.metadataFile)).toEqual(before.metadata);
}

function refreshOptions(fixture, download, overrides) {
    return {
        sourceUrl: 'https://example.gov.in/rates.xlsx',
        download,
        hsnFile: fixture.hsnFile,
        ratesFile: fixture.ratesFile,
        metadataFile: fixture.metadataFile,
        minimumRows: 2,
        now: () => new Date('2026-08-02T00:00:00Z'),
        ...overrides
    };
}

function fakeGet(responses) {
    let index = 0;
    return (_url, _options, callback) => {
        const request = new EventEmitter();
        request.destroy = error => request.emit('error', error);
        process.nextTick(() => {
            const responseSpec = responses[index++];
            if (responseSpec.timeout) {
                request.emit('timeout');
                return;
            }
            const response = new EventEmitter();
            response.statusCode = responseSpec.statusCode;
            response.headers = responseSpec.headers || {};
            response.resume = jest.fn();
            callback(response);
            if (responseSpec.body) response.emit('data', responseSpec.body);
            response.emit('end');
        });
        return request;
    };
}

afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

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

    test('rejects malformed rows, duplicate codes, and invalid rates', () => {
        expect(() => parseExcel(workbookBuffer([
            ['HSN', 'Rate'],
            ['not-a-code', 18]
        ]))).toThrow('invalid HSN code');
        expect(() => parseExcel(workbookBuffer([
            ['HSN', 'Rate'],
            ['1234', 5],
            ['00001234', 12]
        ]))).toThrow('Duplicate normalized HSN code');
        expect(() => parseExcel(workbookBuffer([
            ['HSN', 'Rate'],
            ['52010011', -1]
        ]))).toThrow('invalid GST rate');
        expect(() => parseExcel(workbookBuffer([
            ['HSN', 'Rate'],
            ['52010011', 'Infinity']
        ]))).toThrow('invalid GST rate');
    });

    test('returns an empty map for a workbook without data rows', () => {
        expect(parseExcel(workbookBuffer([['HSN', 'Rate']]))).toEqual(new Map());
    });
});

describe('downloadExcel', () => {
    test('follows a same-host redirect', async () => {
        const result = await downloadExcel('https://example.gov.in/start', {
            get: fakeGet([
                { statusCode: 302, headers: { location: '/rates.xlsx' } },
                { statusCode: 200, headers: { 'content-type': XLSX_CONTENT_TYPE }, body: Buffer.from('PK workbook') }
            ])
        });
        expect(result.buffer).toEqual(Buffer.from('PK workbook'));
        expect(result.contentType).toBe(XLSX_CONTENT_TYPE);
    });

    test('rejects cross-host redirects, timeouts, and non-200 responses', async () => {
        await expect(downloadExcel('https://example.gov.in/start', {
            get: fakeGet([{ statusCode: 302, headers: { location: 'https://other.gov.in/rates.xlsx' } }])
        })).rejects.toThrow('Cross-host redirect rejected');
        await expect(downloadExcel('https://example.gov.in/start', {
            get: fakeGet([{ timeout: true }])
        })).rejects.toThrow('Request timed out');
        await expect(downloadExcel('https://example.gov.in/start', {
            get: fakeGet([{ statusCode: 503 }])
        })).rejects.toThrow('Unexpected status code 503');
    });

    test('rejects more than three redirects', async () => {
        await expect(downloadExcel('https://example.gov.in/start', {
            get: fakeGet([
                { statusCode: 302, headers: { location: '/one' } },
                { statusCode: 302, headers: { location: '/two' } },
                { statusCode: 302, headers: { location: '/three' } },
                { statusCode: 302, headers: { location: '/four' } }
            ])
        })).rejects.toThrow('Too many redirects');
    });
});

describe('refreshRates', () => {
    const validRows = [
        ['HSN', 'Rate'],
        ['52010011', 18],
        ['52010012', '12%']
    ];

    test('check mode reports material differences without writing', async () => {
        const fixture = createFixture();
        const before = fixtureBytes(fixture);
        const writeAtomic = jest.fn();
        const result = await refreshRates(refreshOptions(
            fixture,
            async () => downloadedWorkbook(validRows),
            { writeAtomic }
        ));
        expect(result).toEqual({ changed: true, rateRows: 2, overlap: 2 });
        expect(writeAtomic).not.toHaveBeenCalled();
        expectBytesUnchanged(fixture, before);
    });

    test('explicit write is deterministic and advances metadata only for changed content', async () => {
        const fixture = createFixture();
        const download = async () => downloadedWorkbook(validRows);
        const first = await refreshRates(refreshOptions(fixture, download, { write: true }));
        expect(first.changed).toBe(true);
        expect(JSON.parse(fs.readFileSync(fixture.ratesFile, 'utf8'))).toEqual([
            rateEntry('52010011', 18, 'cbic-excel'),
            rateEntry('52010012', 12, 'cbic-excel'),
            rateEntry('1011010', 0)
        ]);
        const metadataAfterWrite = JSON.parse(fs.readFileSync(fixture.metadataFile, 'utf8'));
        expect(metadataAfterWrite.gstRatesLastUpdated).toBe('2026-08-02');
        expect(metadataAfterWrite.gstRateSource).toBe('authoritative-excel');

        const afterFirst = fixtureBytes(fixture);
        const writeAtomic = jest.fn();
        const second = await refreshRates(refreshOptions(
            fixture,
            download,
            { write: true, now: () => new Date('2026-08-03T00:00:00Z'), writeAtomic }
        ));
        expect(second.changed).toBe(false);
        expect(writeAtomic).not.toHaveBeenCalled();
        expectBytesUnchanged(fixture, afterFirst);
        expect(JSON.parse(afterFirst.metadata).gstRatesLastUpdated).toBe('2026-08-02');
    });

    test.each([
        ['download failure', async () => { throw new Error('download failed'); }, {}, 'download failed'],
        ['timeout', async () => { throw new Error('Request timed out'); }, {}, 'Request timed out'],
        ['non-200 response', async () => { throw new Error('Unexpected status code 503'); }, {}, 'status code 503'],
        ['invalid content type', async () => ({ buffer: workbookBuffer(validRows), contentType: 'text/html' }), {}, 'content type'],
        ['invalid signature', async () => ({ buffer: Buffer.from('<html>'), contentType: XLSX_CONTENT_TYPE }), {}, 'signature'],
        ['parse failure', async () => ({ buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), contentType: XLSX_CONTENT_TYPE }), {}, undefined],
        ['empty workbook', async () => downloadedWorkbook([['HSN', 'Rate']]), {}, 'no rate rows'],
        ['insufficient rows', async () => downloadedWorkbook([['HSN', 'Rate'], ['52010011', 18]]), {}, 'minimum is 2'],
        ['duplicate codes', async () => downloadedWorkbook([['HSN', 'Rate'], ['1234', 5], ['00001234', 12]]), {}, 'Duplicate'],
        ['invalid negative rate', async () => downloadedWorkbook([['HSN', 'Rate'], ['52010011', -1], ['52010012', 12]]), {}, 'invalid GST rate'],
        ['non-finite rate', async () => downloadedWorkbook([['HSN', 'Rate'], ['52010011', 'Infinity'], ['52010012', 12]]), {}, 'invalid GST rate'],
        ['oversized response', async () => downloadedWorkbook(validRows), { maxBytes: 10 }, 'byte limit'],
        ['zero overlap', async () => downloadedWorkbook([['HSN', 'Rate'], ['99990001', 5], ['99990002', 12]]), {}, 'zero overlap']
    ])('rejects %s and leaves existing files byte-identical', async (_label, download, overrides, message) => {
        const fixture = createFixture();
        const before = fixtureBytes(fixture);
        const promise = refreshRates(refreshOptions(fixture, download, overrides));
        if (message) await expect(promise).rejects.toThrow(message);
        else await expect(promise).rejects.toThrow();
        expectBytesUnchanged(fixture, before);
    });

    test('requires an explicitly configured source URL before reading or writing files', async () => {
        const fixture = createFixture();
        const before = fixtureBytes(fixture);
        await expect(refreshRates({
            sourceUrl: '',
            hsnFile: fixture.hsnFile,
            ratesFile: fixture.ratesFile,
            metadataFile: fixture.metadataFile
        })).rejects.toThrow('GST_RATE_SOURCE_URL is required');
        expectBytesUnchanged(fixture, before);
    });
});

describe('command and workflow safety', () => {
    test('main propagates validation errors', async () => {
        await expect(main({ sourceUrl: '', write: false })).rejects.toThrow('GST_RATE_SOURCE_URL is required');
    });

    test('CLI exits nonzero when the source URL is absent', () => {
        const env = { ...process.env };
        delete env.GST_RATE_SOURCE_URL;
        const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'update-gst-rates.js'), '--check'], {
            env,
            encoding: 'utf8'
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('GST_RATE_SOURCE_URL is required');
    });

    test('scheduled workflow has no repository write path', () => {
        const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'update-gst-rates.yml'), 'utf8');
        expect(workflow).toContain("if: ${{ vars.GST_RATE_SOURCE_URL != '' }}");
        expect(workflow).toContain('contents: read');
        expect(workflow).toContain('node scripts/update-gst-rates.js --check');
        expect(workflow).not.toMatch(/contents: write|git add|git commit|git push|--write|force_update|continue-on-error/);
    });
});
