const { validateFieldName, validateScope, validateChanges } = require('../services/headerValidator')

describe('validateFieldName', () => {
  it('accepts valid snake_case names', () => {
    expect(validateFieldName('facility_id').ok).toBe(true)
    expect(validateFieldName('hospital_area_id').ok).toBe(true)
  })

  it('rejects digit+uppercase adjacent (3D, 4X, V2)', () => {
    expect(validateFieldName('city_building_3D').ok).toBe(false)
    expect(validateFieldName('model_4X').ok).toBe(false)
    expect(validateFieldName('versionV2').ok).toBe(false)
  })

  it('rejects empty field name', () => {
    expect(validateFieldName('').ok).toBe(false)
    expect(validateFieldName(null).ok).toBe(false)
  })
})

describe('validateScope', () => {
  const VALID = ['allkey','allmainkey','allchildkey','allsubkey','all','server','client']
  it('accepts all legal scope values', () => {
    for (const v of VALID) expect(validateScope(v).ok).toBe(true)
  })
  it('rejects unknown values', () => {
    expect(validateScope('ALL').ok).toBe(false)
    expect(validateScope('both').ok).toBe(false)
    expect(validateScope('').ok).toBe(false)
  })
})

describe('validateChanges', () => {
  const headers = {
    fields: ['area_id', 'area_name', 'is_default', 'unlock_castle_lv'],
    types:  ['int',     'string',    'int',         'int'],
    scopes: ['allkey',  'client',    'all',          'all'],
    flags:  ['',        '*langid',   '',             ''],
    descs:  ['区域ID',  '区域名称',  '是否默认(1是，0否)', '解锁等级'],
  }

  it('rejects changes to allkey fields', () => {
    const result = validateChanges([{ field: 'area_id', newValue: 99 }], headers)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects non-integer value for int field', () => {
    const result = validateChanges([{ field: 'is_default', newValue: 'abc' }], headers)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('accepts valid int change', () => {
    const result = validateChanges([{ field: 'unlock_castle_lv', newValue: 5 }], headers)
    expect(result.errors).toHaveLength(0)
  })
})
