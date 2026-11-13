import { describe, expect, it } from 'vitest';
import { csvCell, csvRow } from '../../src/lib/csv.js';

describe('csvCell', () => {
  it('neutralises every spreadsheet formula trigger with a leading apostrophe', () => {
    for (const trigger of ['=', '+', '-', '@', '\t', '\r']) {
      const cell = csvCell(`${trigger}SUM(A1:A9)`);
      expect(cell.startsWith(`'${trigger}`) || cell.startsWith(`"'${trigger}`), JSON.stringify(trigger)).toBe(true);
    }
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("@cmd|' /C calc'!A0")).toBe("'@cmd|' /C calc'!A0");
    expect(csvCell('-2+3')).toBe("'-2+3");
  });

  it('leaves safe text alone and only guards the first character', () => {
    expect(csvCell('hello = world')).toBe('hello = world');
    expect(csvCell('a-b+c@d')).toBe('a-b+c@d');
    expect(csvCell("'already")).toBe("'already");
  });

  it('quotes fields with separators, quotes and line breaks (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('x\r\ny')).toBe('"x\r\ny"');
  });

  it('formats null, numbers, booleans and dates without guarding numbers', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(false)).toBe('false');
    expect(csvCell(new Date('2026-11-12T01:02:03.000Z'))).toBe('2026-11-12T01:02:03.000Z');
    expect(csvCell(new Date('nope'))).toBe('');
  });

  it('csvRow joins cells and ends with CRLF', () => {
    expect(csvRow(['a', 1, null, '=1+1'])).toBe("a,1,,'=1+1\r\n");
  });
});
