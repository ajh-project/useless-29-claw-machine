import * as T from 'three'
import { STRENGTHS } from './constants'
import { Machine } from './machine'
import { PlushRenderer, SPECIES } from './plush'
import { Autopilot, initPhysics, Sim, type Input } from './sim'
import './style.css'

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E
const params = new URLSearchParams(location.search)
const low = innerWidth < 600 || /Android|iPhone|iPad/.test(navigator.userAgent)

await initPhysics()

const canvas = $<HTMLCanvasElement>('c')
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.75 : 2))
renderer.toneMapping = T.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = T.PCFSoftShadowMap
const scene = new T.Scene()
const camera = new T.PerspectiveCamera(40, 1, 0.05, 40)

const machine = new Machine(scene, renderer, low)
const sim = new Sim({ seed: (Math.random() * 1e9) | 0, species: SPECIES.length })
const plush = new PlushRenderer(scene, sim.dolls, low ? 10 : 18)

/* ---------- 조작 ---------- */
const input: Input = { x: 0, y: 0, rot: 0 }
const lever = $('lever'), knob = $('knob'), drop = $<HTMLButtonElement>('drop')
const rl = $<HTMLButtonElement>('rl'), rr = $<HTMLButtonElement>('rr')

function setLever(x: number, y: number) {
  input.x = Math.max(-1, Math.min(1, x))
  input.y = Math.max(-1, Math.min(1, y))
  const k = (lever.clientWidth / 2) * 0.42
  knob.style.transform = `translate(${input.x * k}px,${input.y * k}px)`
}
let dragging = false
function leverMove(e: PointerEvent) {
  const r = lever.getBoundingClientRect(), h = r.width / 2
  setLever((e.clientX - r.left - h) / (h * 0.62), (e.clientY - r.top - h) / (h * 0.62))
}
lever.addEventListener('pointerdown', (e) => {
  dragging = true
  lever.setPointerCapture(e.pointerId)
  leverMove(e)
})
lever.addEventListener('pointermove', (e) => { if (dragging) leverMove(e) })
const leverEnd = () => { dragging = false; setLever(0, 0) }
lever.addEventListener('pointerup', leverEnd)
lever.addEventListener('pointercancel', leverEnd)

