import { AssetRenderer, roundedRect, withAlpha } from './assets'
import { collectCanvasLayers, drawBackground, drawNodeTree, drawShadow } from './draw'
import { sceneVisualSettings } from './project'
import type { Project, Scene, SceneNode } from './types'

export interface EditorCamera {
  x: number
  y: number
  zoom: number
}

export interface EditorViewOptions {
  selectedId: string | null
  hoverId: string | null
  showGrid: boolean
  showCollision: boolean
  camera: EditorCamera
}

const assetRenderer = new AssetRenderer()

export function canvasMetrics(canvas: HTMLCanvasElement): { width: number; height: number; dpr: number } {
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  return { width, height, dpr }
}

export function screenToWorld(
  canvas: HTMLCanvasElement,
  camera: EditorCamera,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const width = rect.width || 1
  const height = rect.height || 1
  return {
    x: (clientX - rect.left - width / 2) / camera.zoom + camera.x,
    y: (clientY - rect.top - height / 2) / camera.zoom + camera.y
  }
}

export function worldToScreen(
  canvas: HTMLCanvasElement,
  camera: EditorCamera,
  x: number,
  y: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2 + (x - camera.x) * camera.zoom,
    y: rect.top + rect.height / 2 + (y - camera.y) * camera.zoom
  }
}

function findPath(root: SceneNode, id: string): SceneNode[] | null {
  if (root.id === id) return [root]
  for (const child of root.children) {
    const found = findPath(child, id)
    if (found) return [root, ...found]
  }
  return null
}

export function findNodeById(root: SceneNode, id: string | null): SceneNode | null {
  if (!id) return null
  const path = findPath(root, id)
  return path ? path[path.length - 1] : null
}

function applyNodeTransform(ctx: CanvasRenderingContext2D, node: SceneNode): void {
  ctx.translate(node.x, node.y)
  if (node.rotation) ctx.rotate((node.rotation * Math.PI) / 180)
  if (node.scaleX !== 1 || node.scaleY !== 1) ctx.scale(node.scaleX, node.scaleY)
}

function selectionSize(node: SceneNode): { width: number; height: number } {
  const width = Number(node.props.width ?? (node.type === 'Label2D' ? 180 : 48))
  const height = Number(node.props.height ?? (node.type === 'Label2D' ? 32 : 48))
  return { width: Math.max(18, width), height: Math.max(18, height) }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: EditorCamera,
  width: number,
  height: number,
  accent: string
): void {
  const spacing = 32
  const left = camera.x - width / 2 / camera.zoom
  const right = camera.x + width / 2 / camera.zoom
  const top = camera.y - height / 2 / camera.zoom
  const bottom = camera.y + height / 2 / camera.zoom
  const startX = Math.floor(left / spacing) * spacing
  const startY = Math.floor(top / spacing) * spacing
  const majorEvery = 5

  ctx.save()
  ctx.lineWidth = 1 / camera.zoom
  for (let x = startX; x <= right; x += spacing) {
    const major = Math.round(x / spacing) % majorEvery === 0
    ctx.strokeStyle = major ? withAlpha(accent, 0.18) : 'rgba(120,140,170,0.075)'
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()
  }
  for (let y = startY; y <= bottom; y += spacing) {
    const major = Math.round(y / spacing) % majorEvery === 0
    ctx.strokeStyle = major ? withAlpha(accent, 0.18) : 'rgba(120,140,170,0.075)'
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(56,189,248,0.35)'
  ctx.lineWidth = 1.2 / camera.zoom
  ctx.beginPath()
  ctx.moveTo(left, 0)
  ctx.lineTo(right, 0)
  ctx.moveTo(0, top)
  ctx.lineTo(0, bottom)
  ctx.stroke()
  ctx.restore()
}

function drawCollisionBounds(ctx: CanvasRenderingContext2D, root: SceneNode, zoom: number): void {
  const visit = (node: SceneNode) => {
    if (!node.visible) return
    if (['CharacterBody2D', 'Area2D', 'StaticBody2D'].includes(node.type)) {
      const width = Number(node.props.width ?? 0)
      const height = Number(node.props.height ?? 0)
      if (width > 0 && height > 0) {
        ctx.save()
        ctx.translate(node.x, node.y)
        if (node.rotation) ctx.rotate((node.rotation * Math.PI) / 180)
        ctx.strokeStyle =
          node.type === 'Area2D'
            ? 'rgba(167,139,250,0.5)'
            : node.type === 'CharacterBody2D'
              ? 'rgba(74,222,128,0.45)'
              : 'rgba(245,158,11,0.35)'
        ctx.lineWidth = 1 / zoom
        ctx.setLineDash([4 / zoom, 4 / zoom])
        ctx.strokeRect(-width / 2, -height / 2, width, height)
        ctx.restore()
      }
    }
    node.children.forEach(visit)
  }
  visit(root)
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  nodeId: string,
  camera: EditorCamera,
  accent: string
): void {
  const path = findPath(scene.root, nodeId)
  if (!path) return
  const node = path[path.length - 1]
  ctx.save()
  for (const step of path) applyNodeTransform(ctx, step)
  const { width, height } = selectionSize(node)
  const line = 1.5 / camera.zoom
  const handleSize = 7 / camera.zoom
  ctx.strokeStyle = accent
  ctx.fillStyle = 'rgba(56,189,248,0.08)'
  ctx.lineWidth = line
  ctx.setLineDash(node.type === 'Label2D' ? [5 / camera.zoom, 3 / camera.zoom] : [])
  roundedRect(ctx, -width / 2, -height / 2, width, height, 2 / camera.zoom)
  ctx.fill()
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = accent
  for (const [x, y] of [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2]
  ]) {
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
  }
  ctx.restore()
}

