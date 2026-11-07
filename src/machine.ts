// 기계 본체·집게·오락실 배경 그래픽
import * as T from 'three'
import { BIN_HX, BIN_HZ, BIN_RIM, BINS, CD, CH, CHUTE, CW, PRONG_PTS, PRONG_X, PRONG_Y, PRONG_YAW, PIVOT_Y, RAIL_Y } from './constants'
import type { Sim } from './sim'

export const FLOOR_Y = -0.78
const FONT ='"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif'

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  return t
}

function arcadeTexture() {
  return canvasTexture(2048, 1024, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 1024)
    sky.addColorStop(0, '#1c1226'); sky.addColorStop(0.5, '#3a2545'); sky.addColorStop(0.72, '#21142a'); sky.addColorStop(1, '#0c0810')
    g.fillStyle = sky
    g.fillRect(0, 0, 2048, 1024)
    const blob = (x: number, y: number, rx: number, ry: number, col: string, a: number) => {
      g.save(); g.translate(x, y); g.scale(rx, ry)
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 1)
      r.addColorStop(0, col); r.addColorStop(1, col + '00')
      g.globalAlpha = a; g.fillStyle = r
      g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore()
    }
    const cols = ['#ff4fb0', '#ff86d0', '#54e6ff', '#b67cff', '#ffd25e', '#6fffc6']
    for (let i = 0; i < 34; i++) {
      const x = (i / 34) * 2048
      blob(x, 520, 62, 170, cols[(i * 5) % 6], 0.55)
      blob(x, 395, 48, 24, '#ffffff', 0.5)
      blob(x, 600, 40, 70, cols[(i * 3 + 1) % 6], 0.5)
    }
    for (let i = 0; i < 22; i++) blob((i / 22) * 2048, 120, 70, 16, '#fff6ee', 0.85)
  })
}

function environment(renderer: T.WebGLRenderer, scene: T.Scene) {
  const s = new T.Scene()
  s.add(new T.Mesh(new T.BoxGeometry(12, 8, 12), new T.MeshBasicMaterial({ color: 0x1a1120, side: T.BackSide })))
  const pan = (x: number, y: number, z: number, w: number, h: number, col: number, k: number, ry = 0, rx = 0) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide }))
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, 0)
    s.add(m)
  }
  pan(0, 3.8, 0, 5, 1.2, 0xffffff, 14, 0, Math.PI / 2)
  pan(0, 3.8, 3, 5, 0.4, 0xffffff, 10, 0, Math.PI / 2)
  pan(-5.5, 1, 0, 0.6, 6, 0xff4fb0, 9, Math.PI / 2)
  pan(5.5, 1, 1, 0.6, 6, 0x54e6ff, 6, Math.PI / 2)
  pan(0, 1, 5.8, 3, 2.4, 0xfff0f4, 3)
  pan(2.5, 0.3, -5.8, 1.2, 3, 0xff86d0, 6)
  pan(-2.5, 0.3, -5.8, 1.2, 3, 0xb67cff, 6)
  const p = new T.PMREMGenerator(renderer)
  scene.environment = p.fromScene(s, 0.025).texture
  p.dispose()
}

export class Machine {
  private bridge = new T.Group()
  private carriage = new T.Group()
  private swing = new T.Group()
  private head = new T.Group()
  private turret = new T.Group()
  private cable: T.Mesh
  private coil: T.Mesh
  private pivots: T.Group[] = []
  private stick = new T.Group()
  private btn: T.Mesh
  private person = new T.Group()
  private upperArm!: T.Mesh
  private foreArm!: T.Mesh
  private hand!: T.Mesh

