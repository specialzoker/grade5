import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCode, isEmail, isExamCode, parseExamCodes } from '../src/gate.js'

test('isExamCode: 숫자 5자리만', () => {
  assert.equal(isExamCode('17117'), true)
  assert.equal(isExamCode(' 17117 '), true)
  assert.equal(isExamCode('1711'), false)
  assert.equal(isExamCode('171170'), false)
  assert.equal(isExamCode('gaun-h.goegn.kr'), false)
})

test('parseExamCodes: 구분자·중복·잘못된 값 정리', () => {
  assert.deepEqual(parseExamCodes('17872, 17892'), ['17872', '17892'])
  assert.deepEqual(parseExamCodes('17117 17117 abc 123'), ['17117'])
  assert.deepEqual(parseExamCodes(''), [])
})

test('normalizeCode: 스킴·경로·www·대소문자·공백 제거', () => {
  assert.equal(normalizeCode('https://www.Gaun.hs.kr/main.do'), 'gaun.hs.kr')
  assert.equal(normalizeCode('  gaun.hs.kr  '), 'gaun.hs.kr')
  assert.equal(normalizeCode('http://gaun.hs.kr/'), 'gaun.hs.kr')
  assert.equal(normalizeCode('www.gaun.hs.kr'), 'gaun.hs.kr')
  assert.equal(normalizeCode('https://school.goe.go.kr/gaun?x=1'), 'school.goe.go.kr')
})

test('normalizeCode: 빈 값은 null', () => {
  assert.equal(normalizeCode(''), null)
  assert.equal(normalizeCode('   '), null)
  assert.equal(normalizeCode('https://'), null)
  assert.equal(normalizeCode(null), null)
})

test('isEmail', () => {
  assert.equal(isEmail('a@b.co'), true)
  assert.equal(isEmail(' A@B.co '), true)
  assert.equal(isEmail('gaun.hs.kr'), false)
  assert.equal(isEmail('a@b'), false)
})
