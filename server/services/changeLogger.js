// server/services/changeLogger.js
const fs = require('fs')
const path = require('path')

const LOG_FILE = path.join(__dirname, '../logs/changes.json')
const LOG_DIR = path.dirname(LOG_FILE)
// Ensure logs directory exists on first write
fs.mkdirSync(LOG_DIR, { recursive: true })

function readLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) }
  catch { return [] }
}

function appendChange(user, table, changes) {
  const log = readLog()
  log.push({ timestamp: new Date().toISOString(), user, table, changes })
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2))
}

function getChanges({ table, user, limit = 100 } = {}) {
  let log = readLog()
  if (table) log = log.filter(e => e.table === table)
  if (user)  log = log.filter(e => e.user === user)
  return log.slice(-limit).reverse()  // newest first
}

module.exports = { appendChange, getChanges }
