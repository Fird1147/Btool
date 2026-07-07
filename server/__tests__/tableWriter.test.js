const path = require('path')
const fs = require('fs')
const os = require('os')
const { applyChanges } = require('../services/tableWriter')
const { readTable } = require('../services/tableReader')

const FIXTURE = path.join(__dirname, 'fixtures/sample-app/sample-table.xlsx')

describe('applyChanges', () => {
  let tmpFile

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `biaotool_test_${Date.now()}.xlsx`)
    fs.copyFileSync(FIXTURE, tmpFile)
  })

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  })

  it('writes changed value back to xlsx and can be read back', () => {
    const before = readTable(tmpFile)
    const firstDataRow = before.rows[0]
    const field = 'unlock_castle_lv'
    const originalValue = firstDataRow[field]
    const newValue = originalValue + 99

    applyChanges(tmpFile, before.headers, [
      { field, rowKey: firstDataRow['area_id'], newValue },
    ])

    const after = readTable(tmpFile)
    expect(after.rows[0][field]).toBe(newValue)
  })

  it('returns without writing for empty changes array', () => {
    const before = readTable(tmpFile)
    applyChanges(tmpFile, before.headers, [])
    const after = readTable(tmpFile)
    // File should be identical - spot check a few values
    expect(after.rows[0]).toEqual(before.rows[0])
  })

  it('throws if change targets allkey field', () => {
    // Use a headers object that has allkey scope for testing this path
    const headers = {
      fields: ['area_id', 'unlock_castle_lv'],
      types:  ['int',     'int'],
      scopes: ['allkey',  'all'],
      flags:  ['',        ''],
      descs:  ['区域ID',  '解锁等级'],
    }
    expect(() => applyChanges('/nonexistent.xlsx', headers, [
      { field: 'area_id', rowKey: 1, newValue: 999 },
    ])).toThrow(/read-only/)
  })
})
