import { AssetRenderer } from './assets'
import { SoundManager } from './audio'
import {
  collectCanvasLayers,
  drawBackground,
  drawHud,
  drawNodeTree,
  drawParticles,
  type RenderParticle
} from './draw'
import { InputManager } from './input'
import { compileBehavior, type ScriptGlobals } from './script'
import { cloneNode, sceneVisualSettings, uid } from './project'
import type { NodeProps, Project, Scene, SceneNode } from './types'

const PHYSICS_STEP = 1 / 60
const MAX_PARTICLES = 160

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function rand(min = 0, max = 1): number {
  return min + Math.random() * (max - min)
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function aabb(node: RuntimeNode): { left: number; right: number; top: number; bottom: number } {
  const width = node.width
  const height = node.height
  return {
    left: node.x - width / 2,
    right: node.x + width / 2,
    top: node.y - height / 2,
    bottom: node.y + height / 2
  }
}

function overlaps(a: RuntimeNode, b: RuntimeNode): boolean {
  const boxA = aabb(a)
  const boxB = aabb(b)
  return boxA.left < boxB.right && boxA.right > boxB.left && boxA.top < boxB.bottom && boxA.bottom > boxB.top
}

function isAncestor(a: RuntimeNode, b: RuntimeNode): boolean {
  let current: RuntimeNode | null = b.parent
  while (current) {
    if (current === a) return true
    current = current.parent
  }
  return false
}

export interface RuntimeOptions {
  onLog?: (level: 'info' | 'warn' | 'error' | 'success', message: string) => void
  onState?: (state: RuntimeState, result: 'win' | 'lose' | null, message: string) => void
  onFps?: (fps: number) => void
}

export type RuntimeState = 'running' | 'paused' | 'gameover'

export class GameRuntime {
  readonly project: Project
  readonly scene: Scene
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly input = new InputManager()
  readonly sound = new SoundManager()
  readonly assets = new AssetRenderer()
  readonly game: GameAPI
  readonly options: RuntimeOptions
  root!: RuntimeNode
  nodes: RuntimeNode[] = []
  vars: Record<string, any> = { score: 0, lives: 3, time: 0 }
  state: RuntimeState = 'running'
  result: 'win' | 'lose' | null = null
  stateMessage = ''
  time = 0
  physicsTime = 0
  private frameCount = 0
  private fps = 60
  private fpsAccumulator = 0
  private fpsFrames = 0
  private camera = { x: 0, y: 0, zoom: 1 }
  private shakeTime = 0
  private shakeDuration = 0
  private shakeAmount = 0
  private raf = 0
  private lastTimestamp = 0
  private accumulator = 0
  private running = false
  private handlers = new Map<string, Set<(...args: any[]) => void>>()
  private overlapPairs = new Set<string>()
  private scriptErrors = new Map<string, number>()
  private disposed = false

  constructor(canvas: HTMLCanvasElement, project: Project, scene: Scene, options: RuntimeOptions = {}) {
    this.canvas = canvas
    this.project = project
    this.scene = scene
    this.options = options
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo crear el contexto 2D del lienzo.')
    this.ctx = context
    canvas.width = project.settings.width
    canvas.height = project.settings.height
    this.ctx.imageSmoothingEnabled = !project.settings.pixelArt
    this.game = new GameAPI(this)
    this.build()
    this.input.setWorldProvider(() => this.mouseWorld())
    this.input.attach(canvas)
    this.sound.unlock()
    this.start()
    this.log('success', `Partida iniciada · ${scene.name}`)
  }

  private build(): void {
    this.vars = { score: 0, lives: 3, time: 0 }
    this.time = 0
    this.physicsTime = 0
    this.state = 'running'
    this.result = null
    this.stateMessage = ''
    this.overlapPairs.clear()
    this.nodes = []
    this.root = new RuntimeNode(this.scene.root, this, null)
    for (const node of this.nodes) {
      if (!node.template) node.init()
    }
    for (const node of this.nodes) {
      if (!node.template) node.ready()
    }
    this.syncCameraInstant()
    this.emitState()
  }

  start(): void {
    if (this.running || this.disposed) return
    this.running = true
    this.lastTimestamp = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  private loop = (timestamp: number): void => {
    if (!this.running) return
    if (!this.lastTimestamp) this.lastTimestamp = timestamp
    const rawDelta = (timestamp - this.lastTimestamp) / 1000
    this.lastTimestamp = timestamp
    const delta = clamp(rawDelta, 0, 0.1)

    this.fpsAccumulator += rawDelta
    this.fpsFrames += 1
    if (this.fpsAccumulator >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccumulator)
      this.fpsAccumulator = 0
      this.fpsFrames = 0
      this.options.onFps?.(this.fps)
    }

    if (this.state === 'running') {
      this.time += delta
      this.vars.time = Math.floor(this.time * 10) / 10
      this.process(delta)
      this.accumulator += delta
      let steps = 0
      while (this.accumulator >= PHYSICS_STEP && steps < 5) {
        this.physics(PHYSICS_STEP)
        this.accumulator -= PHYSICS_STEP
        steps += 1
        if (this.state !== 'running') break
      }
      this.updateCamera(delta)
    } else if (this.state === 'gameover') {
      if (this.input.isActionJustPressed('restart') || this.input.isKeyJustPressed('Enter')) {
        this.restart()
      }
    }

    if (this.input.isActionJustPressed('pause') && this.state !== 'gameover') {
      this.state = this.state === 'paused' ? 'running' : 'paused'
      this.emitState()
    }

    this.render(timestamp / 1000)
    this.input.endFrame()
    this.frameCount += 1
    this.raf = requestAnimationFrame(this.loop)
  }

  private process(delta: number): void {
    for (const node of [...this.nodes]) {
      if (node.deleted || node.template) continue
      node.process(delta)
      node.updateTimer(delta)
      node.updateParticles(delta)
    }
    this.cleanup()
  }

  private physics(delta: number): void {
    this.physicsTime += delta
    for (const node of [...this.nodes]) {
      if (node.deleted || node.template) continue
      node.physics(delta)
    }
    this.checkAreaOverlaps()
    this.cleanup()
  }

  private checkAreaOverlaps(): void {
    const candidates = this.nodes.filter(
      (node) => !node.deleted && !node.template && node.width > 0 && node.height > 0
    )
    const current = new Set<string>()
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = candidates[i]
        const b = candidates[j]
        if (a.type !== 'Area2D' && b.type !== 'Area2D') continue
        if (isAncestor(a, b) || isAncestor(b, a)) continue
        if (!overlaps(a, b)) continue
        const key = `${a.instanceId}:${b.instanceId}`
        current.add(key)
        if (this.overlapPairs.has(key)) continue
        a.callScript('_on_area_entered', b.scriptCtx ?? b)
        b.callScript('_on_area_entered', a.scriptCtx ?? a)
        if (a.type === 'Area2D' && b.type === 'CharacterBody2D') a.callScript('_on_body_entered', b.scriptCtx ?? b)
        if (b.type === 'Area2D' && a.type === 'CharacterBody2D') b.callScript('_on_body_entered', a.scriptCtx ?? a)
        this.emit('area_entered', { a: a.name, b: b.name })
      }
    }
    for (const key of this.overlapPairs) {
      if (current.has(key)) continue
      const [aId, bId] = key.split(':')
      const a = this.nodes.find((node) => node.instanceId === aId)
      const b = this.nodes.find((node) => node.instanceId === bId)
      if (!a || !b) continue
      a.callScript('_on_area_exited', b.scriptCtx ?? b)
      b.callScript('_on_area_exited', a.scriptCtx ?? a)
      if (a.type === 'Area2D' && b.type === 'CharacterBody2D') a.callScript('_on_body_exited', b.scriptCtx ?? b)
      if (b.type === 'Area2D' && a.type === 'CharacterBody2D') b.callScript('_on_body_exited', a.scriptCtx ?? a)
    }
    this.overlapPairs = current
  }

  private syncCameraInstant(): void {
    const camera = this.nodes.find((node) => node.type === 'Camera2D' && !node.deleted && !node.template && node.props.active)
    if (!camera) {
      this.camera = { x: 0, y: 0, zoom: 1 }
      return
    }
    const target = camera.props.target ? this.findNode(camera.props.target) : null
    this.camera.x = (target?.x ?? camera.x) + Number(camera.props.offsetX ?? 0)
    this.camera.y = (target?.y ?? camera.y) + Number(camera.props.offsetY ?? 0)
    this.camera.zoom = clamp(Number(camera.props.zoom ?? 1), 0.2, 4)
  }

  private updateCamera(delta: number): void {
    const camera = this.nodes.find((node) => node.type === 'Camera2D' && !node.deleted && !node.template && node.props.active)
    if (!camera) {
      this.camera.x = lerp(this.camera.x, 0, 1 - Math.exp(-6 * delta))
      this.camera.y = lerp(this.camera.y, 0, 1 - Math.exp(-6 * delta))
      this.camera.zoom = lerp(this.camera.zoom, 1, 1 - Math.exp(-6 * delta))
      return
    }
    const target = camera.props.target ? this.findNode(camera.props.target) : null
    const desiredX = (target?.x ?? camera.x) + Number(camera.props.offsetX ?? 0)
    const desiredY = (target?.y ?? camera.y) + Number(camera.props.offsetY ?? 0)
    const zoom = clamp(Number(camera.props.zoom ?? 1), 0.2, 4)
    const smoothing = Math.max(0, Number(camera.props.smoothing ?? 0))
    if (smoothing <= 0) {
      this.camera.x = desiredX
      this.camera.y = desiredY
      this.camera.zoom = zoom
    } else {
      const factor = 1 - Math.exp(-smoothing * delta)
      this.camera.x = lerp(this.camera.x, desiredX, factor)
      this.camera.y = lerp(this.camera.y, desiredY, factor)
      this.camera.zoom = lerp(this.camera.zoom, zoom, factor)
    }
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - delta)
    }
  }

  private render(time: number): void {
    const ctx = this.ctx
    const { width, height } = this.project.settings
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    drawBackground(ctx, sceneVisualSettings(this.project, this.scene), width, height, {
      camera: this.camera,
      time,
      centered: false
    })

    let shakeX = 0
    let shakeY = 0
    if (this.shakeTime > 0 && this.shakeDuration > 0) {
      const intensity = this.shakeAmount * (this.shakeTime / this.shakeDuration)
      shakeX = Math.sin(time * 93) * intensity
      shakeY = Math.cos(time * 71) * intensity * 0.7
    }

    ctx.save()
    ctx.translate(width / 2 + shakeX, height / 2 + shakeY)
    ctx.scale(this.camera.zoom, this.camera.zoom)
    ctx.translate(-this.camera.x, -this.camera.y)
    drawNodeTree(ctx, this.root, {
      assets: this.assets,
      project: this.project,
      vars: this.vars,
      time,
      camera: this.camera
    })
    for (const node of this.nodes) {
      if (node.deleted || node.template || node.particles.length === 0) continue
      ctx.save()
      ctx.translate(node.x, node.y)
      if (node.rotation) ctx.rotate((node.rotation * Math.PI) / 180)
      drawParticles(ctx, node.particles, time)
      ctx.restore()
    }
    ctx.restore()

    const layers = collectCanvasLayers(this.root)
    drawHud(
      ctx,
      layers,
      {
        assets: this.assets,
        project: this.project,
        vars: this.vars,
        time,
        camera: this.camera
      },
      width,
      height
    )

    if (this.project.settings.showFps) {
      ctx.save()
      ctx.font = '600 12px "Segoe UI", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(226,232,240,0.7)'
      ctx.fillText(`${this.fps} FPS`, width - 14, 22)
      ctx.restore()
    }

    if (this.state === 'paused') this.drawStatusOverlay('PAUSA', 'Pulsa Esc para continuar')
    if (this.state === 'gameover') {
      const title = this.result === 'win' ? '¡VICTORIA!' : 'FIN DEL JUEGO'
      const subtitle = this.stateMessage || 'Pulsa R para volver a intentarlo'
      this.drawStatusOverlay(title, subtitle)
    }
  }

  private drawStatusOverlay(title: string, subtitle: string): void {
    const ctx = this.ctx
    const { width, height } = this.project.settings
    ctx.save()
    ctx.fillStyle = 'rgba(4,8,18,0.72)'
    ctx.fillRect(0, 0, width, height)
    const panelWidth = Math.min(520, width * 0.66)
    const panelHeight = 190
    const x = (width - panelWidth) / 2
    const y = (height - panelHeight) / 2
    ctx.shadowColor = 'rgba(56,189,248,0.35)'
    ctx.shadowBlur = 42
    ctx.fillStyle = 'rgba(10,17,32,0.94)'
    ctx.strokeStyle = 'rgba(56,189,248,0.38)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, y, panelWidth, panelHeight, 18)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.textAlign = 'center'
    ctx.fillStyle = this.result === 'win' ? '#facc15' : '#f8fafc'
    ctx.font = '800 34px "Segoe UI", sans-serif'
    ctx.fillText(title, width / 2, y + 76)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 15px "Segoe UI", sans-serif'
    ctx.fillText(subtitle, width / 2, y + 118)
    ctx.fillStyle = '#38bdf8'
    ctx.font = '600 13px "Segoe UI", sans-serif'
    ctx.fillText('R / Enter para reiniciar', width / 2, y + 154)
    ctx.restore()
  }

  spawnFromTemplate(template: RuntimeNode, x: number, y: number, overrides: NodeProps = {}): RuntimeNode {
    const data = cloneNode(template.data, true)
    data.template = false
    data.visible = true
    data.x = x
    data.y = y
    data.props = { ...data.props, ...overrides }
    const node = new RuntimeNode(data, this, this.root)
    node.init()
    node.ready()
    return node
  }

  findNode(pathOrName: string, from?: RuntimeNode): RuntimeNode | null {
    if (!pathOrName) return null
    const start = from ?? this.root
    if (start.name.toLowerCase() === pathOrName.toLowerCase() && !from) {
      // Root itself is a valid target.
      return start
    }
    const parts = pathOrName
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length > 1) {
      let current: RuntimeNode | null = start
      for (const part of parts) {
        current = current?.children.find((child) => child.name.toLowerCase() === part.toLowerCase()) ?? null
        if (!current) break
      }
      if (current) return current
    }
    const direct = start.children.find((child) => child.name.toLowerCase() === pathOrName.toLowerCase())
    if (direct) return direct
    const matches = this.nodes.filter((node) => node.name.toLowerCase() === pathOrName.toLowerCase())
    return matches.length === 1 ? matches[0] : null
  }

  findTemplate(name: string): RuntimeNode | null {
    const matches = this.nodes.filter(
      (node) => node.template && node.name.toLowerCase() === name.toLowerCase() && !node.deleted
    )
    return matches[0] ?? null
  }

  private cleanup(): void {
    const dead = this.nodes.filter((node) => node.deleted)
    for (const node of dead) {
      if (node.parent) {
        const index = node.parent.children.indexOf(node)
        if (index >= 0) node.parent.children.splice(index, 1)
      }
    }
    if (dead.length) {
      this.nodes = this.nodes.filter((node) => !node.deleted)
      for (const node of dead) {
        for (const child of node.children) child.deleted = true
      }
    }
  }

  shake(amount = 8, duration = 0.25): void {
    this.shakeAmount = amount
    this.shakeDuration = duration
    this.shakeTime = duration
  }

  emit(event: string, payload?: any): void {
    const handlers = this.handlers.get(event)
    if (!handlers) return
    for (const handler of [...handlers]) {
      try {
        handler(payload)
      } catch (error) {
        this.log('error', `Error en evento "${event}": ${errorMessage(error)}`)
      }
    }
  }

  on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  gameOver(win: boolean, message = ''): void {
    if (this.state === 'gameover') return
    this.state = 'gameover'
    this.result = win ? 'win' : 'lose'
    this.stateMessage = message
    this.sound.play(win ? 'win' : 'lose')
    this.emitState()
  }

  pause(): void {
    if (this.state === 'gameover') return
    this.state = this.state === 'paused' ? 'running' : 'paused'
    this.emitState()
  }

  restart(): void {
    this.sound.dispose()
    this.handlers.clear()
    this.overlapPairs.clear()
    this.scriptErrors.clear()
    this.accumulator = 0
    this.build()
    this.sound.unlock()
    this.log('info', 'Partida reiniciada')
  }

  togglePause(): void {
    this.pause()
  }

  emitState(): void {
    this.options.onState?.(this.state, this.result, this.stateMessage)
  }

  log(level: 'info' | 'warn' | 'error' | 'success', message: string): void {
    this.options.onLog?.(level, message)
    if (level === 'error') console.error(`[Axiom] ${message}`)
    else console.log(`[Axiom] ${message}`)
  }

  reportScriptError(node: RuntimeNode, method: string, error: unknown): void {
    const key = `${node.instanceId}:${method}`
    const now = performance.now()
    const last = this.scriptErrors.get(key) ?? 0
    if (now - last < 1800) return
    this.scriptErrors.set(key, now)
    this.log('error', `${node.name}.${method}: ${errorMessage(error)}`)
  }

  mouseWorld(): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const mouse = this.input.getMousePosition()
    const screenX = rect.width ? (mouse.x / rect.width) * this.project.settings.width : 0
    const screenY = rect.height ? (mouse.y / rect.height) * this.project.settings.height : 0
    return {
      x: (screenX - this.project.settings.width / 2) / this.camera.zoom + this.camera.x,
      y: (screenY - this.project.settings.height / 2) / this.camera.zoom + this.camera.y
    }
  }

  getCamera(): { x: number; y: number; zoom: number } {
    return { ...this.camera }
  }

  getFps(): number {
    return this.fps
  }

  dispose(): void {
    this.disposed = true
    this.running = false
    cancelAnimationFrame(this.raf)
    this.input.detach()
    this.sound.dispose()
    this.handlers.clear()
  }
}

