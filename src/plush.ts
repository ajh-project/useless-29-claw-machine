// 봉제 인형 모델. SPECIES 항목만 바꾸면 인형 종류를 교체할 수 있다
import * as T from 'three'

type Part = T.BufferGeometry
type Build = {
  body: number; belly: number; limb: number; earC?: number; pad?: number; patch?: number; muzzle?: number
  ear?: 'round' | 'long' | 'cat' | 'floppy'; nose?: number; bow?: number; tag?: number; bill?: number; bill2?: number
}

const paint = (g: Part, hex: number) => {
  const c = new T.Color(hex)
  const n = g.attributes.position.count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new T.BufferAttribute(a, 3))
  return g
}
type V3 = [number, number, number]
const place = (g: Part, p: V3, s: V3, rot?: V3) =>
  g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p), new T.Quaternion().setFromEuler(new T.Euler(...(rot ?? [0, 0, 0]))), new T.Vector3(...s)))
const S = (l: Part[], p: V3, s: V3, c: number, rot?: V3, seg: [number, number] = [20, 14]) =>
  l.push(paint(place(new T.SphereGeometry(1, seg[0], seg[1]), p, s, rot), c))
const B = (l: Part[], p: V3, s: V3, c: number, rot?: V3) => l.push(paint(place(new T.BoxGeometry(1, 1, 1), p, s, rot), c))
const Cn = (l: Part[], p: V3, s: V3, c: number, rot?: V3) => l.push(paint(place(new T.ConeGeometry(1, 1, 14, 3), p, s, rot), c))

function merge(list: Part[]) {
  let nv = 0, ni = 0
  list.forEach((g) => { nv += g.attributes.position.count; ni += g.index!.count })
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new Uint32Array(ni)
  let v = 0, i = 0
  list.forEach((g) => {
    P.set(g.attributes.position.array as Float32Array, v * 3)
    N.set(g.attributes.normal.array as Float32Array, v * 3)
    C.set(g.attributes.color.array as Float32Array, v * 3)
    const ix = g.index!.array
    for (let k = 0; k < ix.length; k++) I[i++] = ix[k] + v
    v += g.attributes.position.count
  })
  const G = new T.BufferGeometry()
  G.setAttribute('position', new T.BufferAttribute(P, 3))
  G.setAttribute('normal', new T.BufferAttribute(N, 3))
  G.setAttribute('color', new T.BufferAttribute(C, 3))
  G.setIndex(new T.BufferAttribute(I, 1))
  return G
}

