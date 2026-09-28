import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { convert, searchRange } from '../src/engine.js'

const conv = JSON.parse(readFileSync(new URL('../data/conv.json', import.meta.url), 'utf8'))
const PAIRS = conv.pairs

test('convert: 표에 있는 값', () => {
  assert.equal(convert(1.1, PAIRS), 1.39)
  assert.equal(convert(1, PAIRS), 1.24)
  assert.equal(convert(5, PAIRS), 8.97)
})

test('convert: 표에 없는 값은 이하의 최대 키 (VLOOKUP 근사)', () => {
  // 1.118 → 1.5, 1.15 → 1.51 이므로 1.12는 1.118의 값
  assert.equal(convert(1.12, PAIRS), 1.5)
  assert.equal(convert(4.99, PAIRS), 7.87) // 4.947의 값
})

test('convert: 범위 밖·비정상 입력은 null', () => {
  assert.equal(convert(0.99, PAIRS), null)
  assert.equal(convert(5.01, PAIRS), null)
  assert.equal(convert(NaN, PAIRS), null)
  assert.equal(convert(null, PAIRS), null)
})

test('searchRange: 부동소수 오차 없이 소수 셋째자리', () => {
  assert.deepEqual(searchRange(1.39, 0.1, 0.1), { lo: 1.29, hi: 1.49 })
  assert.deepEqual(searchRange(1.39, 0.2, 0.05), { lo: 1.19, hi: 1.44 })
  assert.deepEqual(searchRange(1.39, 0, 0), { lo: 1.39, hi: 1.39 })
})