export class RuntimeNode {
  readonly runtime: GameRuntime
  readonly data: SceneNode
  readonly instanceId = uid('rt')
  readonly name: string
  readonly type: SceneNode['type']
  parent: RuntimeNode | null
  children: RuntimeNode[] = []
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  visible: boolean
  zIndex: number
  props: NodeProps
  template: boolean
  deleted = false
  velocity = { x: 0, y: 0 }
  onFloor = false
  behavior: any = null
  scriptCtx: any = null
  particles: RenderParticle[] = []
  timerLeft = 0
  timerRunning = false

  constructor(data: SceneNode, runtime: GameRuntime, parent: RuntimeNode | null) {
    this.data = data
    this.runtime = runtime
    this.parent = parent
    this.name = data.name
    this.type = data.type
    this.x = data.x
    this.y = data.y
    this.rotation = data.rotation
    this.scaleX = data.scaleX
    this.scaleY = data.scaleY
    this.visible = data.visible
    this.zIndex = data.zIndex
    this.props = data.props
    this.template = Boolean(data.template)
    runtime.nodes.push(this)
    for (const child of data.children) {
      this.children.push(new RuntimeNode(child, runtime, this))
    }
    if (parent) parent.children.push(this)
    this.compile()
  }

  get width(): number {
    return Math.max(0, Number(this.props.width ?? 0))
  }

