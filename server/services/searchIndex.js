'use strict'
var tableReader = require('./tableReader')
var config = require('../config')

var _index = null
var _building = false
var REBUILD_MS = 10 * 60 * 1000  // 10 min

// Build index asynchronously, yielding to event loop between each table.
// onDone(err, items) called when finished.
function buildIndexAsync(root, onDone) {
  var tables
  try {
    tables = tableReader.scanTables(root || config.TABLES_ROOT)
  } catch (e) {
    onDone(e)
    return
  }

  var items = []
  var i = 0

  function next() {
    if (i >= tables.length) {
      onDone(null, items)
      return
    }

    var entry = tables[i++]

    // Skip non-xlsx files — nothing to index
    if (entry.kind !== 'xlsx') {
      setImmediate(next)
      return
    }

    // Table-level entry
    items.push({
      type: 'table',
      folder: entry.folder,
      table: entry.name,
      snippet: entry.folder + ' / ' + entry.name,
      _key: entry.name.toLowerCase(),
      _lc: (entry.name + ' ' + entry.folder).toLowerCase(),
    })

    var tableData
    try {
      tableData = tableReader.readTable(entry.path)
    } catch (e) {
      setImmediate(next)
      return
    }

    var headers = tableData.headers
    var rows = tableData.rows

    // Field-level entries
    for (var f = 0; f < headers.fields.length; f++) {
      var field = headers.fields[f]
      var desc = headers.descs[f] || ''
      items.push({
        type: 'field',
        folder: entry.folder,
        table: entry.name,
        field: field,
        snippet: field + (desc ? ': ' + desc : ''),
        _key: field.toLowerCase(),
        _lc: (field + ' ' + desc).toLowerCase(),
      })
    }

    // Cell-level entries: one per row, all cell values joined as search text
    var pkIdx = -1
    for (var s = 0; s < headers.scopes.length; s++) {
      if (headers.scopes[s] === 'allkey' || headers.scopes[s] === 'allmainkey') {
        pkIdx = s
        break
      }
    }
    var pkField = headers.fields[pkIdx !== -1 ? pkIdx : 0]

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r]
      var parts = []
      for (var c = 0; c < headers.fields.length; c++) {
        var val = row[headers.fields[c]]
        if (val != null) {
          var sv = String(val)
          if (sv.length <= 300) parts.push(sv)
        }
      }
      if (parts.length === 0) continue

      items.push({
        type: 'cell',
        folder: entry.folder,
        table: entry.name,
        rowKey: row[pkField],
        _row: row,
        _fields: headers.fields,
        // Use \0 as separator so "ab" doesn't match "a" in one field + "b" in another
        _lc: parts.join('\0').toLowerCase(),
      })
    }

    setImmediate(next)
  }

  next()
}

function startBuild(root) {
  if (_building) return
  _building = true
  console.log('[searchIndex] building index...')

  buildIndexAsync(root, function(err, items) {
    _building = false
    if (err) {
      console.error('[searchIndex] build failed:', err.message)
    } else {
      _index = items
      console.log('[searchIndex] ready — ' + items.length + ' items')
    }
    setTimeout(function() { startBuild(root) }, REBUILD_MS)
  })
}

function getIndex() {
  return _index
}

function isBuilding() {
  return _building
}

// Force a rebuild (call after writing to xlsx)
function invalidate() {
  _index = null
  startBuild()
}

module.exports = { startBuild: startBuild, getIndex: getIndex, isBuilding: isBuilding, invalidate: invalidate }
