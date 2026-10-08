import Papa from 'papaparse';

// Downloads `rows` as a CSV. `columns` is [{ header, value: row => any }], so
// the file carries the same columns the table shows rather than raw API
// objects. The BOM makes Excel read UTF-8 (₹, accented names) correctly.
export function exportCsv(filename, columns, rows) {
  const csv = Papa.unparse({
    fields: columns.map((c) => c.header),
    data: rows.map((row) => columns.map((c) => {
      const v = c.value(row);
      return v == null ? '' : v;
    })),
  });
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