  get height(): number {
    return Math.max(0, Number(this.props.height ?? 0))
  }

  get gravity(): number {
    return Number(this.runtime.project.settings.gravity ?? 1600)
  }

  private globals(): ScriptGlobals {
    return {
      Input: this.runtime.input,
      Game: this.runtime.game,
      sfx: (name: string, volume = 0.6) => this.runtime.sound.play(name, volume),
      rand,
      randInt,
      clamp,
      lerp,
      dist,
      Vector2: (x = 0, y = 0) => ({ x, y }),
      print: (...args: any[]) => this.runtime.log('info', `[${this.name}] ${args.map(String).join(' ')}`),
      TAU: Math.PI * 2,
      PI: Math.PI
    }
  }

  private compile(): void {
    if (!this.data.script || this.template) return
    const compiled = compileBehavior(this.data.script, this.globals())
    if (compiled.error || !compiled.Behavior) {
      this.runtime.log('error', `Script de ${this.name}: ${compiled.error}`)
      return
    }
    try {
      this.behavior = new compiled.Behavior()
      this.scriptCtx = this.buildContext()
    } catch (error) {
      this.runtime.log('error', `No se pudo iniciar ${this.name}: ${errorMessage(error)}`)
    }
  }

  private buildContext(): any {
    const instance = this.behavior
    const context = Object.create(instance)
    const node = this
    const runtime = this.runtime

    const define = (key: string, descriptor: PropertyDescriptor) => Object.defineProperty(context, key, descriptor)
    define('x', {
      get: () => node.x,
      set: (value) => (node.x = Number(value))
    })
    define('y', {
      get: () => node.y,
      set: (value) => (node.y = Number(value))
    })
    define('position', {
      get: () => ({ x: node.x, y: node.y }),
      set: (value: { x: number; y: number }) => {
        node.x = Number(value.x)
        node.y = Number(value.y)
      }
    })
    define('rotation', {
      get: () => node.rotation,
      set: (value) => (node.rotation = Number(value))
    })
    define('scaleX', {
      get: () => node.scaleX,
      set: (value) => (node.scaleX = Number(value))
    })
    define('scaleY', {
      get: () => node.scaleY,
      set: (value) => (node.scaleY = Number(value))
    })
    define('visible', {
      get: () => node.visible,
      set: (value) => (node.visible = Boolean(value))
    })
    define('zIndex', {
      get: () => node.zIndex,
      set: (value) => (node.zIndex = Number(value))
    })
    define('velocity', {
      get: () => node.velocity,
      set: (value: { x: number; y: number }) => {
        node.velocity = { x: Number(value.x ?? 0), y: Number(value.y ?? 0) }
      }
    })
    define('on_floor', { get: () => node.onFloor })
    define('is_on_floor', { get: () => node.onFloor })
    define('gravity', { get: () => node.gravity })
    define('width', {
      get: () => node.width,
      set: (value) => (node.props.width = Number(value))
    })
    define('height', {
      get: () => node.height,
      set: (value) => (node.props.height = Number(value))
    })
    define('props', { get: () => node.props })
    define('name', { get: () => node.name })
    define('type', { get: () => node.type })
    define('template', { get: () => node.template })
    define('node', { get: () => node })
    define('game', { get: () => runtime.game })
    define('input', { get: () => runtime.input })
    define('time', { get: () => runtime.time })
    define('world_x', { get: () => node.x })
    define('world_y', { get: () => node.y })

    const methods: Record<string, (...args: any[]) => any> = {
      get_node: (path: string) => {
        const target = node.runtime.findNode(path, node)
        if (!target) return null
        return target.scriptCtx ?? target
      },
      find_node: (path: string) => {
        const target = node.runtime.findNode(path)
        return target ? (target.scriptCtx ?? target) : null
      },
      get_children: () => node.children.map((child) => child.scriptCtx ?? child),
      spawn: (templateName: string, x?: number, y?: number, overrides: NodeProps = {}) => {
        const template = runtime.findTemplate(templateName)
        if (!template) {
          runtime.log('error', `${node.name}: no existe la plantilla "${templateName}"`)
          return null
        }
        const spawned = runtime.spawnFromTemplate(template, x ?? node.x, y ?? node.y, overrides)
        return spawned.scriptCtx ?? spawned
      },
      queue_free: () => node.queueFree(),
      destroy: () => node.queueFree(),
      play_sound: (soundName: string, volume = 0.6) => runtime.sound.play(soundName, volume),
      shake: (amount = 8, duration = 0.25) => runtime.shake(amount, duration),
      overlaps: (target = '', limit = 64) => node.overlapsWith(target, limit),
      set_prop: (key: string, value: any) => {
        node.props[key] = value
      },
      get_prop: (key: string) => node.props[key],
      move_and_slide: (dt = PHYSICS_STEP) => node.moveAndSlide(dt),
      start_timer: (wait?: number) => node.startTimer(wait),
      stop_timer: () => node.stopTimer(),
      add_score: (amount: number) => runtime.game.add_score(amount),
      game_over: (win = false, message = '') => runtime.gameOver(win, message)
    }
    for (const [key, fn] of Object.entries(methods)) {
      define(key, { value: fn, configurable: true })
    }
    return context
  }

