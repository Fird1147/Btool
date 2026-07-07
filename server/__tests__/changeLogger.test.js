// server/__tests__/changeLogger.test.js
const path = require('path')
const fs = require('fs')
const os = require('os')

let tmpLog
beforeEach(() => {
  tmpLog = path.join(os.tmpdir(), `biaotool_log_${Date.now()}.json`)
  fs.writeFileSync(tmpLog, '[]')
})
afterEach(() => { if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog) })

it('appends a change record and reads it back', () => {
  // Override LOG_FILE by re-requiring with mock - use direct file manipulation instead
  const { appendChange, getChanges } = require('../services/changeLogger')

  // We need to test with a temp file - monkey-patch the module
  const changeLogger = require('../services/changeLogger')
  const origRead = changeLogger.__readLog

  // Direct approach: test the module with its actual LOG_FILE
  // Clear the actual log first
  const LOG_FILE = path.join(__dirname, '../logs/changes.json')
  const originalContent = fs.readFileSync(LOG_FILE, 'utf8')
  fs.writeFileSync(LOG_FILE, '[]')

  try {
    changeLogger.appendChange('plannerA', 'hospital_facility', [{ field: 'facility_type', oldValue: 100, newValue: 200 }])
    const logs = changeLogger.getChanges()
    expect(logs).toHaveLength(1)
    expect(logs[0].user).toBe('plannerA')
    expect(logs[0].table).toBe('hospital_facility')
    expect(logs[0].changes[0].newValue).toBe(200)
    expect(logs[0].timestamp).toBeDefined()
  } finally {
    // Restore original content
    fs.writeFileSync(LOG_FILE, originalContent)
  }
})

it('filters by table name', () => {
  const changeLogger = require('../services/changeLogger')
  const LOG_FILE = path.join(__dirname, '../logs/changes.json')
  const originalContent = fs.readFileSync(LOG_FILE, 'utf8')
  fs.writeFileSync(LOG_FILE, '[]')

  try {
    changeLogger.appendChange('user1', 'table_a', [{ field: 'f', oldValue: 1, newValue: 2 }])
    changeLogger.appendChange('user1', 'table_b', [{ field: 'f', oldValue: 1, newValue: 2 }])
    const logs = changeLogger.getChanges({ table: 'table_a' })
    expect(logs).toHaveLength(1)
    expect(logs[0].table).toBe('table_a')
  } finally {
    fs.writeFileSync(LOG_FILE, originalContent)
  }
})
