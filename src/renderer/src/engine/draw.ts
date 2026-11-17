import type { AssetRenderer } from './assets'
import { roundedRect, shade, withAlpha } from './assets'
import type { NodeProps, NodeType, Project, ProjectSettings } from './types'

export interface VisualNode {
  type: NodeType
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  visible: boolean
  zIndex: number
  template?: boolean
  props: NodeProps
  children: VisualNode[]
}

export interface DrawOptions {
  assets: AssetRenderer
  project: Project
  vars?: Record<string, any>
  time?: number
  editor?: boolean
  camera?: { x: number; y: number }
  showTemplates?: boolean
  centered?: boolean
}

const starCache = new Map<string, Array<{ x: number; y: number; size: number; phase: number; speed: number }>>()

function starsFor(key: string): Array<{ x: number; y: number; size: number; phase: number; speed: number }> {
  const cached = starCache.get(key)
  if (cached) return cached
  let seed = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    seed ^= key.charCodeAt(index)
    seed = Math.imul(seed, 16777619)
  }
  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507)
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909)
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296
  }
  const stars = Array.from({ length: 130 }, () => ({
    x: random(),
    y: random(),
    size: 0.5 + random() * 2.1,
    phase: random() * Math.PI * 2,
    speed: 0.4 + random() * 1.8
  }))
  starCache.set(key, stars)
  return stars
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  settings: ProjectSettings,
  width: number,
  height: number,
  options: { camera?: { x: number; y: number }; time?: number; editor?: boolean; centered?: boolean } = {}
): void {
  const style = settings.backgroundStyle ?? 'gradient'
  const base = settings.background || '#0d1526'
  const accent = settings.accent || '#38bdf8'
  const camera = options.camera ?? { x: 0, y: 0 }
  const time = options.time ?? 0
  // World-space backgrounds are centered on the origin. Runtime backgrounds are
  // drawn in screen space before the camera transform, so they start at (0, 0).
  const left = options.centered === false ? 0 : -width / 2
  const top = options.centered === false ? 0 : -height / 2

  ctx.save()
  if (style === 'solid') {
    ctx.fillStyle = base
    ctx.fillRect(left, top, width, height)
  } else {
    const gradient = ctx.createLinearGradient(left, top, left + width * 0.35, top + height)
    gradient.addColorStop(0, shade(base, 14))
    gradient.addColorStop(0.55, base)
    gradient.addColorStop(1, shade(base, -18))
    ctx.fillStyle = gradient
    ctx.fillRect(left, top, width, height)
  }

  if (style === 'stars') {
    const nebulaA = ctx.createRadialGradient(left + width * 0.2, top + height * 0.3, 10, left + width * 0.2, top + height * 0.3, width * 0.55)
    nebulaA.addColorStop(0, withAlpha(accent, options.editor ? 0.1 : 0.15))
    nebulaA.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = nebulaA
    ctx.fillRect(left, top, width, height)

    const nebulaB = ctx.createRadialGradient(left + width * 0.82, top + height * 0.7, 5, left + width * 0.82, top + height * 0.7, width * 0.5)
    nebulaB.addColorStop(0, 'rgba(124,58,237,0.12)')
    nebulaB.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = nebulaB
    ctx.fillRect(left, top, width, height)

    const stars = starsFor(`${width}x${height}`)
    for (const star of stars) {
      const x = left + ((((star.x * width - camera.x * 0.08) % width) + width) % width)
      const y = top + ((((star.y * height - camera.y * 0.05) % height) + height) % height)
      const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase))
      ctx.globalAlpha = twinkle * (options.editor ? 0.55 : 0.85)
      ctx.fillStyle = star.size > 1.8 ? '#e0f2fe' : '#c7d2fe'
      ctx.beginPath()
      ctx.arc(x, y, star.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  if (style === 'grid') {
    const spacing = 56
    const offsetX = left + (((-camera.x * 0.25) % spacing + spacing) % spacing)
    const offsetY = top + (((-camera.y * 0.25) % spacing + spacing) % spacing)
    ctx.strokeStyle = withAlpha(accent, options.editor ? 0.08 : 0.13)
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = offsetX; x < left + width; x += spacing) {
      ctx.moveTo(x, top)
      ctx.lineTo(x, top + height)
    }
    for (let y = offsetY; y < top + height; y += spacing) {
      ctx.moveTo(left, y)
      ctx.lineTo(left + width, y)
    }
    ctx.stroke()
  }

  if (style === 'gradient') {
    const glow = ctx.createRadialGradient(0, -height * 0.15, 10, 0, -height * 0.15, width * 0.65)
    glow.addColorStop(0, withAlpha(accent, 0.16))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(left, top, width, height)
  }

  const vignette = ctx.createRadialGradient(0, 0, Math.min(width, height) * 0.25, 0, 0, Math.max(width, height) * 0.72)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(2,6,23,0.5)')
  ctx.fillStyle = vignette
  ctx.fillRect(left, top, width, height)
  ctx.restore()
}

