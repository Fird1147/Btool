'use strict'
var router = require('express').Router()
var requireAuth = require('../middleware/requireAuth')
var searchIndex = require('../services/searchIndex')

var MAX_RESULTS = 100

// Match quality score: 3=exact, 2=prefix, 1=contains
function matchScore(key, ql) {
  if (key === ql) return 3
  if (key.startsWith(ql)) return 2
  return 1
}

// Higher = shown first. Type priority: table(3xx) > field(2xx) > cell(1xx).
// Within each type, exact match > prefix > contains.
function itemScore(item, ql) {
  var typeBase = item.type === 'table' ? 300 : item.type === 'field' ? 200 : 100
  var key = item._key || item._lc
  return typeBase + matchScore(key, ql) * 10
}

// Find which field/value matched and build a human-readable snippet.
function cellSnippet(item, ql) {
  var fields = item._fields
  var row = item._row
  for (var i = 0; i < fields.length; i++) {
    var val = row[fields[i]]
    if (val == null) continue
    var sv = String(val)
    if (sv.toLowerCase().includes(ql)) {
      return fields[i] + ' = ' + sv
    }
  }
  return 'row ' + item.rowKey
}

function toResult(item, ql) {
  if (item.type === 'cell') {
    return {
      type: 'cell',
      folder: item.folder,
      table: item.table,
      rowKey: item.rowKey,
      snippet: cellSnippet(item, ql),
    }
  }
  return {
    type: item.type,
    folder: item.folder,
    table: item.table,
    field: item.field,
    snippet: item.snippet,
  }
}

router.use(requireAuth)

// GET /api/search/status — diagnostic: is the index ready?
router.get('/status', function(req, res) {
  var idx = searchIndex.getIndex()
  res.json({
    ready: !!idx,
    building: searchIndex.isBuilding(),
    itemCount: idx ? idx.length : 0,
  })
})

router.get('/', function(req, res) {
  var q = (req.query.q || '').trim()
  if (!q) return res.json({ results: [] })

  var idx = searchIndex.getIndex()
  if (!idx) {
    return res.json({ indexing: true, results: [] })
  }

  var ql = q.toLowerCase()

  // Collect up to MAX_RESULTS*5 matches, sort, then slice to MAX_RESULTS.
  // The 5× headroom lets sorting pull the best results to the top before truncating.
  var matched = []
  for (var i = 0; i < idx.length; i++) {
    if (idx[i]._lc.includes(ql)) {
      matched.push(idx[i])
      if (matched.length >= MAX_RESULTS * 5) break
    }
  }

  matched.sort(function(a, b) {
    return itemScore(b, ql) - itemScore(a, ql)
  })

  // Dedup and limit
  var results = []
  var seen = new Set()
  for (var j = 0; j < matched.length && results.length < MAX_RESULTS; j++) {
    var item = matched[j]
    var key = item.type + '|' + item.table + '|' + (item.field || '') + '|' + (item.rowKey != null ? item.rowKey : '')
    if (seen.has(key)) continue
    seen.add(key)
    results.push(toResult(item, ql))
  }

  res.json({ results: results })
})

// POST /api/search/rebuild — force index refresh after xlsx write
router.post('/rebuild', function(req, res) {
  searchIndex.invalidate()
  res.json({ ok: true })
})

module.exports = router