  init(): void {
    if (this.type === 'AudioPlayer' && this.props.autoplay) {
      this.runtime.sound.play(this.props.sound ?? 'coin', Number(this.props.volume ?? 0.5))
    }
    if (this.type === 'Timer') {
      this.timerRunning = Boolean(this.props.autostart)
      this.timerLeft = Number(this.props.waitTime ?? 1)
    }
  }

  ready(): void {
    this.callScript('_ready')
  }

  process(delta: number): void {
    this.callScript('_process', delta)
  }

  physics(delta: number): void {
    this.callScript('_physics_process', delta)
  }

  updateTimer(delta: number): void {
    if (this.type !== 'Timer' || !this.timerRunning) return
    this.timerLeft -= delta
    if (this.timerLeft > 0) return
    this.callScript('_on_timeout')
    this.runtime.emit('timer_timeout', { name: this.name })
    if (this.props.oneShot) {
      this.timerRunning = false
    } else {
      this.timerLeft += Number(this.props.waitTime ?? 1)
    }
  }

  updateParticles(delta: number): void {
    if (this.type !== 'Particles2D') return
    if (this.props.emitting !== false && this.visible) {
      const rate = Number(this.props.amount ?? 18) * 1.4
      const spawnCount = Math.min(6, Math.floor(rate * delta + Math.random()))
      for (let index = 0; index < spawnCount; index += 1) {
        if (this.particles.length >= MAX_PARTICLES) break
        const spread = ((Number(this.props.spread ?? 360) * Math.PI) / 180) / 2
        const baseAngle = -Math.PI / 2
        const angle = baseAngle + rand(-spread, spread)
        const speed = Number(this.props.speed ?? 90) * rand(0.35, 1)
        const lifetime = Math.max(0.15, Number(this.props.lifetime ?? 0.9) * rand(0.7, 1.2))
        this.particles.push({
          x: rand(-4, 4),
          y: rand(-4, 4),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: lifetime,
          maxLife: lifetime,
          size: Math.max(1, Number(this.props.size ?? 4) * rand(0.6, 1.3)),
          color: this.props.color ?? '#38bdf8'
        })
      }
    }
    for (const particle of this.particles) {
      particle.life -= delta
      particle.x += particle.vx * delta
      particle.y += particle.vy * delta
      particle.vy += Number(this.props.gravity ?? 0) * delta
    }
    this.particles = this.particles.filter((particle) => particle.life > 0)
  }

