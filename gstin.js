'use strict';

// GSTIN format: 2-digit state code + 10-char PAN + 1 entity number + 'Z' + 1 checksum.
// Total length: 15 characters.

// State code map
const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra', '28': 'Andhra Pradesh (old)', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction'
};

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// GSTIN checksum using MOD 36 Luhn-like algorithm
function _gstinChecksum(gstin14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARSET.indexOf(gstin14[i]);
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkVal = (36 - (sum % 36)) % 36;
  return CHARSET[checkVal];
}

function isValidPAN(pan) {
  if (!pan || typeof pan !== 'string') return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim());
}

function validateGSTIN(gstin) {
  if (!gstin || typeof gstin !== 'string') {
    return { isValid: false, error: 'GSTIN must be a non-empty string' };
  }
  const g = gstin.trim().toUpperCase();
  if (g.length !== 15) {
    return { isValid: false, error: `GSTIN must be 15 characters, got ${g.length}` };
  }
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) {
    return { isValid: false, error: 'GSTIN format invalid' };
  }
  const stateCode = g.substring(0, 2);
  if (!STATE_CODES[stateCode]) {
    return { isValid: false, error: `Invalid state code: ${stateCode}` };
  }
  const expectedCheck = _gstinChecksum(g.substring(0, 14));
  if (g[14] !== expectedCheck) {
    return { isValid: false, error: `Invalid checksum: expected ${expectedCheck}, got ${g[14]}` };
  }
  return {
    isValid: true,
    stateCode,
    stateName: STATE_CODES[stateCode],
    panNumber: g.substring(2, 12),
    entityNumber: g[12],
    checkDigit: g[14]
  };
}

function formatGSTIN(gstin) {
  if (!gstin || typeof gstin !== 'string') throw new TypeError('gstin must be a string');
  return gstin.trim().toUpperCase();
}

function getStateFromGSTIN(gstin) {
  if (!gstin || typeof gstin !== 'string') throw new TypeError('gstin must be a string');
  const g = gstin.trim().toUpperCase();
  if (g.length < 2) throw new RangeError('GSTIN too short');
  const code = g.substring(0, 2);
  const name = STATE_CODES[code];
  if (!name) throw new RangeError(`Unknown state code: ${code}`);
  return name;
}

function getGSTINComponents(gstin) {
  if (!gstin || typeof gstin !== 'string') throw new TypeError('gstin must be a string');
  const g = gstin.trim().toUpperCase();
  if (g.length !== 15) throw new RangeError('GSTIN must be 15 characters');
  const stateCode = g.substring(0, 2);
  return {
    stateCode,
    stateName: STATE_CODES[stateCode] || 'Unknown',
    pan: g.substring(2, 12),
    entityNumber: g[12],
    checkDigit: g[14]
  };
}

module.exports = { isValidPAN, validateGSTIN, formatGSTIN, getStateFromGSTIN, getGSTINComponents, STATE_CODES };
