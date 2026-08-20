import { toCsv } from './variants'
import type { DesignVariable, VariableType } from '../types'
import type { VariantRow } from './variants'

export interface ParsedSheet {
  headers: string[]
  rows: VariantRow[]
}

const NAME_RE = /^(name|variant|colorway|title|sku|style)$/i

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Turn a parsed SheetJS workbook into headers + rows. */
function workbookToSheet(XLSX: any, wb: any): ParsedSheet {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { headers: [], rows: [] }

  const matrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: '',
  }) as unknown[][]
  if (matrix.length === 0) return { headers: [], rows: [] }

  const headerRow = (matrix[0] as unknown[]).map((h) => String(h ?? '').trim())
  const headers = headerRow.filter((h) => h !== '')
  const nameIdx = headerRow.findIndex((h) => NAME_RE.test(h))

  const rows: VariantRow[] = []
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r] as unknown[]
    const values: Record<string, string> = {}
    let hasValue = false
    headerRow.forEach((h, i) => {
      if (!h) return
      const cell = cells[i]
      const v = cell === undefined || cell === null ? '' : String(cell)
      values[h] = v
      if (v.trim() !== '') hasValue = true
    })
    if (!hasValue) continue
    const name = nameIdx >= 0 ? String(cells[nameIdx] ?? '').trim() : ''
    rows.push({ name, values })
  }
  return { headers, rows }
}

/**
 * Parse an uploaded .xlsx / .xls / .csv into headers + rows. The first
 * sheet's first row is the header; a "name"/"variant"/… column (if any)
 * names each generated colorway. SheetJS is imported lazily so it only
 * loads when the user actually imports a sheet.
 */
export async function parseSheet(file: File): Promise<ParsedSheet> {
  const XLSX = await import('@e965/xlsx')
  const wb = /\.csv$/i.test(file.name)
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  return workbookToSheet(XLSX, wb)
}

/** Parse raw CSV text (used for Google Sheets exports). */
export async function parseCsvText(text: string): Promise<ParsedSheet> {
  const XLSX = await import('@e965/xlsx')
  return workbookToSheet(XLSX, XLSX.read(text, { type: 'string' }))
}

/* ------------------------------------------------------------------ */
/* Google Sheets                                                       */
/* ------------------------------------------------------------------ */

/**
 * Candidate CSV-export URLs for a public Google Sheets link, in the order
 * we try them. Supports both normal share links (…/spreadsheets/d/<id>/…)
 * and published-to-web links (…/spreadsheets/d/e/<id>/pub…). The gviz
 * endpoint is tried first as it is the most reliably CORS-accessible.
 */
export function googleSheetCsvUrls(input: string): string[] {
  const url = input.trim()
  const gid = (url.match(/[?#&]gid=(\d+)/) || [])[1] ?? '0'

  const published = url.match(/\/spreadsheets\/d\/e\/([\w-]+)/)
  if (published) {
    const id = published[1]
    return [
      `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv`,
    ]
  }

  const normal = url.match(/\/spreadsheets\/d\/([\w-]+)/)
  if (!normal) return []
  const id = normal[1]
  return [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
  ]
}

/** True when a response body is an HTML page (sign-in / error) not CSV. */
function looksLikeHtml(text: string): boolean {
  return /^\s*<(!doctype|html)/i.test(text)
}

/**
 * Fetch a public Google Sheet and parse it. Throws a user-facing message
 * when the link is malformed, private, or unreachable.
 */
export async function fetchGoogleSheet(input: string): Promise<ParsedSheet> {
  const urls = googleSheetCsvUrls(input)
  if (urls.length === 0) {
    throw new Error("That doesn't look like a Google Sheets link.")
  }

  let lastError = "Couldn't read that sheet."
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) {
        lastError =
          res.status === 401 || res.status === 403
            ? "The sheet is private — set sharing to 'Anyone with the link'."
            : `The sheet returned ${res.status}.`
        continue
      }
      const text = await res.text()
      if (looksLikeHtml(text)) {
        lastError =
          "Got a sign-in page instead of data — set the sheet's sharing to 'Anyone with the link'."
        continue
      }
      const parsed = await parseCsvText(text)
      if (parsed.rows.length === 0) {
        lastError = 'No data rows found in that sheet.'
        continue
      }
      return parsed
    } catch {
      /* CORS / network — try the next candidate URL. */
      lastError =
        "Couldn't reach the sheet. Make sure it's shared as 'Anyone with the link'."
    }
  }
  throw new Error(lastError)
}

/* ------------------------------------------------------------------ */
/* CSV template                                                        */
/* ------------------------------------------------------------------ */

/** Example placeholder for a variable type, to seed the template. */
function sample(type: VariableType): string {
  switch (type) {
    case 'color':
      return '#1F3A5F'
    case 'text':
      return 'Your text'
    case 'graphic':
      return 'logo.png'
    case 'placement':
      return 'Front'
    case 'font':
      return 'serif'
  }
}

/**
 * A ready-to-fill CSV template: a "name" column plus one column per
 * variable, and two example rows so the format is self-evident.
 */
export function csvTemplate(variables: DesignVariable[]): string {
  const headers = ['name', ...variables.map((v) => v.name)]
  const example = (n: number) => [
    `Variant ${n}`,
    ...variables.map((v) => sample(v.type)),
  ]
  return toCsv([headers, example(1), example(2)])
}
