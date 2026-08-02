import {
  getAllHsn, getCodeByTxt, getDesByCode, getHsnByExactCode,
  isValidHsnCode, getHsnChapter, searchHsn, getStats,
  getChapterSummary, findCodesByDescription, bulkValidateHsnCodes,
  getGstRateByCode, getHsnByExactCodeWithRate, getHsnByRateSlabs,
  calculateTax, calculateGSTBreakdown, reverseCalculateTax,
  getApplicableTaxType, calculateInvoiceTotals, groupItemsByTaxRate,
  applyRoundOffRules,
  validateGSTIN, formatGSTIN, getStateFromGSTIN, isValidPAN, getGSTINComponents,
  getAllSac, getSacByCode, searchSac, getCodeDetails,
  exportToCSV, exportToJSON, generateGSTR1Summary,
  HsnCode, SearchOptions, HsnStats, GstRate, HsnCodeWithRate,
  GSTINValidationResult, GSTINComponents, SacCode, CodeDetails,
  TaxResult, GSTBreakdown, ReverseTaxResult, InvoiceLineItem,
  InvoiceTotals, GSTBreakdownOptions, ChapterSummary, BulkValidationResult,
  GSTR1LineItem, GSTR1SummaryRow
} from '../index';

// HSN lookup
const all: ReadonlyArray<HsnCode> = getAllHsn();
const byText: HsnCode[] = getCodeByTxt('cotton');
const byCode: HsnCode[] = getDesByCode('5201');
const exact: HsnCode | undefined = getHsnByExactCode('52010011');
const valid: boolean = isValidHsnCode('52010011');
const chapter: HsnCode[] = getHsnChapter('52');
const searched: HsnCode[] = searchHsn('silk', { matchType: 'contains', limit: 10 });
const stats: HsnStats = getStats();
const gstRatesLastUpdated: string = stats.gstRatesLastUpdated;
const gstRateSource: 'chapter-level' | 'mixed' | 'authoritative-excel' = stats.gstRateSource;
const gstNotificationRef: string = stats.gstNotificationRef;
const summary: ChapterSummary | null = getChapterSummary('52');
const byKeywords: HsnCode[] = findCodesByDescription(['cotton', 'carded']);
const bulk: BulkValidationResult = bulkValidateHsnCodes(['52010011', '00000000']);

// GST rates
const rate: GstRate | null = getGstRateByCode('52010011');
const withRate: HsnCodeWithRate | undefined = getHsnByExactCodeWithRate('52010011');
const notificationRef: string | undefined = withRate?.notificationRef;
const slab: HsnCode[] = getHsnByRateSlabs(5);

// GST calculation
const tax: TaxResult = calculateTax(10000, 18);
const breakdown: GSTBreakdown = calculateGSTBreakdown(10000, 18, { isInterState: false });
const reverse: ReverseTaxResult = reverseCalculateTax(11800, 18);
const taxType: 'IGST' | 'CGST_SGST' = getApplicableTaxType('27', '33');
const invoice: InvoiceTotals = calculateInvoiceTotals([{ taxableValue: 10000, gstRate: 18 }], false);
const grouped: Record<string, InvoiceLineItem[]> = groupItemsByTaxRate([{ taxableValue: 1000, gstRate: 18 }]);
const rounded: number = applyRoundOffRules(10.005);

// GSTIN
const gstinResult: GSTINValidationResult = validateGSTIN('27AAPFU0939F1ZV');
const formatted: string = formatGSTIN('27aapfu0939f1zv');
const stateName: string = getStateFromGSTIN('27AAPFU0939F1ZV');
const panValid: boolean = isValidPAN('AAPFU0939F');
const components: GSTINComponents = getGSTINComponents('27AAPFU0939F1ZV');

// SAC
const allSac: ReadonlyArray<SacCode> = getAllSac();
const sacEntry: SacCode | undefined = getSacByCode('9954');
const sacSearch: SacCode[] = searchSac('construction');
const details: CodeDetails | undefined = getCodeDetails('9954');

// Export
const csv: string = exportToCSV([{ code: '1', description: 'test' }]);
const protectedCsv: string = exportToCSV([{ value: '=1+1' }], { preventFormulaInjection: true });
const unprotectedCsv: string = exportToCSV([{ value: '=1+1' }], { preventFormulaInjection: false });
const json: string = exportToJSON([{ code: '1' }]);
const gstr1Item: GSTR1LineItem = { taxableValue: 10000, gstRate: 18 };
const gstr1: GSTR1SummaryRow[] = generateGSTR1Summary([gstr1Item]);
const gstr1ByIgstRate: GSTR1SummaryRow[] = generateGSTR1Summary([
  { taxableValue: 10000, igstRate: 18, isInterState: true }
]);
const gstr1TaxRate: number = gstr1[0].taxRate;

// Reference all bindings so noUnusedLocals (if enabled) stays quiet.
void [
  all, byText, byCode, exact, valid, chapter, searched, stats,
  gstRatesLastUpdated, gstRateSource, gstNotificationRef, summary, byKeywords, bulk, rate,
  withRate, notificationRef, slab, tax, breakdown, reverse, taxType,
  invoice, grouped, rounded, gstinResult, formatted, stateName, panValid,
  components, allSac, sacEntry, sacSearch, details, csv, protectedCsv,
  unprotectedCsv, json, gstr1Item, gstr1, gstr1ByIgstRate, gstr1TaxRate
];
const _opts: SearchOptions = { matchType: 'exact', limit: 5, offset: 0 };
const _bdOpts: GSTBreakdownOptions = { isInterState: true, cessRate: 12 };
const _li: InvoiceLineItem = { taxableValue: 100, gstRate: 18, cessRate: 0 };
void [_opts, _bdOpts, _li];
