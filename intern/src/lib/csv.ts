/**
 * CSV helpers for export buttons that work from data the pane already holds.
 *
 * Server-generated exports (see AdminReports / AdminApplications) stay on the
 * backend because the full result set lives there. These helpers are for panes
 * whose list is already in memory, so the export costs no extra request.
 */

/** Quote a single cell so commas, quotes and newlines survive the round trip. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build a CSV from rows and hand it to the browser as a download. */
export function downloadCsv(rows: Array<Array<unknown>>, filename: string) {
  downloadBlob(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" }), filename);
}
