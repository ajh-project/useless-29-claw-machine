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
const sim = new Sim({ count: low ? 36 : 40, seed: (Math.random() * 1e9) | 0, species: SPECIES.length })
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

let sideView = false, viewAz = 0.06
$('view').addEventListener('click', () => {
  sideView = !sideView
  $('view').textContent = sideView ? '앞에서 보기' : '옆에서 보기'
})

function resize() {
  const p = canvas.parentElement!
  renderer.setSize(p.clientWidth, p.clientHeight, false)
  camera.aspect = p.clientWidth / p.clientHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

function placeCamera() {
  const t = Math.tan((camera.fov * Math.PI) / 360)
  const dist = Math.max(1.56 / (2 * t), 1.0 / (2 * t * camera.aspect)) + 0.42
  camera.position.set(Math.sin(viewAz) * dist, 0.68, Math.cos(viewAz) * dist)
  camera.lookAt(0, 0.58, 0)
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
  viewAz += ((sideView ? 1.32 : 0.06) - viewAz) * Math.min(1, dt * 3)
  placeCamera()
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
$('loading').hidden = true
frame()