export function drawShadow(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save()
  ctx.fillStyle = 'rgba(2,6,23,0.34)'
  ctx.beginPath()
  ctx.ellipse(2, height * 0.48, width * 0.42, Math.max(3, height * 0.11), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawCharacterBody(
  ctx: CanvasRenderingContext2D,
  props: Record<string, any>,
  width: number,
  height: number
): void {
  const color = props.color ?? '#4ade80'
  const w = width
  const h = height
  drawShadow(ctx, w, h)
  const gradient = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  gradient.addColorStop(0, shade(color, 34))
  gradient.addColorStop(0.55, color)
  gradient.addColorStop(1, shade(color, -38))
  ctx.save()
  ctx.fillStyle = gradient
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = Math.max(1.2, w * 0.035)
  roundedRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.4)
  ctx.fill()
  ctx.stroke()

  const eyeY = -h * 0.13
  const eyeGap = w * 0.18
  const eyeR = Math.max(1.5, w * 0.085)
  for (const direction of [-1, 1]) {
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath()
    ctx.ellipse(direction * eyeGap, eyeY, eyeR, eyeR * 1.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(direction * eyeGap + w * 0.02, eyeY + eyeR * 0.2, eyeR * 0.52, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(15,23,42,0.45)'
  ctx.lineWidth = Math.max(1, w * 0.03)
  ctx.beginPath()
  ctx.arc(0, h * 0.1, w * 0.16, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
  ctx.restore()
}

export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  props: Record<string, any>,
  width: number,
  height: number
): void {
  const color = props.color ?? '#273244'
  const edge = props.edgeColor ?? '#38bdf8'
  const w = width
  const h = height
  ctx.save()
  const gradient = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  gradient.addColorStop(0, shade(color, 18))
  gradient.addColorStop(1, shade(color, -22))
  ctx.fillStyle = gradient
  roundedRect(ctx, -w / 2, -h / 2, w, h, Math.min(8, h * 0.28))
  ctx.fill()

  if (props.style === 'spikes') {
    const count = Math.max(3, Math.floor(w / 22))
    const spikeWidth = w / count
    ctx.fillStyle = edge
    for (let index = 0; index < count; index += 1) {
      const start = -w / 2 + index * spikeWidth
      ctx.beginPath()
      ctx.moveTo(start, -h / 2)
      ctx.lineTo(start + spikeWidth / 2, -h / 2 - Math.min(24, h * 1.1))
      ctx.lineTo(start + spikeWidth, -h / 2)
      ctx.closePath()
      ctx.fill()
    }
  } else {
    ctx.strokeStyle = withAlpha(edge, 0.85)
    ctx.lineWidth = Math.max(1.5, h * 0.06)
    ctx.beginPath()
    ctx.moveTo(-w / 2 + 4, -h / 2 + 1)
    ctx.lineTo(w / 2 - 4, -h / 2 + 1)
    ctx.stroke()
    ctx.strokeStyle = withAlpha(edge, 0.22)
    ctx.lineWidth = 8
    ctx.stroke()
  }
  ctx.restore()
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  props: Record<string, any>,
  width: number,
  height: number,
  vars: Record<string, any> = {}
): void {
  let text = String(props.text ?? '')
  if (props.bind) {
    const value = vars[props.bind]
    text = value === undefined ? text : `${props.prefix ?? ''}${value}${props.suffix ?? ''}`
  }
  const fontSize = Number(props.fontSize ?? 24)
  const align = props.align === 'center' ? 'center' : props.align === 'right' ? 'right' : 'left'
  const x = align === 'center' ? 0 : align === 'right' ? width / 2 : -width / 2
  ctx.save()
  ctx.font = `${props.fontWeight ?? 700} ${fontSize}px "Segoe UI", "Inter", sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (props.shadow !== false) {
    ctx.shadowColor = 'rgba(2,6,23,0.7)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
  }
  ctx.fillStyle = props.color ?? '#f8fafc'
  ctx.fillText(text, x, 0)
  ctx.restore()
}

export interface RenderParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: RenderParticle[], time = 0): void {
  ctx.save()
  for (const particle of particles) {
    const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife))
    ctx.globalAlpha = alpha
    ctx.fillStyle = particle.color
    ctx.shadowColor = particle.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(particle.x, particle.y + Math.sin(time * 4 + particle.x) * 1.5, particle.size * alpha, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawEditorParticles(
  ctx: CanvasRenderingContext2D,
  props: Record<string, any>,
  time = 0
): void {
  const amount = Math.min(60, Number(props.amount ?? 18))
  const spread = ((Number(props.spread ?? 360) * Math.PI) / 180) / 2
  const speed = Number(props.speed ?? 90)
  const size = Number(props.size ?? 4)
  ctx.save()
  for (let index = 0; index < amount; index += 1) {
    const seed = index * 12.9898
    const angle = Math.sin(seed) * spread - Math.PI / 2
    const phase = ((time * speed * 0.01 + index / amount) % 1 + 1) % 1
    const distance = phase * Math.max(30, speed * 0.55)
    ctx.globalAlpha = (1 - phase) * 0.8
    ctx.fillStyle = props.color ?? '#38bdf8'
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, Math.max(1, size * (1 - phase * 0.5)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawNodeTree(
  ctx: CanvasRenderingContext2D,
  node: VisualNode,
  options: DrawOptions
): void {
  if (!node.visible || node.type === 'CanvasLayer') return
  if (node.template && !options.showTemplates) return
  const { assets, vars = {}, time = 0 } = options
  const props = node.props ?? {}
  ctx.save()
  if (node.template) ctx.globalAlpha *= 0.28
  ctx.translate(node.x, node.y)
  if (node.rotation) ctx.rotate((node.rotation * Math.PI) / 180)
  if (node.scaleX !== 1 || node.scaleY !== 1) ctx.scale(node.scaleX, node.scaleY)

  const width = Number(props.width ?? 48)
  const height = Number(props.height ?? 48)

  switch (node.type) {
    case 'Sprite2D': {
      const asset = options.assets ? options.project.assets.find((item) => item.id === props.assetId) : undefined
      if (props.shadow) drawShadow(ctx, width, height)
      if (asset) {
        options.assets.draw(ctx, asset, width, height, {
          opacity: props.opacity ?? 1,
          flipX: Boolean(props.flipX),
          flipY: Boolean(props.flipY),
          glow: Number(props.glow ?? 0),
          glowColor: props.glowColor ?? props.tint ?? '#38bdf8'
        })
      } else {
        ctx.fillStyle = 'rgba(148,163,184,0.18)'
        ctx.strokeStyle = 'rgba(148,163,184,0.6)'
        ctx.setLineDash([5, 4])
        roundedRect(ctx, -width / 2, -height / 2, width, height, 6)
        ctx.fill()
        ctx.stroke()
        ctx.setLineDash([])
      }
      break
    }
    case 'CharacterBody2D':
      if (props.bodyVisual !== 'none') drawCharacterBody(ctx, props, width, height)
      break
    case 'StaticBody2D':
      drawPlatform(ctx, props, width, height)
      break
    case 'Area2D':
      if (props.debug || options.editor) {
        ctx.fillStyle = withAlpha(props.color ?? '#a78bfa', options.editor ? 0.08 : 0.13)
        ctx.strokeStyle = withAlpha(props.color ?? '#a78bfa', 0.65)
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 4])
        roundedRect(ctx, -width / 2, -height / 2, width, height, 4)
        ctx.fill()
        ctx.stroke()
        ctx.setLineDash([])
      }
      break
    case 'Label2D':
      drawLabel(ctx, props, width, height, vars)
      break
    case 'Particles2D':
      if (options.editor) drawEditorParticles(ctx, props, time)
      break
    default:
      break
  }

  const sorted = [...node.children].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  for (const child of sorted) drawNodeTree(ctx, child, options)
  ctx.restore()
}

export function collectCanvasLayers<T extends VisualNode>(root: T): T[] {
  const layers: T[] = []
  const visit = (node: T) => {
    if (node.type === 'CanvasLayer') layers.push(node)
    ;(node.children as T[]).forEach(visit)
  }
  visit(root)
  return layers
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  layers: VisualNode[],
  options: DrawOptions,
  width: number,
  height: number
): void {
  for (const layer of layers) {
    if (!layer.visible) continue
    ctx.save()
    ctx.translate(layer.x, layer.y)
    for (const child of [...layer.children].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
      drawNodeTree(ctx, child, { ...options, vars: options.vars ?? {} })
    }
    ctx.restore()
  }
}