function holdRotate(b: HTMLElement, dir: number) {
  const off = () => { if (input.rot === dir) input.rot = 0 }
  b.addEventListener('pointerdown', () => { input.rot = dir })
  for (const n of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(n, off)
}
holdRotate(rl, 1)
holdRotate(rr, -1)

const keys: Record<string, boolean> = {}
function applyKeys() {
  if (dragging) return
  setLever((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0))
  input.rot = keys.q ? 1 : keys.e ? -1 : 0
}
addEventListener('keydown', (e) => {
  if (e.repeat) return
  keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true
  if (e.key === ' ') {
    e.preventDefault()
    if (document.activeElement?.tagName !== 'BUTTON') sim.press()
  }
  if (e.key.startsWith('Arrow') || 'qeQE'.includes(e.key)) applyKeys()
})
addEventListener('keyup', (e) => {
  keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false
  applyKeys()
})
drop.addEventListener('click', () => {
  if (sim.state === 'idle' && !hintShown) {
    hintShown = true
    toast('집게가 멋대로 돌아요. 방향을 보고 집기를 누르세요')
  }
  sim.press()
})

let hintShown = false
let toastT = 0
function toast(t: string) {
  const e = $('toast')
  e.textContent = t
  e.hidden = false
  toastT = 2.6
}
sim.onPrize = (d) => toast(`${SPECIES[d.sp].name} 인형을 뽑았어요!`)

const strengthBtn = $('strength')
function showStrength() { strengthBtn.textContent = `집게 힘: ${STRENGTHS[sim.strength].name}` }
strengthBtn.addEventListener('click', () => {
  sim.strength = (sim.strength + 1) % STRENGTHS.length
  showStrength()
})
showStrength()

// 시점: 3인칭(내 뒷모습) → 1인칭(눈높이) → 옆에서 깊이 확인
const VIEWS = ['3인칭', '1인칭', '옆에서']
let view = Number(params.get('view') ?? 0) % VIEWS.length
const viewBtn = $('view')
machine.setPersonVisible(view !== 1)
function showView() { viewBtn.textContent = `시점: ${VIEWS[view]}` }
viewBtn.addEventListener('click', () => {
  view = (view + 1) % VIEWS.length
  showView()
  machine.setPersonVisible(view !== 1)
})
showView()

// 화면을 끌면 고개를 옆으로 기울이듯 시야가 움직인다
let peek = 0, peekDrag: number | null = null
canvas.addEventListener('pointerdown', (e) => { peekDrag = e.clientX; canvas.setPointerCapture(e.pointerId) })
canvas.addEventListener('pointermove', (e) => {
  if (peekDrag === null) return
  peek = Math.max(-0.65, Math.min(0.65, peek + (peekDrag - e.clientX) * 0.004))
  peekDrag = e.clientX
})
const peekEnd = () => { peekDrag = null }
canvas.addEventListener('pointerup', peekEnd)
canvas.addEventListener('pointercancel', peekEnd)

// 안드로이드는 버튼 한 번으로 전체 화면 + 가로 고정. 아이폰은 폰을 직접 돌리면 가로 배치로 바뀐다
const landBtn = $('landscape')
landBtn.addEventListener('click', async () => {
  try {
    await document.documentElement.requestFullscreen()
    await (screen.orientation as unknown as { lock(o: string): Promise<void> }).lock('landscape')
  } catch { /* 지원하지 않는 기기는 폰을 직접 돌리면 된다 */ }
})

function resize() {
  const p = canvas.parentElement!
  renderer.setSize(p.clientWidth, p.clientHeight, false)
  camera.aspect = p.clientWidth / p.clientHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

const camPos = new T.Vector3(0.2, 0.9, 3), camLook = new T.Vector3(0.1, 0.6, 0)
const wantPos = new T.Vector3(), wantLook = new T.Vector3()
function placeCamera(dt: number) {
  const fov = view === 1 ? 52 : 36
  const t = Math.tan((fov * Math.PI) / 360)
  const dist = Math.max(1.48 / (2 * t), 1.25 / (2 * t * camera.aspect))
  if (view === 0) {
    // 내 뒤쪽 어깨너머. 가로 화면이면 기계 오른쪽 앞에 선 내 모습까지 보인다
    wantPos.set(camera.aspect > 1.4 ? -0.18 : 0, 1.12, dist + 0.42)
    wantLook.set(camera.aspect > 1.4 ? 0.1 : 0, 0.66, 0)
  } else if (view === 1) {
    // 기계 바로 앞 사람 눈높이 (바닥에서 약 1.6m)
    wantPos.set(0, 0.84, 1.32 + (camera.aspect < 1 ? 0.5 : 0))
    wantLook.set(0, 0.46, -0.05)
  } else {
    wantPos.set(dist + 0.2, 0.78, 0.3)
    wantLook.set(0, 0.6, 0)
  }
  // 고개 기울이기: 기계 중심을 기준으로 시야를 돌림
  wantPos.applyAxisAngle(T.Object3D.DEFAULT_UP, peek)
  const k = Math.min(1, dt * 4)
  camPos.lerp(wantPos, k)
  camLook.lerp(wantLook, k)
  camera.fov += (fov - camera.fov) * k
  camera.updateProjectionMatrix()
  camera.position.copy(camPos)
  camera.lookAt(camLook)
}

/* ---------- 매 프레임 ---------- */
const auto = params.has('auto') ? new Autopilot() : null
const clock = new T.Clock()
let lastRead = ''
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05)
  auto?.update(sim, input)
  sim.update(dt, input)
  plush.update(sim.dolls)
  machine.sync(sim, input)

  drop.textContent = sim.state === 'down' ? '집기' : '내리기'
  drop.disabled = sim.state !== 'idle' && sim.state !== 'down'
  rl.disabled = rr.disabled = !sim.canMove
  const read = `시도 ${sim.tries} · 획득 ${sim.wins}`
  if (read !== lastRead) $('readout').textContent = lastRead = read
  if (toastT > 0) {
    toastT -= dt
    if (toastT <= 0) $('toast').hidden = true
  }
  placeCamera(dt)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
$('loading').hidden = true
frame()
