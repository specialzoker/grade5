import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { convert, searchRange, search } from '../src/engine.js'

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

const ipgyeol = JSON.parse(readFileSync(new URL('../data/ipgyeol.json', import.meta.url), 'utf8'))
const golden = JSON.parse(readFileSync(new URL('../test-data/golden.json', import.meta.url), 'utf8'))
const ROWS = ipgyeol.rows

test('search 골든: 입력 1.1 → 결과시트 259행과 집합 일치', () => {
  const c = convert(golden.input, PAIRS)
  assert.equal(c, golden.converted)
  const { lo, hi } = searchRange(c, 0.1, 0.1)
  assert.equal(lo, golden.lo)
  assert.equal(hi, golden.hi)
  const got = search(ROWS, lo, hi)
  assert.equal(got.length, 259)
  const key = (r) => r.slice(0, 6).join('|') + '|' + r[9]
  assert.deepEqual(new Set(got.map(key)), new Set(golden.rows.map(key)))
})

test('search: 양끝 미포함', () => {
  const got = search(ROWS, 1.29, 1.49)
  assert.ok(got.every((r) => r[9] > 1.29 && r[9] < 1.49))
  assert.ok(ROWS.some((r) => r[9] === 1.29), '데이터에 1.29 행이 있어야 경계 테스트가 의미 있음')
  assert.ok(ROWS.some((r) => r[9] === 1.49))
})

test('search: lo > hi 이거나 범위에 없으면 빈 배열', () => {
  assert.deepEqual(search(ROWS, 1.49, 1.29), [])
  assert.deepEqual(search(ROWS, 0.5, 0.9), [])
})
