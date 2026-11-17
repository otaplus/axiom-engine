import { cloneBuiltinAssets } from './builtinAssets'
import {
  NODE_DEFAULTS,
  type NodeProps,
  type NodeType,
  type Project,
  type ProjectSettings,
  type Scene,
  type SceneNode
} from './types'

export function uid(prefix = 'id'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `${prefix}_${random}`
}

export function defaultSettings(): ProjectSettings {
  return {
    width: 960,
    height: 540,
    gravity: 1600,
    background: '#0d1526',
    backgroundStyle: 'stars',
    accent: '#38bdf8',
    pixelArt: false,
    showFps: false
  }
}

export function createNode(
  type: NodeType,
  name: string,
  overrides: Partial<SceneNode> & { props?: NodeProps } = {}
): SceneNode {
  return {
    id: overrides.id ?? uid('node'),
    name,
    type,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    rotation: overrides.rotation ?? 0,
    scaleX: overrides.scaleX ?? 1,
    scaleY: overrides.scaleY ?? 1,
    visible: overrides.visible ?? true,
    zIndex: overrides.zIndex ?? 0,
    template: overrides.template,
    props: { ...NODE_DEFAULTS[type], ...(overrides.props ?? {}) },
    script: overrides.script,
    children: overrides.children ?? []
  }
}

export function createScene(name = 'Mundo'): Scene {
  return {
    id: uid('scene'),
    name,
    settings: {
      background: '#0d1526',
      style: 'stars'
    },
    root: createNode('Node2D', name)
  }
}