  constructor(private scene: T.Scene, renderer: T.WebGLRenderer, low: boolean) {
    scene.add(new T.Mesh(new T.SphereGeometry(9, 48, 24), new T.MeshBasicMaterial({ map: arcadeTexture(), side: T.BackSide })))
    environment(renderer, scene)

    scene.add(new T.HemisphereLight(0xfff2f8, 0x552a55, 0.55))
    const sun = new T.DirectionalLight(0xfff4ec, 2.3)
    sun.position.set(0.35, 2.4, 1.25)
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(low ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -0.85, right: 1.1, top: 1, bottom: -1.2, near: 0.5, far: 5.5 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.03
    sun.shadow.radius = 5
    scene.add(sun)
    const pink = new T.PointLight(0xff5fb4, 0.7, 3)
    pink.position.set(-0.52, 0.7, 0.38)
    scene.add(pink)
    const cool = new T.PointLight(0x9ad8ff, 1, 3)
    cool.position.set(0.52, 0.7, 0.3)
    scene.add(cool)

    const chrome = new T.MeshStandardMaterial({ color: 0xe9ecf2, metalness: 1, roughness: 0.1, envMapIntensity: 1.5 })
    const brushed = new T.MeshStandardMaterial({ color: 0xb9bfca, metalness: 1, roughness: 0.34 })
    const rubber = new T.MeshStandardMaterial({ color: 0x101014, roughness: 0.42 })
    this.buildCabinet(chrome, brushed)
    this.buildDeck(chrome, rubber)
    this.buildBase()
    this.buildPerson()
    const btnMat = new T.MeshPhysicalMaterial({ color: 0xc06cff, emissive: 0x7a2ad0, emissiveIntensity: 1.5, roughness: 0.15, clearcoat: 1 })
    this.btn = new T.Mesh(new T.CylinderGeometry(0.044, 0.048, 0.014, 32), btnMat)
    this.btn.position.set(0.09, -0.012, CD + 0.2)
    scene.add(this.btn)

    // 레일 → 다리 → 수레 → 줄 → 집게
    const railL = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, CD * 2, 14), chrome)
    railL.rotation.x = Math.PI / 2
    railL.position.set(-CW + 0.03, RAIL_Y, 0)
    scene.add(railL)
    const railR = railL.clone()
    railR.position.x = CW - 0.03
    scene.add(railR)
    scene.add(this.bridge)
    const bar = new T.Mesh(new T.BoxGeometry(CW * 2 - 0.05, 0.018, 0.035), brushed)
    bar.position.y = RAIL_Y
    bar.castShadow = true
    this.bridge.add(bar)
    this.carriage.position.y = RAIL_Y - 0.03
    this.bridge.add(this.carriage)
    const motor = new T.Mesh(new T.BoxGeometry(0.085, 0.07, 0.09), new T.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.34 }))
    motor.castShadow = true
    this.carriage.add(motor)
    this.swing.position.y = -0.035
    this.carriage.add(this.swing)
    this.cable = new T.Mesh(new T.CylinderGeometry(0.0028, 0.0028, 1, 8), new T.MeshStandardMaterial({ color: 0xcfd2d8, metalness: 1, roughness: 0.32 }))
    this.swing.add(this.cable)
    this.swing.add(this.head)
    this.head.add(this.turret)

    const pts: T.Vector3[] = []
    const turns = 11, n = turns * 12
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = u * turns * Math.PI * 2
      pts.push(new T.Vector3(Math.cos(a) * 0.022, -u, Math.sin(a) * 0.022))
    }
    this.coil = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), n * 2, 0.0042, 6, false), new T.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.36 }))
    this.coil.position.set(0.055, 0, 0.012)
    this.coil.castShadow = true
    this.swing.add(this.coil)

    const cyl = (r: number, h: number, y: number) => {
      const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 28), chrome)
      m.position.y = y
      m.castShadow = true
      this.turret.add(m)
    }
    cyl(0.024, 0.05, -0.025); cyl(0.031, 0.012, -0.056); cyl(0.025, 0.04, -0.082); cyl(0.034, 0.016, -0.11); cyl(0.03, 0.02, -0.128)

    const prongPts = PRONG_PTS.map(([x, y]) => new T.Vector3(x, y, 0))
    const prongGeo = new T.TubeGeometry(new T.CatmullRomCurve3(prongPts), 36, 0.0052, 10, false)
    for (let i = 0; i < 3; i++) {
      const w = new T.Group()
      w.rotation.y = (i * Math.PI * 2) / 3 + PRONG_YAW
      w.position.y = PRONG_Y
      this.turret.add(w)
      const pv = new T.Group()
      pv.position.x = PRONG_X
      w.add(pv)
      const pr = new T.Mesh(prongGeo, brushed)
      pr.castShadow = true
      pv.add(pr)
      const tip = new T.Mesh(new T.SphereGeometry(0.0095, 14, 10), rubber)
      tip.position.copy(prongPts[prongPts.length - 1])
      tip.scale.y = 1.6
      pv.add(tip)
      const hinge = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.02, 12), chrome)
      hinge.rotation.x = Math.PI / 2
      pv.add(hinge)
      this.pivots.push(pv)
    }
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, mat: T.Material, cast = false) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = cast
    m.receiveShadow = true
    this.scene.add(m)
    return m
  }

  private glow(w: number, h: number, x: number, y: number, z: number, col: number) {
    const g = canvasTexture(64, 64, (c) => {
      const r = c.createRadialGradient(32, 32, 0, 32, 32, 32)
      r.addColorStop(0, '#fff'); r.addColorStop(1, '#000')
      c.fillStyle = r
      c.fillRect(0, 0, 64, 64)
    })
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: g, color: col, blending: T.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }))
    m.position.set(x, y, z)
    this.scene.add(m)
  }

  private buildCabinet(chrome: T.Material, brushed: T.Material) {
    const led = (c: number) => new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(2.1), toneMapped: false })
    const pinkMetal = new T.MeshStandardMaterial({ color: 0xf08cc4, metalness: 0.92, roughness: 0.2, envMapIntensity: 1.2 })
    const acrylic = new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, envMapIntensity: 1.1, depthWrite: false, side: T.DoubleSide })
    const glass = new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.03, roughness: 0.015, envMapIntensity: 0.7, depthWrite: false })
    const b = this.box.bind(this)
    b(CW * 2 + 0.06, 0.04, CD * 2 + 0.06, 0, -0.02, 0, pinkMetal)
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b(0.035, CH + 0.04, 0.035, a * (CW + 0.008), CH / 2, c * (CD + 0.008), brushed, true)
    b(CW * 2 + 0.05, 0.05, 0.035, 0, CH + 0.01, CD + 0.008, brushed)
    b(CW * 2 + 0.05, 0.05, 0.035, 0, CH + 0.01, -CD - 0.008, brushed)
    b(0.035, 0.05, CD * 2, -CW - 0.008, CH + 0.01, 0, brushed)
    b(0.035, 0.05, CD * 2, CW + 0.008, CH + 0.01, 0, brushed)
    b(0.012, CH - 0.02, 0.012, -CW + 0.014, CH / 2, CD + 0.03, led(0xff5fb4))
    b(0.012, CH - 0.02, 0.012, CW - 0.014, CH / 2, CD + 0.03, led(0xff5fb4))
    b(CW * 2 - 0.02, 0.014, 0.012, 0, CH - 0.022, CD + 0.03, led(0xffc0e6))
    this.glow(0.2, 1.3, -CW + 0.014, CH / 2, CD + 0.04, 0xff4fb0)
    this.glow(0.2, 1.3, CW - 0.014, CH / 2, CD + 0.04, 0xff4fb0)
    this.glow(1.25, 0.18, 0, CH - 0.022, CD + 0.04, 0xff90d0)

    const front = new T.Mesh(new T.PlaneGeometry(CW * 2, CH), glass)
    front.position.set(0, CH / 2, CD)
    front.renderOrder = 5
    this.scene.add(front)
    const left = front.clone()
    left.position.set(-CW, CH / 2, 0)
    left.rotation.y = Math.PI / 2
    left.scale.x = CD / CW
    this.scene.add(left)
    const right = left.clone()
    right.position.x = CW
    this.scene.add(right)
    const back = front.clone()
    back.position.z = -CD
    this.scene.add(back)
    const streak = new T.Mesh(new T.PlaneGeometry(0.11, 1.5), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.055, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }))
    streak.position.set(0.23, 0.62, CD + 0.001)
    streak.rotation.z = -0.42
    streak.renderOrder = 6
    this.scene.add(streak)

    const signTex = canvasTexture(1024, 128, (g) => {
      const f = g.createLinearGradient(0, 0, 1024, 0)
      f.addColorStop(0, '#ff4fb0'); f.addColorStop(0.5, '#ffb2e0'); f.addColorStop(1, '#ff4fb0')
      g.fillStyle = f
      g.fillRect(0, 0, 1024, 128)
      g.fillStyle = '#2a0b22'
      g.font = `800 76px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('말랑 크레인', 512, 68)
    })
    const sign = new T.Mesh(new T.BoxGeometry(CW * 2 + 0.07, 0.135, 0.04), [brushed, brushed, brushed, brushed, new T.MeshBasicMaterial({ map: signTex, toneMapped: false }), brushed])
    sign.position.set(0, CH + 0.1, CD + 0.01)
    this.scene.add(sign)

    // 출구 상자
    const c = CHUTE
    b(c.x1 - c.x0, 0.004, c.z1 - c.z0, (c.x0 + c.x1) / 2, 0.004, (c.z0 + c.z1) / 2, new T.MeshStandardMaterial({ color: 0x08060a, roughness: 0.5 }))
    const walls: number[][] = [
      [c.x1 - c.x0, c.h, 0.006, (c.x0 + c.x1) / 2, c.h / 2, c.z0],
      [c.x1 - c.x0, c.h, 0.006, (c.x0 + c.x1) / 2, c.h / 2, c.z1],
      [0.006, c.h, c.z1 - c.z0, c.x0, c.h / 2, (c.z0 + c.z1) / 2],
      [0.006, c.h, c.z1 - c.z0, c.x1, c.h / 2, (c.z0 + c.z1) / 2],
    ]
    walls.forEach(([w, h, d, x, y, z]) => { b(w, h, d, x, y, z, acrylic).renderOrder = 4 })
    const edge = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.1, envMapIntensity: 2 })
    for (const [x, z] of [[c.x0, c.z1], [c.x1, c.z1], [c.x1, c.z0], [c.x0, c.z0]]) b(0.006, c.h, 0.006, x, c.h / 2, z, edge)
    const cardTex = canvasTexture(256, 320, (g) => {
      g.fillStyle = '#fff8f8'; g.fillRect(0, 0, 256, 320)
      g.fillStyle = '#c0132e'; g.fillRect(0, 0, 256, 64)
      g.fillStyle = '#fff'; g.font = `800 38px ${FONT}`; g.textAlign = 'center'
      g.fillText('경품 출구', 128, 46)
      g.fillStyle = '#231016'; g.font = `700 28px ${FONT}`
      ;['이 상자에', '인형을 떨어뜨리면', '획득!'].forEach((t, i) => g.fillText(t, 128, 130 + i * 56))
    })
    const card = new T.Mesh(new T.PlaneGeometry(0.09, 0.115), new T.MeshStandardMaterial({ map: cardTex, roughness: 0.5 }))
    card.position.set(c.x1 - 0.09, 0.17, c.z1 + 0.0045)
    this.scene.add(card)
    void chrome

    // 진열 상자: 투명 받침과 테두리
    const rimEdge = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.6, envMapIntensity: 1.6 })
    for (const n of BINS) {
      if (n.floor > 0) b(BIN_HX * 2, n.floor, BIN_HZ * 2, n.x, n.floor / 2, n.z, acrylic).renderOrder = 3
      const y = n.floor + BIN_RIM / 2, top = n.floor + BIN_RIM
      b(BIN_HX * 2, BIN_RIM, 0.005, n.x, y, n.z + BIN_HZ, acrylic).renderOrder = 4
      b(BIN_HX * 2, BIN_RIM, 0.005, n.x, y, n.z - BIN_HZ, acrylic).renderOrder = 4
      b(0.005, BIN_RIM, BIN_HZ * 2, n.x - BIN_HX, y, n.z, acrylic).renderOrder = 4
      b(0.005, BIN_RIM, BIN_HZ * 2, n.x + BIN_HX, y, n.z, acrylic).renderOrder = 4
      b(BIN_HX * 2 + 0.006, 0.005, 0.006, n.x, top, n.z + BIN_HZ, rimEdge)
      b(BIN_HX * 2 + 0.006, 0.005, 0.006, n.x, top, n.z - BIN_HZ, rimEdge)
      b(0.006, 0.005, BIN_HZ * 2, n.x - BIN_HX, top, n.z, rimEdge)
      b(0.006, 0.005, BIN_HZ * 2, n.x + BIN_HX, top, n.z, rimEdge)
    }
  }

  // 기계 아래쪽 몸통과 오락실 바닥. 사람 눈높이에 맞도록 바닥은 진열대보다 0.78m 아래
  private buildBase() {
    const panel = new T.MeshPhysicalMaterial({ color: 0xe0559f, metalness: 0.55, roughness: 0.32, clearcoat: 0.7 })
    this.box(CW * 2 + 0.07, 0.72, CD * 2 + 0.06, 0, FLOOR_Y + 0.36, 0, panel, true)
    this.box(CW * 2 + 0.07, 0.016, 0.012, 0, FLOOR_Y + 0.7, CD + 0.036, new T.MeshBasicMaterial({ color: new T.Color(0xff9ad8).multiplyScalar(1.8), toneMapped: false }))
    this.box(0.3, 0.26, 0.012, (CHUTE.x0 + CHUTE.x1) / 2, FLOOR_Y + 0.3, CD + 0.034, new T.MeshStandardMaterial({ color: 0x0b080d, roughness: 0.3, metalness: 0.4 }))
    this.box(0.1, 0.05, 0.01, 0.24, FLOOR_Y + 0.46, CD + 0.034, new T.MeshStandardMaterial({ color: 0x16121a, metalness: 0.8, roughness: 0.28 }))
    const floorTex = canvasTexture(256, 256, (g) => {
      g.fillStyle = '#2a2230'; g.fillRect(0, 0, 256, 256)
      g.fillStyle = '#3a3142'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128)
    })
    floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping
    floorTex.repeat.set(14, 14)
    const floor = new T.Mesh(new T.CircleGeometry(8.8, 48), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.3, metalness: 0.15 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = FLOOR_Y
    floor.receiveShadow = true
    this.scene.add(floor)
  }

  // 기계 앞에 선 사람: 뒷모습. 오른손이 레버를 잡고 움직인다
  private buildPerson() {
    const g = this.person
    g.position.set(0.98, FLOOR_Y, CD + 0.42)
    g.rotation.y = 0.75
    this.scene.add(g)
    const shirt = new T.MeshStandardMaterial({ color: 0xcdbfa8, roughness: 0.9 })
    const jeans = new T.MeshStandardMaterial({ color: 0x2c3a52, roughness: 0.85 })
    const skin = new T.MeshStandardMaterial({ color: 0xe0b394, roughness: 0.6 })
    const hair = new T.MeshStandardMaterial({ color: 0x17120f, roughness: 0.65 })
    const part = (geo: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const m = new T.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.scale.set(sx, sy, sz)
      m.castShadow = true
      g.add(m)
      return m
    }
    part(new T.CapsuleGeometry(0.075, 0.72, 6, 14), jeans, -0.1, 0.43, 0)
    part(new T.CapsuleGeometry(0.075, 0.72, 6, 14), jeans, 0.1, 0.43, 0)
    part(new T.CapsuleGeometry(0.18, 0.36, 8, 20), shirt, 0, 1.13, 0, 1.08, 1, 0.68)
    part(new T.CylinderGeometry(0.05, 0.056, 0.1, 14), skin, 0, 1.48, 0)
    part(new T.SphereGeometry(0.108, 28, 20), skin, 0, 1.6, 0, 0.95, 1.08, 1)
    part(new T.SphereGeometry(0.112, 28, 20), hair, 0, 1.635, 0.012, 0.98, 1, 0.98)
    part(new T.CapsuleGeometry(0.048, 0.56, 6, 12), shirt, 0.235, 1.1, 0).rotation.z = 0.08
    const limb = () => {
      const m = new T.Mesh(new T.CylinderGeometry(0.045, 0.042, 1, 12), shirt)
      m.castShadow = true
      this.scene.add(m)
      return m
    }
    this.upperArm = limb()
    this.foreArm = limb()
    this.hand = new T.Mesh(new T.SphereGeometry(0.046, 16, 12), skin)
    this.hand.castShadow = true
    this.scene.add(this.hand)
  }

  private setLimb(m: T.Mesh, a: T.Vector3, b: T.Vector3) {
    const d = b.clone().sub(a)
    m.position.copy(a).addScaledVector(d, 0.5)
    m.scale.y = d.length()
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize())
  }

  private syncArm() {
    this.stick.updateWorldMatrix(true, false)
    const hand = this.stick.localToWorld(new T.Vector3(0, 0.15, 0.012))
    this.person.updateWorldMatrix(true, false)
    const shoulder = this.person.localToWorld(new T.Vector3(-0.2, 1.34, -0.02))
    const elbow = shoulder.clone().lerp(hand, 0.5).add(new T.Vector3(0.1, -0.13, 0.05))
    this.setLimb(this.upperArm, shoulder, elbow)
    this.setLimb(this.foreArm, elbow, hand)
    this.hand.position.copy(hand)
  }

  private buildDeck(chrome: T.Material, rubber: T.Material) {
    const deck = new T.MeshPhysicalMaterial({ color: 0xf26cb8, metalness: 0.75, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 })
    this.box(CW * 2 + 0.08, 0.05, 0.36, 0, -0.045, CD + 0.2, deck)
    this.box(CW * 2 + 0.08, 0.012, 0.022, 0, -0.015, CD + 0.03, chrome)
    this.box(CW * 2 + 0.08, 0.012, 0.018, 0, -0.015, CD + 0.37, chrome)
    this.stick.position.set(0.42, -0.018, CD + 0.2)
    this.scene.add(this.stick)
    this.stick.add(new T.Mesh(new T.CylinderGeometry(0.04, 0.046, 0.012, 28), rubber))
    const shaft = new T.Mesh(new T.CylinderGeometry(0.0085, 0.0085, 0.1, 14), rubber)
    shaft.position.y = 0.05
    this.stick.add(shaft)
    const ball = new T.Mesh(new T.SphereGeometry(0.036, 32, 20), new T.MeshPhysicalMaterial({ color: 0xcf1531, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.04 }))
    ball.position.y = 0.112
    ball.castShadow = true
    this.stick.add(ball)
    const ring = new T.Mesh(new T.TorusGeometry(0.052, 0.009, 14, 44), new T.MeshBasicMaterial({ color: new T.Color(0xff78d0).multiplyScalar(2.1), toneMapped: false }))
    ring.rotation.x = Math.PI / 2
    ring.position.set(0.09, -0.016, CD + 0.2)
    this.scene.add(ring)
  }

  sync(sim: Sim, input: { x: number; y: number }) {
    const c = sim.claw
    this.bridge.position.z = c.z
    this.carriage.position.x = c.x
    this.swing.rotation.set(c.swX, 0, c.swZ)
    const local = c.y - PIVOT_Y
    this.head.position.y = local
    this.turret.rotation.y = c.yaw - PRONG_YAW
    this.cable.scale.y = -local
    this.cable.position.y = local / 2
    this.coil.scale.y = Math.max(0.2, -local * 0.96)
    this.pivots.forEach((p) => { p.rotation.z = c.open })
    this.stick.rotation.x = input.y * 0.34
    this.stick.rotation.z = -input.x * 0.34
    this.btn.position.y = sim.state === 'idle' || sim.state === 'down' ? -0.012 : -0.018
    this.syncArm()
  }

  // 1인칭에서는 내 몸이 시야를 가리지 않도록 숨김
  setPersonVisible(v: boolean) {
    this.person.visible = this.upperArm.visible = this.foreArm.visible = this.hand.visible = v
  }
}
