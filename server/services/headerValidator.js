// server/services/headerValidator.js
const VALID_SCOPES = new Set(['allkey','allmainkey','allchildkey','allsubkey','all','server','client'])
const READONLY_SCOPES = new Set(['allkey','allmainkey'])
// Digit followed by uppercase OR uppercase followed by digit
const DIGIT_UPPER_RE = /\d[A-Z]|[A-Z]\d/

function validateFieldName(name) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return { ok: false, error: 'Field name must not be empty' }
  }
  if (DIGIT_UPPER_RE.test(name)) {
    return { ok: false, error: `Field name "${name}" contains digit+uppercase adjacent pattern (forbidden by config-table-rules §14)` }
  }
  return { ok: true }
}

function validateScope(scope) {
  if (!VALID_SCOPES.has(scope)) {
    return { ok: false, error: `Scope "${scope}" is not valid. Allowed: ${[...VALID_SCOPES].join(', ')}` }
  }
  return { ok: true }
}

/**
 * Validate a list of data-row changes against the table's headers.
 * changes: [{ field, newValue, rowKey? }]
 * headers: { fields, types, scopes, flags, descs }
 */
function validateChanges(changes, headers) {
  const errors = []
  for (const change of changes) {
    const idx = headers.fields.indexOf(change.field)
    if (idx === -1) {
      errors.push(`Unknown field: "${change.field}"`)
      continue
    }
    const scope = headers.scopes[idx]
    if (READONLY_SCOPES.has(scope)) {
      errors.push(`Field "${change.field}" has scope "${scope}" and is read-only (primary key)`)
      continue
    }
    const type = headers.types[idx]
    if (type === 'int' || type === 'float') {
      if (change.newValue == null) continue  // null and undefined both mean "no change"
      const isNumStr = typeof change.newValue === 'string' && change.newValue.trim() !== ''
      const isNum    = typeof change.newValue === 'number'
      if ((!isNum && !isNumStr) || isNaN(Number(change.newValue))) {
        errors.push(`Field "${change.field}" expects ${type}, got "${change.newValue}"`)
      }
    }
  }
  return { errors }
}

module.exports = { validateFieldName, validateScope, validateChanges }
