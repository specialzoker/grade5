// 접근 게이트. 순수 함수(normalizeCode, isEmail)는 DOM·Firebase를 모른다.

/** 홈페이지 주소 → 코드. 소문자, 스킴·경로·앞 www. 제거. 빈 값이면 null. */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null
  let s = input.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.split(/[/?#]/)[0]
  s = s.replace(/^www\./, '')
  return s || null
}

export function isEmail(input) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input || '').trim())
}
