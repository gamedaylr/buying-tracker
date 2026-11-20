export function cleanCertNumber(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

export function officialLookup(grader, certNumber) {
  const cert = cleanCertNumber(certNumber);
  const id = String(grader || '').toUpperCase();
  if (id === 'PSA') {
    return {
      grader: 'PSA',
      mode: 'api',
      label: 'PSA cert lookup',
      url: cert ? `https://www.psacard.com/cert/${encodeURIComponent(cert)}` : 'https://www.psacard.com/cert',
    };
  }
  if (id === 'BGS') {
    return {
      grader: 'BGS',
      mode: 'link',
      label: 'Beckett cert lookup',
      url: cert
        ? `https://www.beckett.com/grading/card-lookup?item_id=${encodeURIComponent(cert)}&item_type=BGS`
        : 'https://www.beckett.com/grading/card-lookup',
      message: 'Beckett does not offer a public API. Open their lookup page and compare the slab.',
    };
  }
  if (id === 'CGC') {
    return {
      grader: 'CGC',
      mode: 'link',
      label: 'CGC cert lookup',
      url: 'https://www.cgccards.com/certlookup/',
      message: cert
        ? `Enter cert ${cert} on CGC's own page. CGC does not offer a public API.`
        : 'Open CGC\'s cert lookup.',
    };
  }
  if (id === 'SGC') {
    return {
      grader: 'SGC',
      mode: 'link',
      label: 'SGC cert lookup',
      url: 'https://gosgc.com/cert-code-lookup',
      message: 'SGC\'s lookup asks you to confirm you are a person, so it stays in the browser.',
    };
  }
  if (id === 'TAG') {
    return {
      grader: 'TAG',
      mode: 'link',
      label: 'TAG DIG report',
      url: 'https://taggrading.com/pages/tagd',
      message: 'TAG checks are the QR code on the slab or Cert Search on taggrading.com. There is no public API.',
    };
  }
  return null;
}

export function mapPsaCert(body) {
  const cert = body && body.PSACert;
  if (!cert || (!cert.CertNumber && !cert.Subject && !cert.YearIssued && !cert.Brand)) {
    return { found: false, message: (body && body.ServerMessage) || 'PSA has no record for that cert number.' };
  }
  const grade = cert.CardGrade ? String(cert.CardGrade) : '';
  return {
    found: true,
    details: {
      player: cert.Subject || '',
      year: cert.YearIssued || cert.Year || '',
      setName: [cert.Brand, cert.Variety].filter(Boolean).join(' '),
      cardNumber: cert.CardNumber || '',
      grade: cert.GradeDescription || grade,
      brand: cert.Brand || '',
      source: 'psa',
      lookedUpAt: new Date().toISOString(),
    },
  };
}

export async function lookupCert({ grader, certNumber, token, fetchImpl }) {
  const info = officialLookup(grader, certNumber);
  if (!info) {
    return { ok: false, mode: 'link', message: 'Choose PSA, BGS, CGC, SGC, or TAG.', httpStatus: 400 };
  }
  const cert = cleanCertNumber(certNumber);
  if (!cert) {
    return { ...info, ok: false, mode: 'link', message: 'Enter the cert number.', httpStatus: 400 };
  }
  if (info.grader !== 'PSA') {
    return { ok: true, ...info, certNumber: cert, httpStatus: 200 };
  }
  if (!token) {
    return {
      ok: false,
      mode: 'link',
      grader: 'PSA',
      certNumber: cert,
      url: info.url,
      message: 'PSA lookups are not turned on yet. Add the PSA token in Netlify, or open PSA\'s site.',
      httpStatus: 503,
    };
  }
  const response = await fetchImpl(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(cert)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 429) {
    return {
      ok: false,
      mode: 'limit',
      grader: 'PSA',
      certNumber: cert,
      url: info.url,
      message: 'PSA\'s daily lookup limit was reached. Try again tomorrow, or open PSA\'s site.',
      httpStatus: 200,
    };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      mode: 'link',
      grader: 'PSA',
      certNumber: cert,
      url: info.url,
      message: 'PSA rejected the token. Check the token saved in Netlify.',
      httpStatus: 200,
    };
  }
  const body = await response.json().catch(() => ({}));
  const mapped = mapPsaCert(body);
  if (!mapped.found) {
    return {
      ok: true,
      mode: 'not_found',
      grader: 'PSA',
      certNumber: cert,
      url: info.url,
      message: mapped.message,
      httpStatus: 200,
    };
  }
  return {
    ok: true,
    mode: 'details',
    grader: 'PSA',
    certNumber: cert,
    url: info.url,
    details: mapped.details,
    httpStatus: 200,
  };
}
