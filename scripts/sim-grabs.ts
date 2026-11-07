// 화면 없이 뽑기를 반복해 성공률과 물리 오류를 확인한다: npm run sim
import { STRENGTHS } from '../src/constants'
import { Autopilot, initPhysics, Sim, type Input } from '../src/sim'

await initPhysics()
const TRIES = 60

for (let level = 0; level < STRENGTHS.length; level++) {
  let wins = 0, tries = 0, maxSpeed = 0, escaped = 0, stuck = 0
  for (let seed = 1; seed <= 2; seed++) {
    const sim = new Sim({ seed: seed * 101, species: 6 })
    sim.strength = level
    if (sim.dolls.some((d) => d.p.x < -0.15 && d.p.z > 0.04)) throw new Error('시작 전에 출구에 인형이 있음')
    const auto = new Autopilot()
    const input: Input = { x: 0, y: 0, rot: 0 }
    let ticks = 0
    while (sim.tries < TRIES / 2 && ticks < 60 * 60 * 20) {
      auto.update(sim, input)
      sim.tick(input)
      ticks++
      for (const d of sim.dolls) {
        if (d.gone) continue
        const v = d.body.linvel()
        maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z))
        const t = d.body.translation()
        if (Math.abs(t.x) > 0.56 || Math.abs(t.z) > 0.46 || t.y < -0.02) escaped++
      }
    }
    if (sim.tries < TRIES / 2) stuck++
    wins += sim.wins
    tries += sim.tries
  }
  console.log(`${STRENGTHS[level].name}: ${wins}/${tries} 성공, 인형 최고 속도 ${maxSpeed.toFixed(2)} m/s, 밖으로 나간 프레임 ${escaped}, 멈춤 ${stuck}`)
}
