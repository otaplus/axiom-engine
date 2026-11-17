import { BUILTIN_ASSETS } from './builtinAssets'
import { defaultSettings, flatten } from './project'
import { NODE_DEFAULTS, type Asset, type NodeType, type Project, type Scene, type SceneNode } from './types'

const NODE_TYPES = new Set(Object.keys(NODE_DEFAULTS))
const ASSET_KINDS = new Set(['emoji', 'shape', 'image', 'vector'])

function numberOr(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function normalizeNode(raw: any, usedIds: Set<string>, fallbackName = 'Nodo'): SceneNode {
  const type: NodeType = NODE_TYPES.has(raw?.type) ? raw.type : 'Node2D'
  let id = typeof raw?.id === 'string' && raw.id ? raw.id : `node_${Math.random().toString(36).slice(2, 10)}`
  while (usedIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 5)}`
  usedIds.add(id)
  const props =
    raw?.props && typeof raw.props === 'object' && !Array.isArray(raw.props)
      ? { ...NODE_DEFAULTS[type], ...raw.props }
      : { ...NODE_DEFAULTS[type] }
  const node: SceneNode = {
    id,
    name: stringOr(raw?.name, fallbackName),
    type,
    x: numberOr(raw?.x, 0),
    y: numberOr(raw?.y, 0),
    rotation: numberOr(raw?.rotation, 0),
    scaleX: numberOr(raw?.scaleX, 1),
    scaleY: numberOr(raw?.scaleY, 1),
    visible: raw?.visible !== false,
    zIndex: numberOr(raw?.zIndex, 0),
    props,
    children: []
  }
  if (raw?.template === true) node.template = true
  if (typeof raw?.script === 'string' && raw.script.trim()) node.script = raw.script
  if (Array.isArray(raw?.children)) {
    node.children = raw.children.map((child: any) => normalizeNode(child, usedIds, 'Nodo'))
  }
  return node
}

function normalizeAsset(raw: any, usedIds: Set<string>): Asset | null {
  if (!raw || typeof raw !== 'object' || !ASSET_KINDS.has(raw.kind)) return null
  let id = stringOr(raw.id, '')
  if (!id) return null
  while (usedIds.has(id)) id = `${id}_2`
  usedIds.add(id)
  const name = stringOr(raw.name, id)
  if (raw.kind === 'emoji') {
    return {
      id,
      name,
      kind: 'emoji',
      glyph: stringOr(raw.glyph, '✨').slice(0, 8),
      background: typeof raw.background === 'string' ? raw.background : undefined,
      size: numberOr(raw.size, 96)
    }
  }
  if (raw.kind === 'shape') {
    const shape = ['rect', 'circle', 'triangle', 'star', 'hexagon', 'diamond'].includes(raw.shape)
      ? raw.shape
      : 'circle'
    return {
      id,
      name,
      kind: 'shape',
      shape,
      color: stringOr(raw.color, '#38bdf8'),
      color2: typeof raw.color2 === 'string' ? raw.color2 : undefined,
      size: numberOr(raw.size, 96)
    }
  }
  if (raw.kind === 'vector') {
    const variant = ['coin', 'heart', 'gem', 'star', 'key', 'slime'].includes(raw.variant) ? raw.variant : 'coin'
    return {
      id,
      name,
      kind: 'vector',
      variant,
      color: typeof raw.color === 'string' ? raw.color : undefined,
      color2: typeof raw.color2 === 'string' ? raw.color2 : undefined,
      size: numberOr(raw.size, 96)
    }
  }
  if (typeof raw.dataUrl !== 'string' || !raw.dataUrl.startsWith('data:image/')) return null
  return {
    id,
    name,
    kind: 'image',
    dataUrl: raw.dataUrl,
    width: numberOr(raw.width, 128),
    height: numberOr(raw.height, 128)
  }
}

export function normalizeProject(raw: any): Project {
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no contiene un proyecto válido.')
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    throw new Error('El proyecto no tiene escenas.')
  }
  const sceneIds = new Set<string>()
  const scenes: Scene[] = []
  for (const rawScene of raw.scenes) {
    if (!rawScene || typeof rawScene !== 'object' || !rawScene.root) continue
    let id = stringOr(rawScene.id, `scene_${scenes.length + 1}`)
    while (sceneIds.has(id)) id = `${id}_2`
    sceneIds.add(id)
    const usedNodeIds = new Set<string>()
    const root = normalizeNode(rawScene.root, usedNodeIds, 'Mundo')
    const scene: Scene = {
      id,
      name: stringOr(rawScene.name, 'Escena'),
      root,
      settings: {
        background: stringOr(rawScene.settings?.background, ''),
        style: ['gradient', 'solid', 'stars', 'grid'].includes(rawScene.settings?.style)
          ? rawScene.settings.style
          : 'stars'
      }
    }
    // Name collisions inside the same parent would make path references ambiguous.
    const visit = (node: SceneNode) => {
      const names = new Set<string>()
      for (const child of node.children) {
        let candidate = child.name
        let suffix = 2
        while (names.has(candidate.toLowerCase())) candidate = `${child.name}${suffix++}`
        names.add(candidate.toLowerCase())
        child.name = candidate
        visit(child)
      }
    }
    visit(root)
    scenes.push(scene)
  }
  if (!scenes.length) throw new Error('Ninguna escena del proyecto se pudo leer.')

  const defaults = defaultSettings()
  const settings = {
    ...defaults,
    width: Math.max(160, Math.min(7680, numberOr(raw.settings?.width, defaults.width))),
    height: Math.max(90, Math.min(4320, numberOr(raw.settings?.height, defaults.height))),
    gravity: numberOr(raw.settings?.gravity, defaults.gravity),
    background: stringOr(raw.settings?.background, defaults.background),
    backgroundStyle: ['gradient', 'solid', 'stars', 'grid'].includes(raw.settings?.backgroundStyle)
      ? raw.settings.backgroundStyle
      : defaults.backgroundStyle,
    accent: stringOr(raw.settings?.accent, defaults.accent),
    pixelArt: Boolean(raw.settings?.pixelArt),
    showFps: Boolean(raw.settings?.showFps)
  }

  const assetIds = new Set<string>()
  const assets: Asset[] = []
  if (Array.isArray(raw.assets)) {
    for (const rawAsset of raw.assets) {
      const asset = normalizeAsset(rawAsset, assetIds)
      if (asset) assets.push(asset)
    }
  }
  for (const builtin of BUILTIN_ASSETS) {
    const index = assets.findIndex((asset) => asset.id === builtin.id)
    if (index < 0) {
      assets.push({ ...builtin })
      assetIds.add(builtin.id)
    } else if (builtin.kind === 'vector' && assets[index].kind !== 'vector') {
      // Older autosaves used an emoji that not every Windows font renders.
      assets[index] = { ...builtin }
    }
  }

  const mainSceneId = scenes.some((scene) => scene.id === raw.mainSceneId) ? raw.mainSceneId : scenes[0].id
  return {
    format: 'axiom-project',
    version: 1,
    name: stringOr(raw.name, 'Proyecto sin título'),
    settings,
    assets,
    scenes,
    mainSceneId,
    createdAt: stringOr(raw.createdAt, new Date().toISOString()),
    updatedAt: new Date().toISOString()
  }
}

export function parseProject(content: string): Project {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  return normalizeProject(parsed)
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

export function projectStats(project: Project): { nodes: number; scripts: number; scenes: number } {
  let nodes = 0
  let scripts = 0
  for (const scene of project.scenes) {
    const all = flatten(scene.root)
    nodes += all.length
    scripts += all.filter((node) => Boolean(node.script)).length
  }
  return { nodes, scripts, scenes: project.scenes.length }
}
