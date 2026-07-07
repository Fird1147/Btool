// server/services/tableWriter.js
const XLSX = require('xlsx')
const { validateChanges } = require('./headerValidator')

/**
 * Apply changes to an xlsx file in-place.
 * Data row change:   { field, rowKey, newValue }
 * Header row change: { field, headerRow, newValue }
 *   headerRow: 0=types(R2), 1=scopes(R3), 2=flags(R4), 3=descs(R5)
 */
function applyChanges(filePath, headers, changes) {
  const headerChanges = changes.filter(c => c.headerRow !== undefined)
  const dataChanges   = changes.filter(c => c.headerRow === undefined)

  // Validate data-row changes only
  const { errors } = validateChanges(dataChanges, headers)
  if (errors.length > 0) throw new Error(errors.join('; '))

  if (changes.length === 0) return

  const wb = XLSX.readFile(filePath, { cellFormula: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const pkFieldIdx = headers.scopes.findIndex(s => s === 'allkey' || s === 'allmainkey')
  const resolvedPkIdx = pkFieldIdx !== -1 ? pkFieldIdx : 0

  const r1 = raw[0]
  const getColIdx = (fieldName) => r1.findIndex(v => v != null && String(v).trim() === fieldName)

  const DATA_OFFSET = 5
  const pkColIdx = getColIdx(headers.fields[resolvedPkIdx])

  // ── Header row changes ───────────────────────────────────────────────────
  for (const change of headerChanges) {
    const fieldColIdx = getColIdx(change.field)
    if (fieldColIdx === -1) throw new Error(`Field "${change.field}" not found in xlsx Row 1`)
    // headerRow 0 → raw row index 1 (types), 1 → 2 (scopes), 2 → 3 (flags), 3 → 4 (descs)
    const rawRowIdx = change.headerRow + 1
    const cellAddr = XLSX.utils.encode_cell({ r: rawRowIdx, c: fieldColIdx })
    if (!ws[cellAddr]) ws[cellAddr] = {}
    ws[cellAddr].v = change.newValue ?? ''
    ws[cellAddr].t = 's'
  }

  // ── Data row changes ─────────────────────────────────────────────────────
  for (const change of dataChanges) {
    const fieldColIdx = getColIdx(change.field)
    if (fieldColIdx === -1) throw new Error(`Field "${change.field}" not found in xlsx Row 1`)

    let targetRowIdx = -1
    for (let i = DATA_OFFSET; i < raw.length; i++) {
      if (raw[i][pkColIdx] == change.rowKey) { targetRowIdx = i; break }
    }
    if (targetRowIdx === -1) throw new Error(`Row with pk=${change.rowKey} not found`)

    const cellAddr = XLSX.utils.encode_cell({ r: targetRowIdx, c: fieldColIdx })
    const existingCell = ws[cellAddr]
    if (existingCell && existingCell.f) {
      throw new Error(`字段 "${change.field}" 含有公式，禁止覆盖。请在 Excel 中修改。`)
    }
    if (!ws[cellAddr]) ws[cellAddr] = {}
    ws[cellAddr].v = change.newValue
    ws[cellAddr].t = typeof change.newValue === 'number' ? 'n' : 's'
  }

  XLSX.writeFile(wb, filePath)
}

module.exports = { applyChanges }
