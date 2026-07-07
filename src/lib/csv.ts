// Genera y descarga un CSV en el navegador (sin librerías).
// Separador ';' y BOM UTF-8 para que Excel en español lo abra con acentos y columnas.

type Cell = string | number | null | undefined

function esc(v: Cell): string {
  const s = v == null ? '' : String(v)
  if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function downloadCSV(filename: string, headers: string[], rows: Cell[][]): void {
  const sep = ';'
  const lines = [headers.map(esc).join(sep), ...rows.map((r) => r.map(esc).join(sep))]
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