function plush(o: Build) {
  const f: Part[] = [], h: Part[] = []
  const earC = o.earC ?? o.body
  S(f, [0, -0.2, 0], [0.36, 0.38, 0.32], o.body)
  S(f, [0, -0.24, 0.16], [0.24, 0.26, 0.18], o.belly)
  S(f, [0, 0.22, 0.04], [0.34, 0.3, 0.3], o.body, undefined, [24, 16])
  S(f, [-0.38, -0.1, 0.1], [0.12, 0.2, 0.12], o.limb, [0, 0, -0.42])
  S(f, [0.38, -0.1, 0.1], [0.12, 0.2, 0.12], o.limb, [0, 0, 0.42])
  S(f, [-0.2, -0.48, 0.24], [0.15, 0.13, 0.2], o.limb)
  S(f, [0.2, -0.48, 0.24], [0.15, 0.13, 0.2], o.limb)
  if (o.pad) {
    S(f, [-0.2, -0.48, 0.42], [0.09, 0.09, 0.025], o.pad)
    S(f, [0.2, -0.48, 0.42], [0.09, 0.09, 0.025], o.pad)
  }
  if (o.ear === 'round') {
    S(f, [-0.26, 0.47, 0.02], [0.12, 0.12, 0.08], earC)
    S(f, [0.26, 0.47, 0.02], [0.12, 0.12, 0.08], earC)
    S(f, [-0.26, 0.46, 0.08], [0.065, 0.065, 0.03], o.belly)
    S(f, [0.26, 0.46, 0.08], [0.065, 0.065, 0.03], o.belly)
  }
  if (o.ear === 'long') {
    S(f, [-0.15, 0.72, 0], [0.09, 0.3, 0.06], o.body, [0, 0, 0.16])
    S(f, [0.15, 0.72, 0], [0.09, 0.3, 0.06], o.body, [0, 0, -0.16])
    S(f, [-0.15, 0.72, 0.05], [0.05, 0.22, 0.02], o.belly, [0, 0, 0.16])
    S(f, [0.15, 0.72, 0.05], [0.05, 0.22, 0.02], o.belly, [0, 0, -0.16])
  }
  if (o.ear === 'cat') {
    Cn(f, [-0.22, 0.52, 0.03], [0.11, 0.2, 0.07], earC, [0, 0, 0.28])
    Cn(f, [0.22, 0.52, 0.03], [0.11, 0.2, 0.07], earC, [0, 0, -0.28])
  }
  if (o.ear === 'floppy') {
    S(f, [-0.33, 0.22, 0.04], [0.1, 0.25, 0.09], earC, [0, 0, -0.18])
    S(f, [0.33, 0.22, 0.04], [0.1, 0.25, 0.09], earC, [0, 0, 0.18])
  }
  if (o.patch) {
    S(f, [-0.13, 0.27, 0.27], [0.08, 0.1, 0.05], o.patch, [0, 0, -0.4])
    S(f, [0.13, 0.27, 0.27], [0.08, 0.1, 0.05], o.patch, [0, 0, 0.4])
  }
  if (o.muzzle) S(f, [0, 0.13, 0.3], [0.15, 0.1, 0.09], o.muzzle)
  if (o.bill) {
    S(h, [0, 0.15, 0.36], [0.12, 0.04, 0.1], o.bill)
    S(h, [0, 0.11, 0.34], [0.1, 0.03, 0.08], o.bill2 ?? o.bill)
  }
  S(h, [-0.12, 0.29, 0.325], [0.047, 0.05, 0.03], 0x09070a)
  S(h, [0.12, 0.29, 0.325], [0.047, 0.05, 0.03], 0x09070a)
  if (o.nose) S(h, [0, 0.17, 0.395], [0.05, 0.034, 0.03], o.nose)
  if (o.bow) {
    S(h, [-0.09, -0.02, 0.31], [0.085, 0.05, 0.025], o.bow, [0, 0, 0.2])
    S(h, [0.09, -0.02, 0.31], [0.085, 0.05, 0.025], o.bow, [0, 0, -0.2])
    S(h, [0, -0.02, 0.33], [0.03, 0.03, 0.03], o.bow)
  }
  B(h, [0.38, -0.42, 0.14], [0.11, 0.16, 0.006], 0xfffef6, [0, 0.3, 0.2])
  B(h, [0.38, -0.385, 0.145], [0.11, 0.04, 0.007], o.tag ?? 0xf04a7a, [0, 0.3, 0.2])
  return { fur: merge(f), hard: merge(h) }
}

