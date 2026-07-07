// server/routes/tables.js
const router = require('express').Router()
const requireAuth = require('../middleware/requireAuth')
const { scanTables, readTable } = require('../services/tableReader') // readTable used by /:name

router.use(requireAuth)

router.get('/', (req, res) => {
  try {
    res.json(scanTables())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:name', (req, res) => {
  try {
    const tables = scanTables()
    const entry = tables.find(t => t.name === req.params.name)
    if (!entry) return res.status(404).json({ error: 'Table not found' })
    const table = readTable(entry.path)
    res.json(table)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