function drawHover(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  nodeId: string,
  camera: EditorCamera
): void {
  const path = findPath(scene.root, nodeId)
  if (!path) return
  const node = path[path.length - 1]
  ctx.save()
  for (const step of path) applyNodeTransform(ctx, step)
  const { width, height } = selectionSize(node)
  ctx.strokeStyle = 'rgba(226,232,240,0.55)'
  ctx.lineWidth = 1 / camera.zoom
  ctx.setLineDash([3 / camera.zoom, 3 / camera.zoom])
  ctx.strokeRect(-width / 2, -height / 2, width, height)
  ctx.restore()
}

function drawCanvasLayersEditor(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  project: Project,
  camera: EditorCamera,
  options: EditorViewOptions,
  width: number,
  height: number
): void {
  const layers = collectCanvasLayers(scene.root)
  if (!layers.length) return
  const frameLeft = width / 2 + (0 - camera.x) * camera.zoom - (project.settings.width * camera.zoom) / 2
  const frameTop = height / 2 + (0 - camera.y) * camera.zoom - (project.settings.height * camera.zoom) / 2
  ctx.save()
  ctx.beginPath()
  ctx.rect(frameLeft, frameTop, project.settings.width * camera.zoom, project.settings.height * camera.zoom)
  ctx.clip()
  ctx.translate(frameLeft, frameTop)
  ctx.scale(camera.zoom, camera.zoom)
  for (const layer of layers) {
    if (!layer.visible) continue
    ctx.save()
    ctx.translate(layer.x, layer.y)
    for (const child of [...layer.children].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
      drawNodeTree(ctx, child, {
        assets: assetRenderer,
        project,
        editor: true,
        showTemplates: true,
        time: performance.now() / 1000,
        vars: { score: 0, lives: 3, time: 0 }
      })
    }
    ctx.restore()
  }
  ctx.restore()
  // Selection path for HUD nodes is drawn by translating into the frame space.
  if (options.selectedId) {
    const path = findPath(scene.root, options.selectedId)
    if (path && path.some((node) => node.type === 'CanvasLayer')) {
      ctx.save()
      ctx.translate(frameLeft, frameTop)
      ctx.scale(camera.zoom, camera.zoom)
      for (const step of path) applyNodeTransform(ctx, step)
      const node = path[path.length - 1]
      const { width: nodeWidth, height: nodeHeight } = selectionSize(node)
      ctx.strokeStyle = project.settings.accent
      ctx.lineWidth = 1.5 / camera.zoom
      ctx.strokeRect(-nodeWidth / 2, -nodeHeight / 2, nodeWidth, nodeHeight)
      ctx.restore()
    }
  }
}