export const SPECIES = [
  { name: '곰', ...plush({ body: 0xb17a4b, belly: 0xd9b48c, limb: 0xa06c41, earC: 0xa06c41, pad: 0xe6c9a3, ear: 'round', muzzle: 0xecd6b9, nose: 0x1a0f0b, bow: 0xbb1626, tag: 0xffc22e }) },
  { name: '토끼', ...plush({ body: 0xf3efea, belly: 0xf8cfdb, limb: 0xece6df, ear: 'long', muzzle: 0xfff8f4, nose: 0xe88aa4 }) },
  { name: '오리', ...plush({ body: 0xf7cd30, belly: 0xfbe27a, limb: 0xf2bf1e, bill: 0xf28a1c, bill2: 0xdc7410, tag: 0x38a7ff }) },
  { name: '판다', ...plush({ body: 0xf1efea, belly: 0xfaf8f4, limb: 0x17151a, earC: 0x17151a, pad: 0x3a3840, ear: 'round', patch: 0x17151a, muzzle: 0xffffff, nose: 0x101012 }) },
  { name: '강아지', ...plush({ body: 0xe9d6b6, belly: 0xf5ead5, limb: 0xe0caa6, earC: 0x8c5d38, pad: 0x8c5d38, ear: 'floppy', muzzle: 0xf8efe0, nose: 0x0d0a0b, bow: 0x2569d2, tag: 0x57c86c }) },
  { name: '고양이', ...plush({ body: 0x8d8c9b, belly: 0xeeecec, limb: 0x7e7d8c, earC: 0x7e7d8c, ear: 'cat', muzzle: 0xf7f4f2, nose: 0xe69aa6, tag: 0xb07cff }) },
]

// 층층이 쌓은 껍질로 털을 표현 (셸 렌더링)
function furMaterial(shell: number) {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.55 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uShell = { value: shell }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFurP;uniform float uShell;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFurP=position;transformed+=normal*uShell*.042;transformed.y-=uShell*uShell*.012;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
      varying vec3 vFurP;uniform float uShell;
      float fh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 fp=vFurP*92.+1.8*sin(vFurP.zxy*22.);vec3 fc=floor(fp);float fr=fh(fc);
      if(uShell>0.){float L=.62+.38*fr;if(uShell>L)discard;if(length(fract(fp)-.5)*2.>(1.-uShell/L)*1.7)discard;}
      diffuseColor.rgb*=mix(.66,1.08,pow(uShell,.7))*(.97+.06*fh(fc.yzx));`)
  }
  m.customProgramCacheKey = () => 'fur'
  return m
}

export type DollPose = { sp: number; i: number; s: number; p: T.Vector3; q: T.Quaternion; gone: boolean }

// 종류별로 인스턴싱해서 그리기 호출 수를 줄인다
export class PlushRenderer {
  private meshes: { shells: T.InstancedMesh[]; hard: T.InstancedMesh }[]
  private m = new T.Matrix4()
  private s = new T.Vector3()
  constructor(scene: T.Scene, dolls: DollPose[], shells: number) {
    const furMats = Array.from({ length: shells }, (_, i) => furMaterial(i / (shells - 1)))
    const hardMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, envMapIntensity: 1.4 })
    this.meshes = SPECIES.map((sp, k) => {
      const c = dolls.filter((d) => d.sp === k).length
      const list = furMats.map((mat, i) => {
        const im = new T.InstancedMesh(sp.fur, mat, c)
        im.frustumCulled = false
        im.receiveShadow = i < shells * 0.55
        im.castShadow = i === 0
        scene.add(im)
        return im
      })
      const hard = new T.InstancedMesh(sp.hard, hardMat, c)
      hard.frustumCulled = false
      hard.castShadow = hard.receiveShadow = true
      scene.add(hard)
      return { shells: list, hard }
    })
    const col = new T.Color()
    dolls.forEach((d, n) => {
      const v = 0.94 + ((n * 7) % 11) * 0.011
      col.setRGB(v, v, v)
      this.meshes[d.sp].shells.forEach((s) => s.setColorAt(d.i, col))
    })
    this.update(dolls)
  }
  update(dolls: DollPose[]) {
    for (const d of dolls) {
      this.s.setScalar(d.gone ? 0 : d.s)
      this.m.compose(d.p, d.q, this.s)
      const M = this.meshes[d.sp]
      M.shells.forEach((s) => s.setMatrixAt(d.i, this.m))
      M.hard.setMatrixAt(d.i, this.m)
    }
    this.meshes.forEach((M) => {
      M.shells.forEach((s) => { s.instanceMatrix.needsUpdate = true })
      M.hard.instanceMatrix.needsUpdate = true
    })
  }
}