  callScript(method: string, ...args: any[]): void {
    if (!this.scriptCtx) return
    const fn = this.scriptCtx[method]
    if (typeof fn !== 'function') return
    try {
      fn.apply(this.scriptCtx, args)
    } catch (error) {
      this.runtime.reportScriptError(this, method, error)
    }
  }

  moveAndSlide(dt = PHYSICS_STEP): void {
    if (this.type !== 'CharacterBody2D') return
    const solids = this.runtime.nodes.filter(
      (node) => node.type === 'StaticBody2D' && !node.deleted && !node.template
    )
    const totalX = this.velocity.x * dt
    const totalY = this.velocity.y * dt
    const steps = clamp(Math.ceil(Math.max(Math.abs(totalX), Math.abs(totalY)) / 7), 1, 20)
    const stepX = totalX / steps
    const stepY = totalY / steps
    this.onFloor = false
    for (let step = 0; step < steps; step += 1) {
      const previousBottom = this.y + this.height / 2
      if (stepX !== 0) {
        this.x += stepX
        const box = aabb(this)
        for (const solid of solids) {
          if (solid.props.oneWay || solid.width <= 0 || solid.height <= 0) continue
          const solidBox = aabb(solid)
          if (!(box.left < solidBox.right && box.right > solidBox.left && box.top < solidBox.bottom && box.bottom > solidBox.top)) continue
          if (stepX > 0) this.x = solidBox.left - this.width / 2
          else this.x = solidBox.right + this.width / 2
          this.velocity.x = 0
          break
        }
      }
      if (stepY !== 0) {
        this.y += stepY
        const box = aabb(this)
        for (const solid of solids) {
          if (solid.width <= 0 || solid.height <= 0) continue
          const solidBox = aabb(solid)
          const intersects = box.left < solidBox.right && box.right > solidBox.left && box.top < solidBox.bottom && box.bottom > solidBox.top
          if (!intersects) continue
          if (solid.props.oneWay) {
            if (stepY <= 0 || previousBottom > solidBox.top + 2) continue
          }
          if (stepY > 0) {
            this.y = solidBox.top - this.height / 2
            this.velocity.y = 0
            this.onFloor = true
          } else {
            this.y = solidBox.bottom + this.height / 2
            this.velocity.y = 0
          }
          break
        }
      }
    }
  }

