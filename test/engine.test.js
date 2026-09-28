import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { convert, searchRange, search, applyFilters, sortRows, COL } from '../src/engine.js'

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

const SAMPLE = [
  ['서울', '한양대', '종합', '고른기회', '자연', '학부A', 5, 20.2, 9, 1.49],
  ['경기', '가천대', '교과', '특성화고교', '자연', '기계공학부', 4, 15.25, 1, 1.38],
  ['강원', '강원대', '교과', '저소득전형', '자연', '약학과', 4, 8, 3, 1.45],
  ['경기', '경기대', '교과', '농어촌학생전형', '인문', '공공안전학부', 3, null, 5, 1.33],
]

test('applyFilters: 빈 조건은 전체', () => {
  assert.equal(applyFilters(SAMPLE, { regions: new Set(), type: '', track: '' }).length, 4)
})

test('applyFilters: 지역 복수 + 전형 + 계열', () => {
  const r = applyFilters(SAMPLE, { regions: new Set(['경기', '강원']), type: '교과', track: '자연' })
  assert.deepEqual(r.map((x) => x[COL.univ]), ['가천대', '강원대'])
})

test('sortRows: 문자열 오름차순(한글), 원본 배열 불변', () => {
  const s = sortRows(SAMPLE, COL.univ, 'asc')
  assert.deepEqual(s.map((x) => x[COL.univ]), ['가천대', '강원대', '경기대', '한양대'])
  assert.equal(SAMPLE[0][COL.univ], '한양대')
})

test('sortRows: 숫자 내림차순, null은 항상 마지막', () => {
  const s = sortRows(SAMPLE, COL.ratio, 'desc')
  assert.deepEqual(s.map((x) => x[COL.ratio]), [20.2, 15.25, 8, null])
  const a = sortRows(SAMPLE, COL.ratio, 'asc')
  assert.deepEqual(a.map((x) => x[COL.ratio]), [8, 15.25, 20.2, null])
})
