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

function validateGSTR1Number(value, index, field) {
  const label = `items[${index}].${field}`;
  if (value == null) throw new TypeError(`${label} is required`);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  if (value < 0) throw new RangeError(`${label} must not be negative`);
  return value;
}

function generateGSTR1Summary(items) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  const groups = {};
  for (const [index, item] of items.entries()) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`items[${index}].item must be a non-null object`);
    }

    const tv = validateGSTR1Number(item.taxableValue, index, 'taxableValue');
    let rate;
    if (item.gstRate != null) {
      rate = validateGSTR1Number(item.gstRate, index, 'gstRate');
    } else if (item.igstRate != null) {
      rate = validateGSTR1Number(item.igstRate, index, 'igstRate');
    } else {
      throw new TypeError(`items[${index}].gstRate or items[${index}].igstRate is required`);
    }
    const cessRate = item.cessRate == null
      ? 0
      : validateGSTR1Number(item.cessRate, index, 'cessRate');
    const isInterState = item.isInterState == null ? false : item.isInterState;
    if (typeof isInterState !== 'boolean') {
      throw new TypeError(`items[${index}].isInterState must be a boolean`);
    }

    const key = String(rate);
    if (!groups[key]) {
      groups[key] = { taxRate: rate, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, totalTax: 0, count: 0 };
    }
    const g = groups[key];
    g.taxableValue += tv;
    const taxAmount = tv * rate / 100;
    if (isInterState) {
      g.igst += taxAmount;
    } else {
      g.cgst += taxAmount / 2;
      g.sgst += taxAmount / 2;
    }
    const cessAmount = tv * cessRate / 100;
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
