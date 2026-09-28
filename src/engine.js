// 순수 계산 함수. DOM을 모른다. index.html과 test/에서 임포트한다.

export const COL = {
  region: 0, univ: 1, type: 2, typeName: 3, track: 4, unit: 5,
  quota: 6, ratio: 7, waitlist: 8, cut70: 9,
}

/** 5등급제 등급 → 환산 9등급. pairs는 [g5, g9] 오름차순. 범위(1~5) 밖·NaN → null.
 *  엑셀 VLOOKUP 근사 매칭: g5 이하의 가장 큰 키의 값. */
export function convert(g5, pairs) {
  if (typeof g5 !== 'number' || Number.isNaN(g5)) return null
  if (g5 < pairs[0][0] || g5 > pairs[pairs.length - 1][0]) return null
  let lo = 0, hi = pairs.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pairs[mid][0] <= g5) lo = mid
    else hi = mid - 1
  }
  return pairs[lo][1]
}

const r3 = (x) => Math.round(x * 1000) / 1000

/** 검색 범위. 1.39-0.1 = 1.2899999… 같은 부동소수 오차를 소수 셋째자리로 정리. */
export function searchRange(conv, down, up) {
  return { lo: r3(conv - down), hi: r3(conv + up) }
}