export function createProject(name = 'Mi juego'): Project {
  const scene = createScene('Mundo')
  const camera = createNode('Camera2D', 'Cámara', {
    props: { active: true, zoom: 1, smoothing: 5, target: 'Jugador' }
  })
  const player = createNode('CharacterBody2D', 'Jugador', {
    x: 0,
    y: 0,
    props: { width: 38, height: 54, color: '#4ade80', group: 'player' },
    children: [
      createNode('Sprite2D', 'Aspecto', {
        props: { assetId: 'hero', width: 64, height: 64 }
      })
    ]
  })
  const ground = createNode('StaticBody2D', 'Suelo', {
    y: 250,
    props: { width: 1100, height: 40, color: '#172136', edgeColor: '#38bdf8' }
  })
  scene.root.children.push(camera, player, ground)
  return {
    format: 'axiom-project',
    version: 1,
    name,
    settings: defaultSettings(),
    assets: cloneBuiltinAssets(),
    scenes: [scene],
    mainSceneId: scene.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export function createEmptyProject(name = 'Proyecto sin título'): Project {
  const scene = createScene('Mundo')
  return {
    format: 'axiom-project',
    version: 1,
    name,
    settings: defaultSettings(),
    assets: cloneBuiltinAssets(),
    scenes: [scene],
    mainSceneId: scene.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export function walkNodes(root: SceneNode, visitor: (node: SceneNode, path: string[]) => void, path: string[] = []): void {
  visitor(root, path)
  for (const child of root.children) {
    walkNodes(child, visitor, [...path, root.name])
  }
}

export function flatten(root: SceneNode): SceneNode[] {
  const result: SceneNode[] = []
  walkNodes(root, (node) => result.push(node))
  return result
}

export function nodePath(root: SceneNode, target: SceneNode): string {
  const search = (node: SceneNode, trail: string[]): string | null => {
    if (node === target) return [...trail, node.name].join('/')
    for (const child of node.children) {
      const found = search(child, [...trail, node.name])
      if (found) return found
    }
    return null
  }
  return search(root, []) ?? target.name
}

export function normalizePath(path: string): string[] {
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function findNode(root: SceneNode, path: string): SceneNode | null {
  if (!path) return null
  const parts = normalizePath(path)
  if (parts.length === 0) return null

  // Tolerate an optional scene/root prefix.
  if (parts[0].toLowerCase() === root.name.toLowerCase()) parts.shift()
  if (parts.length === 0) return root

  let current: SceneNode | null = root
  for (const part of parts) {
    if (!current) return null
    const lower = part.toLowerCase()
    const next: SceneNode | undefined =
      current.children.find((child) => child.name.toLowerCase() === lower) ??
      current.children.find((child) => child.name.toLowerCase().startsWith(lower))
    current = next ?? null
  }
  if (current) return current

  // A unique short name anywhere in the tree is accepted.
  const matches = flatten(root).filter((node) => node.name.toLowerCase() === parts[parts.length - 1].toLowerCase())
  return matches.length === 1 ? matches[0] : null
}

export function findParent(root: SceneNode, target: SceneNode): SceneNode | null {
  for (const child of root.children) {
    if (child === target) return root
    const found = findParent(child, target)
    if (found) return found
  }
  return null
}

export function isDescendant(ancestor: SceneNode, possible: SceneNode): boolean {
  if (ancestor === possible) return true
  return ancestor.children.some((child) => isDescendant(child, possible))
}

export function uniqueName(parent: SceneNode, desired: string): string {
  const base = desired.trim() || 'Nodo'
  const names = new Set(parent.children.map((child) => child.name.toLowerCase()))
  if (!names.has(base.toLowerCase())) return base
  let index = 2
  while (names.has(`${base}${index}`.toLowerCase())) index += 1
  return `${base}${index}`
}

export function addChild(parent: SceneNode, child: SceneNode): SceneNode {
  child.name = uniqueName(parent, child.name)
  parent.children.push(child)
  return child
}

export function removeNode(root: SceneNode, target: SceneNode): boolean {
  const index = root.children.indexOf(target)
  if (index >= 0) {
    root.children.splice(index, 1)
    return true
  }
  return root.children.some((child) => removeNode(child, target))
}

export function cloneNode(node: SceneNode, regenerateIds = true): SceneNode {
  return {
    ...node,
    id: regenerateIds ? uid('node') : node.id,
    props: structuredClone(node.props),
    children: node.children.map((child) => cloneNode(child, regenerateIds))
  }
}

export function getScene(project: Project, idOrName: string | undefined, fallbackId?: string): Scene | null {
  if (!idOrName) return project.scenes.find((scene) => scene.id === fallbackId) ?? project.scenes[0] ?? null
  const lower = idOrName.toLowerCase()
  return (
    project.scenes.find((scene) => scene.id === idOrName) ??
    project.scenes.find((scene) => scene.name.toLowerCase() === lower) ??
    project.scenes.find((scene) => scene.name.toLowerCase().startsWith(lower)) ??
    null
  )
}

export function exportNodeSummary(node: SceneNode, project: Project, depth = 0): string {
  const indent = '  '.repeat(depth)
  const flags: string[] = []
  if (!node.visible) flags.push('oculto')
  if (node.template) flags.push('plantilla')
  if (node.script) flags.push('script')
  const flagText = flags.length ? ` [${flags.join(', ')}]` : ''
  const asset = node.props.assetId ? project.assets.find((item) => item.id === node.props.assetId) : null
  const assetText = asset ? ` asset=${asset.id}` : ''
  const lines = [
    `${indent}- ${node.name} (${node.type}) pos=(${Math.round(node.x)},${Math.round(node.y)})${assetText}${flagText}`
  ]
  for (const child of node.children) lines.push(exportNodeSummary(child, project, depth + 1))
  return lines.join('\n')
}

export function projectSummary(project: Project, activeSceneId?: string): string {
  const lines = [
    `PROYECTO: ${project.name}`,
    `Resolución: ${project.settings.width}x${project.settings.height} · gravedad: ${project.settings.gravity} · fondo: ${project.settings.backgroundStyle}`,
    `Escenas: ${project.scenes.map((scene) => `${scene.name}${scene.id === project.mainSceneId ? ' (principal)' : ''}`).join(', ')}`,
    `Assets disponibles: ${project.assets.map((asset) => asset.id).join(', ')}`
  ]
  const scene = project.scenes.find((item) => item.id === activeSceneId) ?? project.scenes[0]
  if (scene) {
    lines.push(`\nESCENA ACTIVA: ${scene.name}`)
    lines.push(exportNodeSummary(scene.root, project))
  }
  return lines.join('\n')
}

export function sceneVisualSettings(project: Project, scene: Scene): ProjectSettings {
  return {
    ...project.settings,
    background: scene.settings.background || project.settings.background,
    backgroundStyle: scene.settings.style ?? project.settings.backgroundStyle
  }
}

export function countNodes(scene: Scene): number {
  return flatten(scene.root).length
}

export function sceneStats(scene: Scene): { nodes: number; scripts: number } {
  const all = flatten(scene.root)
  return {
    nodes: all.length,
    scripts: all.filter((node) => Boolean(node.script)).length
  }
}