  overlapsWith(target = '', limit = 64): RuntimeNode[] {
    const results: RuntimeNode[] = []
    const wanted = target.toLowerCase()
    for (const other of this.runtime.nodes) {
      if (other === this || other.deleted || other.template) continue
      if (other.width <= 0 || other.height <= 0) continue
      if (isAncestor(this, other) || isAncestor(other, this)) continue
      if (!overlaps(this, other)) continue
      if (
        wanted &&
        other.name.toLowerCase() !== wanted &&
        String(other.props.group ?? '').toLowerCase() !== wanted &&
        String(other.props.tag ?? '').toLowerCase() !== wanted &&
        other.type.toLowerCase() !== wanted
      ) {
        continue
      }
      results.push(other)
      if (results.length >= limit) break
    }
    return results
  }

  startTimer(wait?: number): void {
    if (this.type !== 'Timer') return
    if (wait !== undefined) this.props.waitTime = wait
    this.timerLeft = Number(this.props.waitTime ?? 1)
    this.timerRunning = true
  }

  stopTimer(): void {
    this.timerRunning = false
  }

  queueFree(): void {
    this.deleted = true
    for (const child of this.children) child.deleted = true
    this.runtime.emit('node_freed', { name: this.name })
  }

  // Compatibility helpers for nodes returned by overlaps() / get_node().
  queue_free(): void {
    this.queueFree()
  }

