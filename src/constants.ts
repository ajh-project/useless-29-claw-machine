// 기계 치수 (단위: 미터). 물리와 그래픽이 같은 값을 쓴다
export const CW = 0.52 // 안쪽 너비의 절반
export const CD = 0.42 // 안쪽 깊이의 절반
export const CH = 1.2 // 높이
export const RAIL_Y = CH - 0.05
export const PIVOT_Y = RAIL_Y - 0.065 // 줄이 매달린 지점
export const TOP_Y = 0.98 // 집게 머리가 쉬는 높이

// 출구: 왼쪽 앞 아크릴 상자
export const CHUTE = { x0: -0.5, x1: -0.15, z0: 0.04, z1: 0.4, h: 0.3 }
export const HOME_X = (CHUTE.x0 + CHUTE.x1) / 2
export const HOME_Z = (CHUTE.z0 + CHUTE.z1) / 2

// 3발 집게: 머리 기준 위치와 팔 곡선(x: 바깥쪽, y: 아래쪽)
export const PRONG_Y = -0.142
export const PRONG_X = 0.025
export const PRONG_YAW = 0.5
export const PRONG_PTS: [number, number][] = [
  [0, 0],
  [0.048, -0.016],
  [0.09, -0.065],
  [0.104, -0.125],
  [0.09, -0.185],
  [0.05, -0.225],
]
export const CLAW_LEN = 0.377
export const OPEN_REST = 0.2 // 쉴 때 벌어진 각도
export const OPEN_DOWN = 0.38 // 내려갈 때 벌어진 각도
export const CLOSED = -0.12 // 완전히 닫힌 각도

// 집게 힘: 잡은 뒤 얼마나 풀리는가. 게임 화면에 그대로 표시한다
export const STRENGTHS = [
  { name: '강함', relax: 0.0 },
  { name: '보통', relax: 0.2 },
  { name: '실제 기계', relax: 0.32 },
]
