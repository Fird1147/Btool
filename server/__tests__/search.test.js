// server/__tests__/search.test.js
const path = require('path')
const { searchTables } = require('../routes/search')

const FIXTURE_DIR = path.join(__dirname, 'fixtures')

describe('searchTables', () => {
  it('matches table name', () => {
    const results = searchTables('hospital_area', FIXTURE_DIR)
    expect(results.some(r => r.type === 'table' && r.table === 'hospital_area')).toBe(true)
  })

  it('matches folder name', () => {
    const results = searchTables('sample-app', FIXTURE_DIR)
    expect(results.some(r => r.folder.includes('sample-app'))).toBe(true)
  })

  it('matches field name in headers', () => {
    const results = searchTables('area_id', FIXTURE_DIR)
    expect(results.some(r => r.type === 'field' && r.field === 'area_id')).toBe(true)
  })

  it('matches cell value in data rows', () => {
    const results = searchTables('1', FIXTURE_DIR)
    expect(results.some(r => r.type === 'cell')).toBe(true)
  })

  it('returns empty array for no match', () => {
    const results = searchTables('xyznotexist123', FIXTURE_DIR)
    expect(results).toEqual([])
  })

  it('is case insensitive', () => {
    const results = searchTables('AREA_ID', FIXTURE_DIR)
    expect(results.some(r => r.field && r.field.toLowerCase() === 'area_id')).toBe(true)
  })

  it('supports Chinese character search', () => {
    // hospital_area Row5 has Chinese descriptions (区域 etc.)
    const results = searchTables('区域', FIXTURE_DIR)
    expect(results.length).toBeGreaterThan(0)
  })
})
