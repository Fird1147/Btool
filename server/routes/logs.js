// server/routes/logs.js
const router = require('express').Router()
const requireAuth = require('../middleware/requireAuth')
const { getChanges } = require('../services/changeLogger')

router.use(requireAuth)

router.get('/', (req, res) => {
  const { table, user, limit } = req.query
  res.json(getChanges({ table, user, limit: limit ? parseInt(limit, 10) : 100 }))
})

module.exports = router
