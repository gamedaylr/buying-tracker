/** Official grader lookup links. These open the grader's own site. We do not fetch those pages. */

export const GRADERS = [
  { id: 'PSA', label: 'PSA' },
  { id: 'BGS', label: 'BGS / Beckett' },
  { id: 'CGC', label: 'CGC' },
  { id: 'SGC', label: 'SGC' },
  { id: 'TAG', label: 'TAG' },
];

const OFFICIAL_HOSTS = [
  'psacard.com',
  'www.psacard.com',
  'beckett.com',
  'www.beckett.com',
  'cgccards.com',
  'www.cgccards.com',
  'gosgc.com',
  'www.gosgc.com',
  'sgccard.com',
  'www.sgccard.com',
  'taggrading.com',
  'www.taggrading.com',
  'my.taggrading.com',
];

export function cleanCertNumber(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

export function officialLookup(grader, certNumber) {
  const cert = cleanCertNumber(certNumber);
  const id = String(grader || '').toUpperCase();
  if (id === 'PSA') {
    return {
      grader: 'PSA',
      mode: cert ? 'api' : 'link',
      label: 'PSA cert lookup',
      url: cert ? `https://www.psacard.com/cert/${encodeURIComponent(cert)}` : 'https://www.psacard.com/cert',
    };
  }
  if (id === 'BGS') {
    const url = cert
      ? `https://www.beckett.com/grading/card-lookup?item_id=${encodeURIComponent(cert)}&item_type=BGS`
      : 'https://www.beckett.com/grading/card-lookup';
    return { grader: 'BGS', mode: 'link', label: 'Beckett cert lookup', url };
  }
  if (id === 'CGC') {
    return {
      grader: 'CGC',
      mode: 'link',
      label: 'CGC cert lookup',
      url: 'https://www.cgccards.com/certlookup/',
      hint: cert ? `Enter cert ${cert} on CGC's page. CGC does not publish a public API.` : '',
    };
  }
  if (id === 'SGC') {
    return {
      grader: 'SGC',
      mode: 'link',
      label: 'SGC cert lookup',
      url: 'https://gosgc.com/cert-code-lookup',
      hint: cert ? `Enter cert ${cert} on SGC's page. The lookup asks you to confirm you are a person, so it stays in the browser.` : '',
    };
  }
  if (id === 'TAG') {
    return {
      grader: 'TAG',
      mode: 'link',
      label: 'TAG DIG report',
      url: 'https://taggrading.com/pages/tagd',
      hint: cert
        ? `TAG certs are usually one letter and seven numbers (${cert}). Open TAG's site and use Cert Search, or scan the QR code on the slab.`
        : 'Scan the QR code on the slab. TAG publishes the check on its own site, not through a public API.',
    };
  }
  return null;
}

export function interpretScan(text) {
  const raw = String(text || '').trim();
  if (!raw) return { kind: 'empty' };
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      const official = OFFICIAL_HOSTS.includes(host);
      const digits = (url.pathname.match(/\d{5,}/) || raw.match(/\d{5,}/) || [])[0] || '';
      return { kind: 'url', url: official ? url.toString() : '', official, certNumber: digits, raw };
    } catch (error) {
      return { kind: 'text', certNumber: cleanCertNumber(raw), raw };
    }
  }
  const compact = raw.replace(/\s+/g, '');
  const cert = (compact.match(/[A-Za-z]?\d{5,}(?:-\d+)?/) || [cleanCertNumber(raw)])[0];
  return { kind: 'text', certNumber: cert || cleanCertNumber(raw), raw };
}

export function mapPsaCert(body) {
  const cert = body && (body.PSACert || body.psaCert);
  if (!cert) {
    return { found: false, message: (body && body.ServerMessage) || 'PSA has no record for that cert number.' };
  }
  if (!cert.CertNumber && !cert.Subject && !cert.YearIssued && !cert.Brand) {
    return { found: false, message: (body && body.ServerMessage) || 'PSA has no record for that cert number.' };
  }
  const grade = cert.CardGrade ? String(cert.CardGrade) : '';
  const gradeLabel = cert.GradeDescription && !String(cert.GradeDescription).includes(grade)
    ? `${cert.GradeDescription} ${grade}`.trim()
    : (cert.GradeDescription || grade);
  return {
    found: true,
    details: {
      player: cert.Subject || '',
      year: cert.YearIssued || cert.Year || '',
      setName: [cert.Brand, cert.Variety].filter(Boolean).join(' '),
      cardNumber: cert.CardNumber || '',
      grade: gradeLabel,
      brand: cert.Brand || '',
      source: 'psa',
      lookedUpAt: new Date().toISOString(),
    },
  };
}