  destroy(): void {
    this.queueFree()
  }

  play_sound(name: string, volume = 0.6): void {
    this.runtime.sound.play(name, volume)
  }

  set_prop(key: string, value: any): void {
    this.props[key] = value
  }

  get_prop(key: string): any {
    return this.props[key]
  }

  get_node(path: string): any {
    const target = this.runtime.findNode(path, this)
    return target ? (target.scriptCtx ?? target) : null
  }
}

class GameAPI {
  private runtime: GameRuntime
  constructor(runtime: GameRuntime) {
    this.runtime = runtime
  }

  get time(): number {
    return this.runtime.time
  }

  get width(): number {
    return this.runtime.project.settings.width
  }

  get height(): number {
    return this.runtime.project.settings.height
  }

  get state(): string {
    return this.runtime.state
  }

  get score(): number {
    return Number(this.runtime.vars.score ?? 0)
  }

  set score(value: number) {
    this.runtime.vars.score = value
  }

  get lives(): number {
    return Number(this.runtime.vars.lives ?? 0)
  }

  set lives(value: number) {
    this.runtime.vars.lives = value
  }

  get vars(): Record<string, any> {
    return this.runtime.vars
  }

  get mouse_position(): { x: number; y: number } {
    return this.runtime.input.getMousePosition()
  }

