const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const { TABLES_ROOT } = require('../config')

// Mirrors Windows Explorer's StrCmpLogicalW: splits on digit runs and compares
// numeric segments as integers, text segments as lowercased Unicode code points.
function naturalCompare(a, b) {
  const RE = /(\d+)|(\D+)/g
  const segsA = String(a).match(RE) || []
  const segsB = String(b).match(RE) || []
  const len = Math.max(segsA.length, segsB.length)
  for (let i = 0; i < len; i++) {
    if (i >= segsA.length) return -1
    if (i >= segsB.length) return 1
    const sa = segsA[i]
    const sb = segsB[i]
    const na = /^\d/.test(sa)
    const nb = /^\d/.test(sb)
    if (na && nb) {
      const diff = parseInt(sa, 10) - parseInt(sb, 10)
      if (diff !== 0) return diff
      // Same value but different lengths (leading zeros): shorter first, like Windows
      if (sa.length !== sb.length) return sa.length - sb.length
    } else {
      const la = sa.toLowerCase()
      const lb = sb.toLowerCase()
      if (la < lb) return -1
      if (la > lb) return 1
    }
  }
  return 0
}

/**
 * Shallow (one level deep) scan TABLES_ROOT (or given dir) for .xlsx files.
 * Returns [{ name, folder, path, rowCount }]
 */
function scanTables(root) {
  if (root === undefined) root = TABLES_ROOT
  const results = []

  function walk(dir, relDir) {
    const entries = fs.readdirSync(dir).sort(naturalCompare)
    const files = [], dirs = []
    for (const entry of entries) {
      if (entry.startsWith('~$')) continue
      const stat = fs.statSync(path.join(dir, entry))
      if (stat.isDirectory()) dirs.push(entry)
      else files.push(entry)
    }

    const folderLabel = relDir || '(根目录)'
    for (const file of files) {
      const isXlsx = file.endsWith('.xlsx')
      results.push({
        name: isXlsx ? path.basename(file, '.xlsx') : file,
        folder: folderLabel,
        path: path.join(dir, file),
        rowCount: null,
        kind: isXlsx ? 'xlsx' : 'other',
      })
    }

    for (const d of dirs) {
      walk(path.join(dir, d), relDir ? relDir + '/' + d : d)
    }
  }

  walk(root, '')
  return results
}

/**
 * Parse a single xlsx file.
 * Returns { name, headers: { fields, types, scopes, flags, descs }, rows }
 * Skips columns where Row1 (field name) is empty/null.
 */
function readTable(filePath) {
  const wb = XLSX.readFile(filePath, { cellFormula: true, cellStyles: true, sheetRows: 0 })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  if (raw.length < 5) throw new Error(filePath + ': fewer than 5 rows')

  const r1 = raw[0]
  const r2 = raw[1]
  const r3 = raw[2]
  const r4 = raw[3]
  const r5 = raw[4]
  const dataRaws = raw.slice(5)

  const colCount = Math.max(r1.length, r2.length, r3.length, r4.length, r5.length)
  const validCols = []
  for (var i = 0; i < colCount; i++) {
    var field = r1[i] != null ? String(r1[i]).trim() : null
    if (!field) continue
    validCols.push({
      idx: i,
      field: field,
      type:  r2[i] != null ? String(r2[i]).trim() : '',
      scope: r3[i] != null ? String(r3[i]).trim() : '',
      flag:  r4[i] != null ? String(r4[i]).trim() : '',
      desc:  r5[i] != null ? String(r5[i]).trim() : '',
    })
  }

  const headers = {
    fields: validCols.map(function(c) { return c.field }),
    types:  validCols.map(function(c) { return c.type }),
    scopes: validCols.map(function(c) { return c.scope }),
    flags:  validCols.map(function(c) { return c.flag }),
    descs:  validCols.map(function(c) { return c.desc }),
  }

  // Header row styles: headerStyles[ri][ci] = raw SheetJS .s object (or null)
  var headerStyles = []
  for (var hRow = 0; hRow < 5; hRow++) {
    var hRowStyles = []
    for (var k = 0; k < validCols.length; k++) {
      var hAddr = XLSX.utils.encode_cell({ r: hRow, c: validCols[k].idx })
      var hCell = ws[hAddr]
      hRowStyles.push((hCell && hCell.s && typeof hCell.s === 'object') ? hCell.s : null)
    }
    headerStyles.push(hRowStyles)
  }

  // Data rows: formulas / styles / displayValues — all sparse
  var rows = []
  var formulas = {}        // { rowIndex: { field: formulaString } }
  var styles = {}          // { rowIndex: { field: rawStyleObj } }
  var displayValues = {}   // { rowIndex: { field: formattedString } } — only when .w differs from .v
  var dataRowHeights = []  // one entry per data row (null = default height)

  for (var wsOffset = 0; wsOffset < dataRaws.length; wsOffset++) {
    var dataRaw = dataRaws[wsOffset]
    if (!dataRaw.some(function(cell) { return cell != null })) continue

    var obj = {}, rowF = {}, rowS = {}, rowD = {}
    var hasFormula = false, hasStyle = false, hasDisplay = false

    for (var j = 0; j < validCols.length; j++) {
      var col = validCols[j]
      obj[col.field] = dataRaw[col.idx] !== undefined ? dataRaw[col.idx] : null

      var cellAddr = XLSX.utils.encode_cell({ r: wsOffset + 5, c: col.idx })
      var cell = ws[cellAddr]
      if (cell) {
        if (cell.f) {
          rowF[col.field] = cell.f; hasFormula = true
        }
        if (cell.s && typeof cell.s === 'object' && Object.keys(cell.s).length > 0) {
          rowS[col.field] = cell.s; hasStyle = true
        }
        if (cell.w != null && cell.w !== '' && cell.w !== String(cell.v != null ? cell.v : '')) {
          rowD[col.field] = cell.w; hasDisplay = true
        }
      }
    }

    var rowInfo = ws['!rows'] ? (ws['!rows'][wsOffset + 5] || null) : null
    dataRowHeights.push(rowInfo)

    if (hasFormula) formulas[rows.length] = rowF
    if (hasStyle)   styles[rows.length]   = rowS
    if (hasDisplay) displayValues[rows.length] = rowD
    rows.push(obj)
  }

  // Sheet-level metadata — everything raw from SheetJS
  var sheetMeta = {
    merges:          ws['!merges']          || [],
    colWidths:       validCols.map(function(col) { return (ws['!cols'] && ws['!cols'][col.idx]) || null }),
    headerRowHeights:[0,1,2,3,4].map(function(r) { return (ws['!rows'] && ws['!rows'][r]) || null }),
    dataRowHeights:  dataRowHeights,
    freeze:          ws['!freeze']          || null,
    dataValidations: ws['!dataValidations'] || [],
    validColIndices: validCols.map(function(col) { return col.idx }),
  }

  return {
    name:          path.basename(filePath, '.xlsx'),
    headers:       headers,
    rows:          rows,
    formulas:      formulas,
    styles:        styles,
    headerStyles:  headerStyles,
    displayValues: displayValues,
    sheetMeta:     sheetMeta,
    _colMap:       validCols,
  }
}

module.exports = { scanTables: scanTables, readTable: readTable, naturalCompare: naturalCompare }
