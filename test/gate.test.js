import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEmail, isExamCode, parseExamCodes } from '../src/gate.js'

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

test('isEmail', () => {
  assert.equal(isEmail('a@b.co'), true)
  assert.equal(isEmail(' A@B.co '), true)
  assert.equal(isEmail('gaun.hs.kr'), false)
  assert.equal(isEmail('a@b'), false)
})
