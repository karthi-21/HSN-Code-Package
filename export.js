'use strict';

function exportToCSV(data, options) {
  if (!Array.isArray(data)) throw new TypeError('data must be an array');
  const { delimiter = ',', headers } = options || {};
  if (data.length === 0) return '';
  const keys = headers || Object.keys(data[0]);
  function escape(val) {
    const s = String(val == null ? '' : val);
    if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  const rows = [keys.map(escape).join(delimiter)];
  for (const row of data) {
    rows.push(keys.map(k => escape(row[k])).join(delimiter));
  }
  return rows.join('\n');
}

function exportToJSON(data, options) {
  const { pretty = true } = options || {};
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

function generateGSTR1Summary(items) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  const groups = {};
  for (const item of items) {
    const rate = item.gstRate != null ? item.gstRate : item.igstRate || 0;
    const key = String(rate);
    if (!groups[key]) {
      groups[key] = { taxRate: rate, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, totalTax: 0, count: 0 };
    }
    const g = groups[key];
    const tv = item.taxableValue || 0;
    g.taxableValue += tv;
    const taxAmount = tv * rate / 100;
    if (item.isInterState) {
      g.igst += taxAmount;
    } else {
      g.cgst += taxAmount / 2;
      g.sgst += taxAmount / 2;
    }
    const cessAmount = item.cessRate ? tv * item.cessRate / 100 : 0;
    g.cess += cessAmount;
    g.totalTax += taxAmount + cessAmount;
    g.count++;
  }
  return Object.values(groups).map(g => ({
    ...g,
    taxableValue: Math.round(g.taxableValue * 100) / 100,
    igst: Math.round(g.igst * 100) / 100,
    cgst: Math.round(g.cgst * 100) / 100,
    sgst: Math.round(g.sgst * 100) / 100,
    cess: Math.round(g.cess * 100) / 100,
    totalTax: Math.round(g.totalTax * 100) / 100
  }));
}

module.exports = { exportToCSV, exportToJSON, generateGSTR1Summary };
