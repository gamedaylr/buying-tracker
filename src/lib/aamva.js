/** Parse the PDF417 payload on a US driver's license (AAMVA). */

const FIELD_CODES = [
  'DAA', 'DAC', 'DAD', 'DCS', 'DCT', 'DCU', 'DBB', 'DBA', 'DBC', 'DAQ',
  'DAG', 'DAH', 'DAI', 'DAJ', 'DAK', 'DCG', 'DCF', 'DCB', 'DCD',
];

const CODE_RE = new RegExp(`(?:^|[\\n\\r])(${FIELD_CODES.join('|')})`, 'g');

function normalizeBarcode(raw) {
  return String(raw || '')
    .split('\u0000').join('')
    .split('\u001e').join('\n')
    .split('\u001d').join('\n');
}

function extractFields(raw) {
  const text = normalizeBarcode(raw);
  const hits = [];
  let match = CODE_RE.exec(text);
  while (match) {
    hits.push({ code: match[1], index: match.index + match[0].length - 3 });
    match = CODE_RE.exec(text);
  }
  CODE_RE.lastIndex = 0;
  const fields = {};
  hits.forEach((hit, i) => {
    const start = hit.index + 3;
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    const value = text.slice(start, end).replace(/[\r\n]+/g, ' ').trim();
    if (value && !fields[hit.code]) fields[hit.code] = value;
  });
  return fields;
}

export function parseDob(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return '';
  const eight = digits.slice(0, 8);
  const asMonthFirst = eight.slice(0, 2);
  const asYearFirst = eight.slice(0, 4);
  let year;
  let month;
  let day;
  if (Number(asMonthFirst) >= 1 && Number(asMonthFirst) <= 12 && Number(eight.slice(4, 8)) > 1900) {
    month = eight.slice(0, 2);
    day = eight.slice(2, 4);
    year = eight.slice(4, 8);
  } else if (asYearFirst.startsWith('19') || asYearFirst.startsWith('20')) {
    year = eight.slice(0, 4);
    month = eight.slice(4, 6);
    day = eight.slice(6, 8);
  } else {
    return '';
  }
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return '';
  return `${year}-${month}-${day}`;
}

function formatZip(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length >= 9 && !digits.slice(5, 9).match(/^0{4}$/)) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  }
  return digits.slice(0, 5);
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .trim();
}

/**
 * Returns null when the text does not look like a license barcode.
 * ID number and DOB are sensitive and should be encrypted before they are stored.
 */
export function parseAamva(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (!/ANSI|DAQ|DCS|DAC|DAA/.test(raw)) return null;
  const fields = extractFields(raw);
  if (!fields.DAQ && !fields.DCS && !fields.DAC && !fields.DAA) return null;

  let first = fields.DAC || '';
  let middle = fields.DAD || '';
  let last = fields.DCS || '';
  if ((!first || !last) && fields.DAA) {
    const parts = fields.DAA.split(',');
    if (parts.length >= 2) {
      last = last || parts[0];
      first = first || parts[1];
      middle = middle || parts.slice(2).join(' ');
    } else if (!first) {
      const words = fields.DAA.trim().split(/\s+/);
      if (words.length >= 2) {
        first = words[0];
        last = words[words.length - 1];
        middle = words.slice(1, -1).join(' ');
      }
    }
  }
  if (fields.DCT && !first) {
    const [given, mid] = fields.DCT.split(',');
    first = given || '';
    middle = middle || mid || '';
  }

  const fullName = [first, middle, last].map(titleCase).filter(Boolean).join(' ');
  if (!fullName && !fields.DAQ) return null;

  return {
    firstName: titleCase(first),
    middleName: titleCase(middle),
    lastName: titleCase(last),
    fullName,
    dob: parseDob(fields.DBB),
    idNumber: String(fields.DAQ || '').replace(/\s+/g, ''),
    address: titleCase(fields.DAG || ''),
    city: titleCase(fields.DAI || ''),
    state: String(fields.DAJ || '').trim().toUpperCase(),
    zip: formatZip(fields.DAK),
  };
}
