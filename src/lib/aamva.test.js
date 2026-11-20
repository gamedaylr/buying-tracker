import { parseAamva, parseDob } from './aamva';
import { interpretScan, mapPsaCert, officialLookup } from './graders';

const SAMPLE = [
  '@',
  '\u001e',
  'ANSI 636000090002DL00410278ZV03190008DL',
  'DAQT64235789',
  'DCSSAMPLE',
  'DACMICHAEL',
  'DADJOHN',
  'DBB06061986',
  'DAG2300 WEST BROAD STREET',
  'DAIRICHMOND',
  'DAJVA',
  'DAK232690000',
].join('\n');

test('a license barcode fills the seller name and private ID fields', () => {
  const parsed = parseAamva(SAMPLE);
  expect(parsed.fullName).toBe('Michael John Sample');
  expect(parsed.dob).toBe('1986-06-06');
  expect(parsed.idNumber).toBe('T64235789');
  expect(parsed.city).toBe('Richmond');
  expect(parsed.state).toBe('VA');
  expect(parsed.zip).toBe('23269');
  expect(parsed.address).toBe('2300 West Broad Street');
});

test('random card text is not treated as a license', () => {
  expect(parseAamva('Charizard 4/102')).toBeNull();
  expect(parseDob('')).toBe('');
});

test('official links stay on the grader sites and PSA is the API grader', () => {
  expect(officialLookup('PSA', '12345678').url).toBe('https://www.psacard.com/cert/12345678');
  expect(officialLookup('PSA', '12345678').mode).toBe('api');
  expect(officialLookup('BGS', '0018423078').url).toContain('beckett.com/grading/card-lookup');
  expect(officialLookup('CGC', '123').url).toBe('https://www.cgccards.com/certlookup/');
  expect(officialLookup('SGC', '1234567').url).toBe('https://gosgc.com/cert-code-lookup');
  expect(officialLookup('TAG', 'A1234567').mode).toBe('link');
});

test('a slab scan can be a cert number or an official URL', () => {
  expect(interpretScan('12345678').certNumber).toBe('12345678');
  const linked = interpretScan('https://www.psacard.com/cert/87654321');
  expect(linked.official).toBe(true);
  expect(linked.certNumber).toBe('87654321');
  expect(interpretScan('https://example.com/cert/87654321').official).toBe(false);
});

test('PSA responses map to the fields shown beside the photo', () => {
  const mapped = mapPsaCert({
    PSACert: {
      CertNumber: 123,
      Subject: 'Patrick Mahomes',
      YearIssued: '2023',
      Brand: 'Panini',
      Variety: 'Prizm',
      CardNumber: '290',
      CardGrade: '10',
    },
    IsValidRequest: true,
  });
  expect(mapped.found).toBe(true);
  expect(mapped.details.player).toBe('Patrick Mahomes');
  expect(mapped.details.setName).toBe('Panini Prizm');
  expect(mapped.details.grade).toBe('10');
  expect(mapPsaCert({ PSACert: null, IsValidRequest: true, ServerMessage: 'No data found' }).found).toBe(false);
});