  get mouse_world(): { x: number; y: number } {
    return this.runtime.mouseWorld()
  }

  get mouse_x(): number {
    return this.mouse_world.x
  }

  get mouse_y(): number {
    return this.mouse_world.y
  }

  get_pixel_mouse(): { x: number; y: number } {
    return this.mouse_position
  }

  add_score(amount = 1): number {
    this.runtime.vars.score = this.score + amount
    this.runtime.emit('score_changed', { score: this.score, delta: amount })
    return this.score
  }

  set_var(name: string, value: any): void {
    this.runtime.vars[name] = value
  }

  get_var(name: string, fallback: any = undefined): any {
    return this.runtime.vars[name] ?? fallback
  }

  emit(event: string, payload?: any): void {
    this.runtime.emit(event, payload)
  }

  on(event: string, handler: (...args: any[]) => void): () => void {
    return this.runtime.on(event, handler)
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.runtime.on(event, handler)()
  }

  spawn(templateName: string, x: number, y: number, overrides: NodeProps = {}): any {
    const template = this.runtime.findTemplate(templateName)
    if (!template) return null
    const spawned = this.runtime.spawnFromTemplate(template, x, y, overrides)
    return spawned.scriptCtx ?? spawned
  }

  shake(amount = 8, duration = 0.25): void {
    this.runtime.shake(amount, duration)
  }

  pause(): void {
    this.runtime.pause()
  }

  restart(): void {
    this.runtime.restart()
  }

  game_over(win = false, message = ''): void {
    this.runtime.gameOver(win, message)
  }

  win(message = '¡Has completado el nivel!'): void {
    this.runtime.gameOver(true, message)
  }

  lose(message = 'Pulsa R para volver a intentarlo'): void {
    this.runtime.gameOver(false, message)
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
