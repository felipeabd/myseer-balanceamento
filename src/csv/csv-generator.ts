/**
 * Generate a CSV string from structured data.
 * Columns define the order and headers.
 */
export function generateCsv(
  columns: string[],
  data: Record<string, unknown>[],
  separator: string = ','
): string {
  const lines: string[] = [];

  // Header row
  lines.push(columns.map(col => escapeCsvValue(String(col), separator)).join(separator));

  // Data rows
  for (const row of data) {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      return escapeCsvValue(String(val), separator);
    });
    lines.push(values.join(separator));
  }

  // BOM for Excel UTF-8 compatibility (Portuguese accents)
  return '\uFEFF' + lines.join('\r\n');
}

function escapeCsvValue(value: string, separator: string): string {
  if (
    value.includes('"') ||
    value.includes(separator) ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
