import test from 'node:test'
import assert from 'node:assert/strict'
import {calc, validateReport} from '../src/valuation.js'

const report = {id: 'a', date: '2026-10-04', owner: 'Asha', cert: 'CERT-1', valuer: 'Ravi', silverG: '100', goldG: '7000', items: []}

test('calculates metal values from net weight and purity', () => {
  assert.deepEqual(calc({metal: 'Gold', gross: '10', stone: '2', purity: '75', fixed: '100'}, report), {net: 8, pure: 6, rate: 70000, value: 42100})
})

test('rejects incomplete, unsafe and duplicate reports', () => {
  const invalid = {...report, cert: 'CERT-2', items: [{name: 'Ring', metal: 'Gold', qty: 1, gross: '5', stone: '6', purity: '120', fixed: ''}]}
  assert.equal(validateReport(invalid, [{id: 'other', cert: 'cert-2'}]).length >= 3, true)
})

test('accepts a complete report', () => {
  const valid = {...report, items: [{name: 'Ring', metal: 'Gold', qty: 1, gross: '5', stone: '1', purity: '91.6', fixed: ''}]}
  assert.deepEqual(validateReport(valid), [])
})
