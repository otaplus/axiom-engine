import type { Asset } from './types'

export class AssetRenderer {
  private images = new Map<string, HTMLImageElement>()
  private failed = new Set<string>()

  ensureImage(asset: Asset): HTMLImageElement | null {
    if (asset.kind !== 'image') return null
    const existing = this.images.get(asset.id)
    if (existing) return existing.complete ? existing : null
    if (this.failed.has(asset.id)) return null
    const image = new Image()
    image.onload = () => {
      this.images.set(asset.id, image)
    }
    image.onerror = () => this.failed.add(asset.id)
    image.src = asset.dataUrl
    this.images.set(asset.id, image)
    return image.complete ? image : null
  }

  draw(
    ctx: CanvasRenderingContext2D,
    asset: Asset | undefined,
    width: number,
    height: number,
    options: {
      opacity?: number
      flipX?: boolean
      flipY?: boolean
      tint?: string
      glow?: number
      glowColor?: string
    } = {}
  ): void {
    if (!asset) return
    const opacity = options.opacity ?? 1
    if (opacity <= 0) return
    ctx.save()
    ctx.globalAlpha *= Math.min(1, opacity)
    if (options.flipX) ctx.scale(-1, 1)
    if (options.flipY) ctx.scale(1, -1)
    if (options.glow && options.glow > 0) {
      ctx.shadowBlur = options.glow
      ctx.shadowColor = options.glowColor ?? '#38bdf8'
    }

    if (asset.kind === 'image') {
      const image = this.ensureImage(asset)
      if (image) {
        ctx.drawImage(image, -width / 2, -height / 2, width, height)
      }
    } else if (asset.kind === 'emoji') {
      if (asset.background) {
        const radius = Math.min(width, height) * 0.43
        const gradient = ctx.createRadialGradient(0, -radius * 0.2, 2, 0, 0, radius)
        gradient.addColorStop(0, asset.background)
        gradient.addColorStop(1, 'rgba(15,23,42,0.15)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      const size = Math.min(width, height) * 0.9
      ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(asset.glyph, 0, size * 0.04)
    } else if (asset.kind === 'shape') {
      drawShapeAsset(ctx, asset, width, height)
    } else if (asset.kind === 'vector') {
      drawVectorAsset(ctx, asset, width, height)
    }
    ctx.restore()
  }
}

function drawShapeAsset(
  ctx: CanvasRenderingContext2D,
  asset: Extract<Asset, { kind: 'shape' }>,
  width: number,
  height: number
): void {
  const w = width
  const h = height
  const gradient = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
  gradient.addColorStop(0, asset.color)
  gradient.addColorStop(1, asset.color2 ?? shade(asset.color, -35))
  ctx.fillStyle = gradient
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.035)
  const radius = Math.min(w, h) * 0.18
  ctx.beginPath()
  switch (asset.shape) {
    case 'rect':
      roundedRect(ctx, -w / 2, -h / 2, w, h, radius)
      break
    case 'circle':
      ctx.arc(0, 0, Math.min(w, h) / 2 - 1, 0, Math.PI * 2)
      break
    case 'triangle':
      ctx.moveTo(0, -h / 2)
      ctx.lineTo(w / 2, h / 2)
      ctx.lineTo(-w / 2, h / 2)
      ctx.closePath()
      break
    case 'diamond':
      ctx.moveTo(0, -h / 2)
      ctx.lineTo(w / 2, 0)
      ctx.lineTo(0, h / 2)
      ctx.lineTo(-w / 2, 0)
      ctx.closePath()
      break
    case 'hexagon':
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 3) * index - Math.PI / 2
        const x = (Math.cos(angle) * w) / 2
        const y = (Math.sin(angle) * h) / 2
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    case 'star': {
      for (let index = 0; index < 10; index += 1) {
        const angle = (Math.PI / 5) * index - Math.PI / 2
        const factor = index % 2 === 0 ? 1 : 0.45
        const x = Math.cos(angle) * (w / 2) * factor
        const y = Math.sin(angle) * (h / 2) * factor
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    }
  }
  ctx.fill()
  ctx.stroke()
}

function drawVectorAsset(
  ctx: CanvasRenderingContext2D,
  asset: Extract<Asset, { kind: 'vector' }>,
  width: number,
  height: number
): void {
  const size = Math.min(width, height)
  const color = asset.color ?? '#fbbf24'
  const color2 = asset.color2 ?? shade(color, -45)
  const gradient = ctx.createLinearGradient(0, -size / 2, 0, size / 2)
  gradient.addColorStop(0, shade(color, 45))
  gradient.addColorStop(0.55, color)
  gradient.addColorStop(1, color2)
  ctx.fillStyle = gradient
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = Math.max(1, size * 0.035)

  if (asset.variant === 'coin') {
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.43, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = 'rgba(120,53,15,0.45)'
    ctx.lineWidth = Math.max(1, size * 0.03)
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.31, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,251,235,0.9)'
    drawStarPath(ctx, 0, 0, size * 0.16, size * 0.07, 5, -Math.PI / 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.beginPath()
    ctx.ellipse(-size * 0.16, -size * 0.18, size * 0.05, size * 0.1, -0.5, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  if (asset.variant === 'heart') {
    ctx.beginPath()
    ctx.moveTo(0, size * 0.38)
    ctx.bezierCurveTo(-size * 0.12, size * 0.24, -size * 0.47, size * 0.02, -size * 0.35, -size * 0.2)
    ctx.bezierCurveTo(-size * 0.25, -size * 0.39, -size * 0.02, -size * 0.3, 0, -size * 0.14)
    ctx.bezierCurveTo(size * 0.02, -size * 0.3, size * 0.25, -size * 0.39, size * 0.35, -size * 0.2)
    ctx.bezierCurveTo(size * 0.47, size * 0.02, size * 0.12, size * 0.24, 0, size * 0.38)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(-size * 0.17, -size * 0.16, size * 0.06, size * 0.1, -0.6, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  if (asset.variant === 'gem') {
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.4)
    ctx.lineTo(size * 0.34, -size * 0.14)
    ctx.lineTo(size * 0.22, size * 0.38)
    ctx.lineTo(-size * 0.22, size * 0.38)
    ctx.lineTo(-size * 0.34, -size * 0.14)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.4)
    ctx.lineTo(size * 0.15, -size * 0.14)
    ctx.lineTo(0, size * 0.38)
    ctx.lineTo(-size * 0.15, -size * 0.14)
    ctx.closePath()
    ctx.fill()
    return
  }

  if (asset.variant === 'star') {
    drawStarPath(ctx, 0, 0, size * 0.46, size * 0.2, 5, -Math.PI / 2)
    ctx.fill()
    ctx.stroke()
    return
  }

  if (asset.variant === 'slime') {
    const body = ctx.createLinearGradient(0, -size * 0.4, 0, size * 0.4)
    body.addColorStop(0, shade(color, 38))
    body.addColorStop(0.6, color)
    body.addColorStop(1, color2)
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(-size * 0.42, size * 0.32)
    ctx.bezierCurveTo(-size * 0.5, -size * 0.02, -size * 0.28, -size * 0.42, 0, -size * 0.42)
    ctx.bezierCurveTo(size * 0.28, -size * 0.42, size * 0.5, -size * 0.02, size * 0.42, size * 0.32)
    ctx.bezierCurveTo(size * 0.2, size * 0.44, -size * 0.2, size * 0.44, -size * 0.42, size * 0.32)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(240,253,244,0.55)'
    ctx.lineWidth = Math.max(1, size * 0.03)
    ctx.stroke()
    for (const direction of [-1, 1]) {
      const eyeX = direction * size * 0.15
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.ellipse(eyeX, -size * 0.06, size * 0.09, size * 0.12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#052e16'
      ctx.beginPath()
      ctx.arc(eyeX + direction * size * 0.018, -size * 0.02, size * 0.048, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(5,46,22,0.55)'
    ctx.lineWidth = Math.max(1, size * 0.025)
    ctx.beginPath()
    ctx.arc(0, size * 0.11, size * 0.1, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(-size * 0.2, -size * 0.22, size * 0.07, size * 0.12, -0.5, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  // Key
  ctx.beginPath()
  ctx.arc(-size * 0.16, -size * 0.18, size * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color2
  ctx.fillRect(-size * 0.04, -size * 0.18, size * 0.08, size * 0.5)
  ctx.fillRect(size * 0.02, size * 0.17, size * 0.16, size * 0.07)
  ctx.fillRect(size * 0.02, size * 0.27, size * 0.12, size * 0.07)
}

function drawStarPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  inner: number,
  points: number,
  rotation: number
): void {
  ctx.beginPath()
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner
    const angle = rotation + (Math.PI / points) * index
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function shade(color: string, amount: number): string {
  const hex = color.replace('#', '')
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return color
  const num = parseInt(normalized, 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4 ? color.slice(1).split('').map((c) => c + c).join('') : color.slice(1)
    const num = parseInt(hex, 16)
    return `rgba(${num >> 16}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`
  }
  return color
}
