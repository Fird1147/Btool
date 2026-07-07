// server/routes/write.js
const router = require('express').Router()
const path = require('path')
const requireAuth = require('../middleware/requireAuth')
const { TABLES_ROOT } = require('../config')
const { scanTables, readTable } = require('../services/tableReader')
const { applyChanges } = require('../services/tableWriter')
const { appendChange } = require('../services/changeLogger')
const { notifyTableUpdated } = require('../services/presence')

router.use(requireAuth)

router.post('/:name/write', (req, res) => {
  const { changes } = req.body
  if (!Array.isArray(changes) || changes.length === 0)
    return res.status(400).json({ error: 'changes array required' })

  const tables = scanTables()
  const entry = tables.find(t => t.name === req.params.name)
  if (!entry) return res.status(404).json({ error: 'Table not found' })

  // Path traversal guard: resolved path must be inside TABLES_ROOT
  const resolved = path.resolve(entry.path)
  const root = path.resolve(TABLES_ROOT)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return res.status(403).json({ error: 'Access denied' })
  }

  try {
    const { headers } = readTable(entry.path)
    applyChanges(entry.path, headers, changes)
    appendChange(req.session.username, req.params.name, changes)
    notifyTableUpdated(req.params.name, req.session.username)
    res.json({ ok: true })
  } catch (err) {
    res.status(422).json({ error: err.message })
  }
})

module.exports = router
