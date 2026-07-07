const path = require('path')
const { scanTables, readTable } = require('../services/tableReader')

const FIXTURE_DIR = path.join(__dirname, 'fixtures')

describe('scanTables', () => {
  it('returns list of tables with name, folder, path', () => {
    const tables = scanTables(FIXTURE_DIR)
    expect(tables.length).toBeGreaterThan(0)
    expect(tables[0]).toMatchObject({
      name: expect.any(String),
      folder: expect.any(String),
      path: expect.stringMatching(/\.xlsx$/),
    })
  })
})

describe('readTable', () => {
  it('parses 5-row header correctly', () => {
    const tables = scanTables(FIXTURE_DIR)
    const table = readTable(tables[0].path)
    expect(table.headers.fields).toBeInstanceOf(Array)
    expect(table.headers.types).toBeInstanceOf(Array)
    expect(table.headers.scopes).toBeInstanceOf(Array)
    expect(table.headers.flags).toBeInstanceOf(Array)
    expect(table.headers.descs).toBeInstanceOf(Array)
  })

  it('returns data rows as objects keyed by field name', () => {
    const tables = scanTables(FIXTURE_DIR)
    const table = readTable(tables[0].path)
    expect(table.rows).toBeInstanceOf(Array)
    if (table.rows.length > 0) {
      expect(typeof table.rows[0]).toBe('object')
    }
  })

  it('skips columns with empty field names (placeholder columns)', () => {
    const tables = scanTables(FIXTURE_DIR)
    const table = readTable(tables[0].path)
    expect(table.headers.fields.every(f => f !== null && f !== undefined)).toBe(true)
  })
})

describe('scanTables sorting', () => {
  it('returns folders in natural numeric order', () => {
    const tables = scanTables(FIXTURE_DIR)
    const folders = [...new Set(tables.map(t => t.folder))]
    const sorted = [...folders].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )
    expect(folders).toEqual(sorted)
  })
})