export function renderEditor(
  canvas: HTMLCanvasElement,
  project: Project,
  scene: Scene,
  options: EditorViewOptions
): void {
  const { width, height, dpr } = canvasMetrics(canvas)
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#070a11'
  ctx.fillRect(0, 0, width, height)

  const dotSpacing = 24
  ctx.fillStyle = 'rgba(100,116,139,0.16)'
  for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
    for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const camera = options.camera
  const { width: gameWidth, height: gameHeight } = project.settings
  const frameLeft = width / 2 + (0 - camera.x) * camera.zoom - (gameWidth * camera.zoom) / 2
  const frameTop = height / 2 + (0 - camera.y) * camera.zoom - (gameHeight * camera.zoom) / 2
  const frameWidth = gameWidth * camera.zoom
  const frameHeight = gameHeight * camera.zoom

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 32
  ctx.fillStyle = '#0b0f19'
  roundedRect(ctx, frameLeft, frameTop, frameWidth, frameHeight, 4)
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundedRect(ctx, frameLeft, frameTop, frameWidth, frameHeight, 4)
  ctx.clip()
  ctx.translate(width / 2, height / 2)
  ctx.scale(camera.zoom, camera.zoom)
  ctx.translate(-camera.x, -camera.y)
  drawBackground(ctx, sceneVisualSettings(project, scene), gameWidth, gameHeight, {
    camera,
    time: performance.now() / 1000,
    editor: true
  })
  if (options.showGrid) drawGrid(ctx, camera, width, height, project.settings.accent)
  drawNodeTree(ctx, scene.root, {
    assets: assetRenderer,
    project,
    editor: true,
    showTemplates: true,
    time: performance.now() / 1000,
    camera,
    vars: { score: 0, lives: 3, time: 0 }
  })
  if (options.showCollision) drawCollisionBounds(ctx, scene.root, camera.zoom)
  if (options.hoverId && options.hoverId !== options.selectedId) {
    drawHover(ctx, scene, options.hoverId, camera)
  }
  if (options.selectedId) {
    drawSelection(ctx, scene, options.selectedId, camera, project.settings.accent)
  }
  ctx.restore()

  drawCanvasLayersEditor(ctx, scene, project, camera, options, width, height)

  ctx.save()
  ctx.strokeStyle = 'rgba(148,163,184,0.28)'
  ctx.lineWidth = 1
  ctx.strokeRect(frameLeft + 0.5, frameTop + 0.5, frameWidth - 1, frameHeight - 1)
  ctx.fillStyle = 'rgba(15,23,42,0.9)'
  ctx.strokeStyle = 'rgba(56,189,248,0.35)'
  roundedRect(ctx, frameLeft, frameTop - 24, 92, 20, 5)
  ctx.fill()
  ctx.stroke()
  ctx.font = '600 10px "Segoe UI", sans-serif'
  ctx.fillStyle = '#7dd3fc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${gameWidth} × ${gameHeight}`, frameLeft + 46, frameTop - 13.5)
  ctx.restore()
}

export function pickNode(scene: Scene, worldX: number, worldY: number): SceneNode | null {
  const candidates: Array<{ node: SceneNode; depth: number }> = []
  const visit = (node: SceneNode, offsetX: number, offsetY: number, depth: number) => {
    if (!node.visible) return
    const world = { x: offsetX + node.x, y: offsetY + node.y }
    if (node.type !== 'Node2D' && node.type !== 'CanvasLayer') {
      const { width, height } = selectionSize(node)
      if (
        worldX >= world.x - width / 2 &&
        worldX <= world.x + width / 2 &&
        worldY >= world.y - height / 2 &&
        worldY <= world.y + height / 2
      ) {
        candidates.push({ node, depth })
      }
    }
    const sorted = [...node.children].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    for (const child of sorted) visit(child, world.x, world.y, depth + 1)
  }
  visit(scene.root, 0, 0, 0)
  if (!candidates.length) return null
  candidates.sort((a, b) => {
    if (b.node.zIndex !== a.node.zIndex) return b.node.zIndex - a.node.zIndex
    return b.depth - a.depth
  })
  return candidates[0].node
}

export function hitTestHud(
  scene: Scene,
  project: Project,
  camera: EditorCamera,
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number
): SceneNode | null {
  const frameLeft = canvasWidth / 2 + (0 - camera.x) * camera.zoom - (project.settings.width * camera.zoom) / 2
  const frameTop = canvasHeight / 2 + (0 - camera.y) * camera.zoom - (project.settings.height * camera.zoom) / 2
  const localX = (screenX - frameLeft) / camera.zoom
  const localY = (screenY - frameTop) / camera.zoom
  const layers = collectCanvasLayers(scene.root)
  const candidates: SceneNode[] = []
  const visit = (node: SceneNode, offsetX: number, offsetY: number) => {
    const x = offsetX + node.x
    const y = offsetY + node.y
    if (node.type !== 'Node2D' && node.type !== 'CanvasLayer') {
      const { width, height } = selectionSize(node)
      if (localX >= x - width / 2 && localX <= x + width / 2 && localY >= y - height / 2 && localY <= y + height / 2) {
        candidates.push(node)
      }
    }
    const sorted = [...node.children].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    sorted.forEach((child) => visit(child, x, y))
  }
  layers.forEach((layer) => visit(layer, 0, 0))
  return candidates.length ? candidates[candidates.length - 1] : null
}

export function nodeWorldPosition(scene: Scene, id: string): { x: number; y: number } | null {
  const path = findPath(scene.root, id)
  if (!path) return null
  let x = 0
  let y = 0
  for (const node of path) {
    x += node.x
    y += node.y
  }
  return { x, y }
}
