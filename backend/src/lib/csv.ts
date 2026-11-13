/** Characters that make a spreadsheet treat a cell as a formula (CSV / formula injection, OWASP). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Encodes one CSV cell (RFC 4180). Strings that start with a formula trigger are prefixed with an
 * apostrophe so Excel / Sheets / LibreOffice show them as text; fields containing separators, quotes
 * or line breaks are quoted with quotes doubled. Numbers and booleans are emitted verbatim.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (typeof value === 'number') text = Number.isFinite(value) ? String(value) : '';
  else if (typeof value === 'boolean') text = value ? 'true' : 'false';
  else if (value instanceof Date) text = Number.isNaN(value.getTime()) ? '' : value.toISOString();
  else {
    text = String(value);
    if (FORMULA_START.test(text)) text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One CSV record terminated by CRLF. */
export const csvRow = (cells: readonly unknown[]): string => `${cells.map(csvCell).join(',')}\r\n`;
