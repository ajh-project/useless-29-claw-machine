// 게임 규칙과 물리. 화면과 분리되어 있어 scripts/sim-grabs.ts로 그대로 시뮬레이션할 수 있다
import RAPIER from '@dimforge/rapier3d-compat'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import {
  CD, CH, CHUTE, CLAW_LEN, CLOSED, CW, HOME_X, HOME_Z, OPEN_DOWN, OPEN_REST, PIVOT_Y, PRONG_PTS,
  PRONG_X, PRONG_Y, PRONG_YAW, STRENGTHS, TOP_Y,
} from './constants'

export const initPhysics = () => RAPIER.init()

export type Input = { x: number; y: number; rot: number }
export type State = 'idle' | 'down' | 'close' | 'up' | 'carry' | 'release'
export type Doll = {
  sp: number
  i: number
  s: number
  body: RAPIER.RigidBody
  p: Vector3
  q: Quaternion
  gone: boolean
}

const H = 1 / 60
const MAX_SPEED = 0.38
const ACCEL = 13
const CARRY_SPEED = 0.24
const DOWN_SPEED = 0.3
const UP_SPEED = 0.26
const CLOSE_SPEED = 1.5

function makeRng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Sim {
  world: RAPIER.World
  dolls: Doll[] = []
  state: State = 'idle'
  claw = { x: 0.12, z: 0.02, vx: 0, vz: 0, y: TOP_Y, yaw: PRONG_YAW, open: OPEN_REST, swX: 0, swZ: 0, swVX: 0, swVZ: 0 }
  tries = 0
  wins = 0
  strength = 1
  onPrize: (d: Doll) => void = () => {}
  private prongs: RAPIER.RigidBody[] = []
  private palm: RAPIER.RigidBody
  private palmCollider: RAPIER.Collider
  private byCollider = new Map<number, Doll>()
  private acc = 0
  private t = 0 // 현재 상태가 시작된 뒤 지난 시간
  private targetY = TOP_Y
  private spin = { a: 0, w1: 1, w2: 1, ph1: 0, ph2: 0 }
  private rand: () => number
  private ready = false

  constructor(opts: { count: number; seed: number; species: number }) {
    this.rand = makeRng(opts.seed)
    this.world = new RAPIER.World({ x: 0, y: -7.5, z: 0 })
    this.world.timestep = H
    this.buildCabinet()
    this.palm = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    this.palmCollider = this.world.createCollider(RAPIER.ColliderDesc.ball(0.045).setFriction(0.7), this.palm)
    for (let i = 0; i < 3; i++) this.prongs.push(this.buildProng())
    this.moveClaw(true)
    this.spawn(opts.count, opts.species)
    for (let i = 0; i < 420; i++) this.world.step() // 인형이 쌓일 때까지 미리 돌림
    this.clearChute()
    this.readDolls()
    this.ready = true
  }

  private wall(hx: number, hy: number, hz: number, x: number, y: number, z: number) {
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.8))
  }

  private buildCabinet() {
    const t = 0.2 // 집게에 눌려도 뚫리지 않도록 벽을 두껍게
    this.wall(CW + t, t, CD + t, 0, -t, 0)
    this.wall(CW + t, CH, t, 0, CH, -CD - t)
    this.wall(CW + t, CH, t, 0, CH, CD + t)
    this.wall(t, CH, CD + t, -CW - t, CH, 0)
    this.wall(t, CH, CD + t, CW + t, CH, 0)
    // 출구 상자: 앞쪽과 왼쪽은 기계 벽이고, 인형 더미 쪽 두 면만 세운다
    const c = CHUTE
    const w = 0.012
    this.wall((c.x1 - c.x0) / 2 + w, c.h / 2, w, (c.x0 + c.x1) / 2, c.h / 2, c.z0)
    this.wall(w, c.h / 2, (c.z1 - c.z0) / 2 + w, c.x1, c.h / 2, (c.z0 + c.z1) / 2)
  }

  private buildProng() {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    const up = new Vector3(0, 1, 0)
    for (let k = 0; k < PRONG_PTS.length - 1; k++) {
      const a = PRONG_PTS[k], b = PRONG_PTS[k + 1]
      const d = new Vector3(b[0] - a[0], b[1] - a[1], 0)
      const q = new Quaternion().setFromUnitVectors(up, d.clone().normalize())
      const desc = RAPIER.ColliderDesc.capsule(d.length() / 2, 0.011)
        .setTranslation((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setFriction(1.15)
      this.world.createCollider(desc, body)
    }
    return body
  }

  private spawn(count: number, species: number) {
    const R = this.rand
    const counts = new Array(species).fill(0)
    for (let i = 0; i < count; i++) {
      const sp = i % species
      const s = 0.2 + R() * 0.06
      let x = 0, z = 0
      do {
        x = -0.42 + R() * 0.84
        z = -0.32 + R() * 0.66
      } while (x < CHUTE.x1 + s * 0.45 && z > CHUTE.z0 - s * 0.45)
      const q = new Quaternion().setFromEuler(new Euler(-1.05 + R() * 1.3, -0.95 + R() * 1.9, -0.95 + R() * 1.9))
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x, 0.2 + i * 0.065, z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setLinearDamping(0.7)
          .setAngularDamping(1.6)
          .setCcdEnabled(false),
      )
      const doll: Doll = { sp, i: counts[sp]++, s, body, p: new Vector3(), q: new Quaternion(), gone: false }
      // 몸통·머리에 팔다리까지 넣어, 집게 팔이 걸리고 미끄러지는 곳이 실제 인형처럼 생기게 함
      const balls: [number, number, number, number][] = [
        [0, -0.2, 0, 0.34], [0, 0.22, 0.04, 0.31],
        [-0.38, -0.1, 0.1, 0.12], [0.38, -0.1, 0.1, 0.12],
        [-0.2, -0.48, 0.24, 0.14], [0.2, -0.48, 0.24, 0.14],
      ]
      for (const [bx, by, bz, br] of balls) {
        const c = this.world.createCollider(
          RAPIER.ColliderDesc.ball(br * s).setTranslation(bx * s, by * s, bz * s).setDensity(70).setFriction(1).setRestitution(0),
          body,
        )
        this.byCollider.set(c.handle, doll)
      }
      this.dolls.push(doll)
    }
  }

  // 쌓는 도중 출구로 굴러간 인형은 더미 쪽으로 옮겨 시작 전에 뽑힌 것으로 치지 않음
  private clearChute() {
    for (const d of this.dolls) {
      const t = d.body.translation()
      if (t.x < CHUTE.x1 + 0.02 && t.z > CHUTE.z0 - 0.02) {
        d.body.setTranslation({ x: 0.3, y: 0.8, z: -0.2 }, true)
        d.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
    for (let i = 0; i < 120; i++) this.world.step()
  }

  private readDolls() {
    for (const d of this.dolls) {
      if (d.gone) continue
      const t = d.body.translation(), r = d.body.rotation()
      d.p.set(t.x, t.y, t.z)
      d.q.set(r.x, r.y, r.z, r.w)
    }
  }

  // 집게 팔마다 위치를 계산해 물리 세계에 전달한다 (그래픽의 부모-자식 구조와 같은 순서)
  private moveClaw(teleport = false) {
    const c = this.claw
    const base = new Matrix4()
      .makeTranslation(c.x, PIVOT_Y, c.z)
      .multiply(new Matrix4().makeRotationFromEuler(new Euler(c.swX, 0, c.swZ)))
      .multiply(new Matrix4().makeTranslation(0, c.y - PIVOT_Y, 0))
      .multiply(new Matrix4().makeRotationY(c.yaw))
    const pos = new Vector3(), quat = new Quaternion(), scl = new Vector3()
    const apply = (b: RAPIER.RigidBody, m: Matrix4) => {
      m.decompose(pos, quat, scl)
      if (teleport) {
        b.setTranslation(pos, true)
        b.setRotation(quat, true)
      } else {
        b.setNextKinematicTranslation(pos)
        b.setNextKinematicRotation(quat)
      }
    }
    apply(this.palm, base.clone().multiply(new Matrix4().makeTranslation(0, -0.12, 0)))
    this.prongs.forEach((b, i) => {
      apply(
        b,
        base.clone()
          .multiply(new Matrix4().makeTranslation(0, PRONG_Y, 0))
          .multiply(new Matrix4().makeRotationY((i * Math.PI * 2) / 3 + PRONG_YAW))
          .multiply(new Matrix4().makeTranslation(PRONG_X, 0, 0))
          .multiply(new Matrix4().makeRotationZ(c.open)),
      )
    })
  }

  // 집게 아래에서 가장 위에 있는 인형 높이
  private surfaceBelow() {
    const ray = new RAPIER.Ray({ x: this.claw.x, y: CH - 0.1, z: this.claw.z }, { x: 0, y: -1, z: 0 })
    const hit = this.world.castRay(ray, CH, true, undefined, undefined, undefined, undefined, (c) => this.byCollider.has(c.handle))
    return hit ? CH - 0.1 - hit.timeOfImpact : 0.05
  }

  private palmTouching() {
    let touching = false
    this.world.contactPairsWith(this.palmCollider, (other) => {
      if (touching || !this.byCollider.has(other.handle)) return
      this.world.contactPair(this.palmCollider, other, (m) => {
        if (m.numContacts() > 0) touching = true
      })
    })
    return touching
  }

  // 버튼 한 번: 내려가기. 내려가는 중 한 번 더: 그 자리에서 집기
  press() {
    if (this.state === 'idle') {
      this.tries++
      const R = this.rand
      // 줄이 꼬이며 도는 패턴. 매번 달라서 눈으로 보고 타이밍을 맞춰야 한다
      this.spin = { a: 1.5 + R() * 1.1, w1: 1.3 + R() * 1.5, w2: 2.9 + R() * 1.8, ph1: R() * 6.28, ph2: R() * 6.28 }
      this.targetY = Math.max(this.surfaceBelow() - 0.1 + CLAW_LEN, 0.4)
      this.setState('down')
    } else if (this.state === 'down') {
      this.setState('close')
    }
  }

  get canMove() {
    return this.state === 'idle'
  }

  private setState(s: State) {
    this.state = s
    this.t = 0
  }

  update(dt: number, input: Input) {
    this.acc = Math.min(this.acc + dt, 0.1)
    while (this.acc >= H) {
      this.tick(input)
      this.acc -= H
    }
    this.readDolls()
  }

  tick(input: Input) {
    const c = this.claw
    this.t += H
    // 레버를 미는 만큼 바로 따라가고, 급하게 바꾸면 줄이 그만큼 크게 흔들림
    let tx = 0, tz = 0
    if (this.state === 'idle') {
      tx = input.x * MAX_SPEED
      tz = input.y * MAX_SPEED
      c.yaw += input.rot * H * 1.8
    } else if (this.state === 'carry') {
      const dx = HOME_X - c.x, dz = HOME_Z - c.z
      const l = Math.hypot(dx, dz) || 1
      const sp = Math.min(CARRY_SPEED, l * 3)
      tx = (dx / l) * sp
      tz = (dz / l) * sp
    }
    const ox = c.vx, oz = c.vz
    const k = Math.min(1, H * ACCEL)
    c.vx += (tx - c.vx) * k
    c.vz += (tz - c.vz) * k
    c.x = Math.max(-0.46, Math.min(0.46, c.x + c.vx * H))
    c.z = Math.max(-0.33, Math.min(0.35, c.z + c.vz * H))
    const ax = (c.vx - ox) / H, az = (c.vz - oz) / H
    c.swVX += (az * 0.22 - c.swX * 26 - c.swVX * 1.5) * H
    c.swVZ += (-ax * 0.22 - c.swZ * 26 - c.swVZ * 1.5) * H
    c.swX = Math.max(-0.4, Math.min(0.4, c.swX + c.swVX * H))
    c.swZ = Math.max(-0.4, Math.min(0.4, c.swZ + c.swVZ * H))

    const st = STRENGTHS[this.strength]
    if (this.state === 'down') {
      const s = this.spin
      c.yaw += H * s.a * (Math.sin(this.t * s.w1 + s.ph1) + 0.55 * Math.sin(this.t * s.w2 + s.ph2))
      c.y -= DOWN_SPEED * H
      c.open += (OPEN_DOWN - c.open) * Math.min(1, H * 5)
      if (c.y <= this.targetY || this.palmTouching()) this.setState('close')
    } else if (this.state === 'close') {
      c.open = Math.max(CLOSED, c.open - CLOSE_SPEED * H)
      if (c.open <= CLOSED && this.t > 0.3) this.setState('up')
    } else if (this.state === 'up') {
      c.y = Math.min(TOP_Y, c.y + UP_SPEED * H)
      // 처음엔 꽉 잡았다가 힘이 빠짐. 인형이 잘 걸려 있어야 버틴다
      const goal = CLOSED + (this.t > 0.45 ? st.relax : 0)
      c.open += Math.sign(goal - c.open) * Math.min(Math.abs(goal - c.open), 0.3 * H)
      if (c.y >= TOP_Y) this.setState('carry')
    } else if (this.state === 'carry') {
      if (Math.hypot(HOME_X - c.x, HOME_Z - c.z) < 0.012 && Math.hypot(c.vx, c.vz) < 0.03) this.setState('release')
    } else if (this.state === 'release') {
      c.open = Math.min(OPEN_REST + 0.2, c.open + 1.6 * H)
      if (this.t > 1.2) {
        c.open = OPEN_REST
        this.setState('idle')
      }
    }

    this.moveClaw()
    this.world.step()
    this.checkDolls()
  }

  private checkDolls() {
    if (!this.ready) return
    for (const d of this.dolls) {
      if (d.gone) continue
      // 집게 사이에 끼었다 빠질 때 총알처럼 튀지 않게 속도를 제한
      const v = d.body.linvel()
      const speed = Math.hypot(v.x, v.y, v.z)
      if (speed > 2.2) d.body.setLinvel({ x: (v.x / speed) * 2.2, y: (v.y / speed) * 2.2, z: (v.z / speed) * 2.2 }, true)
      const t = d.body.translation()
      if (t.x < CHUTE.x1 && t.z > CHUTE.z0 && t.y < 0.2) {
        d.gone = true
        this.world.removeRigidBody(d.body)
        this.wins++
        this.onPrize(d)
      } else if (!isFinite(t.y) || t.y < 0 || Math.abs(t.x) > CW || Math.abs(t.z) > CD) {
        // 눌려서 벽 밖으로 밀린 인형은 그 자리에서 안쪽으로 되돌림
        const lim = (v: number, m: number) => Math.max(-m, Math.min(m, isFinite(v) ? v : 0))
        d.body.setTranslation({ x: lim(t.x, CW - 0.1), y: Math.max(isFinite(t.y) ? t.y : 0.5, 0.12), z: lim(t.z, CD - 0.1) }, true)
        d.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        d.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
  }
}

// 자동 조작: 시뮬레이션과 화면 확인(?auto)에서 함께 쓴다
export class Autopilot {
  private target: Doll | null = null
  update(sim: Sim, input: Input) {
    input.x = input.y = input.rot = 0
    if (sim.state !== 'idle') {
      this.target = null
      return
    }
    if (!this.target || this.target.gone) {
      const top = sim.dolls
        .filter((d) => !d.gone && Math.abs(d.p.x) < 0.42 && d.p.z > -0.3 && d.p.z < 0.32 && !(d.p.x < -0.1 && d.p.z > 0))
        .sort((a, b) => b.p.y - a.p.y)
        .slice(0, 6)
      this.target = top[Math.floor(Math.random() * top.length)] ?? null
    }
    if (!this.target) return
    const dx = this.target.p.x - sim.claw.x, dz = this.target.p.z - sim.claw.z
    if (Math.hypot(dx, dz) < 0.012 && Math.hypot(sim.claw.vx, sim.claw.vz) < 0.02) {
      sim.press()
      return
    }
    input.x = Math.max(-1, Math.min(1, dx * 5))
    input.y = Math.max(-1, Math.min(1, dz * 5))
  }
}
