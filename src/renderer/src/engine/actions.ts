import { addChild, createNode, createScene, findNode, findParent, getScene, removeNode, uid, uniqueName } from './project'
import { validateScriptSyntax } from './script'
import type { Asset, NodeType, Project, Scene, SceneNode } from './types'

export interface ActionResult {
  project: Project
  activeSceneId: string
  descriptions: string[]
  errors: string[]
}

const NODE_TYPE_ALIASES: Record<string, NodeType> = {
  Node: 'Node2D',
  Node2D: 'Node2D',
  Sprite: 'Sprite2D',
  Sprite2D: 'Sprite2D',
  CharacterBody: 'CharacterBody2D',
  CharacterBody2D: 'CharacterBody2D',
  StaticBody: 'StaticBody2D',
  StaticBody2D: 'StaticBody2D',
  Area: 'Area2D',
  Area2D: 'Area2D',
  Camera: 'Camera2D',
  Camera2D: 'Camera2D',
  Label: 'Label2D',
  Label2D: 'Label2D',
  Timer: 'Timer',
  Audio: 'AudioPlayer',
  AudioPlayer: 'AudioPlayer',
  Particles: 'Particles2D',
  Particles2D: 'Particles2D',
  CanvasLayer: 'CanvasLayer'
}

export function normalizeNodeType(value: unknown): NodeType | null {
  if (typeof value !== 'string') return null
  return NODE_TYPE_ALIASES[value.trim()] ?? NODE_TYPE_ALIASES[value.trim().replace(/2D$/i, '')] ?? null
}

function sanitizeName(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  return value.replace(/[\n\r\t/]/g, ' ').trim().slice(0, 48) || fallback
}

function numberOr(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function resolveScene(project: Project, reference: unknown, activeSceneId: string): Scene | null {
  if (typeof reference === 'string' && reference.trim()) {
    return getScene(project, reference, activeSceneId)
  }
  return getScene(project, undefined, activeSceneId)
}

function nodeSpecToSceneNode(spec: any, fallbackType: NodeType = 'Node2D'): SceneNode {
  const type = normalizeNodeType(spec?.type) ?? fallbackType
  const name = sanitizeName(spec?.name, type)
  const props = spec?.props && typeof spec.props === 'object' && !Array.isArray(spec.props) ? spec.props : {}
  const script = typeof spec?.script === 'string' ? spec.script : undefined
  const node = createNode(type, name, {
    x: numberOr(spec?.x, 0),
    y: numberOr(spec?.y, 0),
    rotation: numberOr(spec?.rotation, 0),
    scaleX: numberOr(spec?.scaleX, 1),
    scaleY: numberOr(spec?.scaleY, 1),
    visible: spec?.visible !== false,
    zIndex: numberOr(spec?.zIndex, 0),
    template: Boolean(spec?.template),
    props,
    script
  })
  if (Array.isArray(spec?.children)) {
    for (const childSpec of spec.children) {
      node.children.push(nodeSpecToSceneNode(childSpec))
    }
  }
  return node
}

function attachScripts(node: SceneNode, errors: string[]): void {
  if (node.script) {
    const error = validateScriptSyntax(node.script)
    if (error) {
      errors.push(`Script inválido en «${node.name}»: ${error}`)
      delete node.script
    }
  }
  node.children.forEach((child) => attachScripts(child, errors))
}

function collectUnknownTypes(spec: any, errors: string[]): void {
  if (!spec || typeof spec !== 'object') return
  if (spec.type && !normalizeNodeType(spec.type)) {
    errors.push(`Tipo de nodo desconocido: ${String(spec.type)}`)
  }
  if (Array.isArray(spec.children)) spec.children.forEach((child: any) => collectUnknownTypes(child, errors))
}

function findParentForAction(scene: Scene, reference: unknown): SceneNode | null {
  if (typeof reference !== 'string' || !reference.trim()) return scene.root
  const trimmed = reference.trim()
  if (trimmed.toLowerCase() === scene.root.name.toLowerCase()) return scene.root
  return findNode(scene.root, trimmed)
}

function applyAddNode(
  project: Project,
  scene: Scene,
  action: any,
  descriptions: string[],
  errors: string[]
): void {
  if (!action.node || typeof action.node !== 'object') {
    errors.push('add_node requiere un objeto "node".')
    return
  }
  collectUnknownTypes(action.node, errors)
  const parent = findParentForAction(scene, action.parent)
  if (!parent) {
    errors.push(`No se encontró el nodo padre «${String(action.parent)}» en ${scene.name}.`)
    return
  }
  const scriptErrors: string[] = []
  const node = nodeSpecToSceneNode(action.node)
  attachScripts(node, scriptErrors)
  errors.push(...scriptErrors)
  node.name = uniqueName(parent, node.name)
  parent.children.push(node)
  descriptions.push(`Nodo «${node.name}» (${node.type}) añadido en ${parent.name}`)
}

function updateNodeFields(node: SceneNode, patch: any, parent: SceneNode | null, errors: string[]): void {
  if (!patch || typeof patch !== 'object') {
    errors.push('El parche del nodo no es válido.')
    return
  }
  if (patch.name !== undefined) {
    const newName = sanitizeName(patch.name, node.name)
    if (parent) {
      const siblings = parent.children.filter((child) => child.id !== node.id)
      const collision = siblings.find((child) => child.name.toLowerCase() === newName.toLowerCase())
      node.name = collision ? uniqueName(parent, newName) : newName
    } else {
      node.name = newName
    }
  }
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'zIndex'] as const) {
    if (patch[key] !== undefined) node[key] = numberOr(patch[key], node[key])
  }
  if (patch.visible !== undefined) node.visible = Boolean(patch.visible)
  if (patch.template !== undefined) node.template = Boolean(patch.template)
  if (patch.props && typeof patch.props === 'object' && !Array.isArray(patch.props)) {
    for (const [key, value] of Object.entries(patch.props)) {
      if (key === '__proto__' || key === 'constructor') continue
      node.props[key] = value
    }
  }
  if (patch.script !== undefined) {
    if (typeof patch.script !== 'string' || !patch.script.trim()) {
      delete node.script
    } else {
      const error = validateScriptSyntax(patch.script)
      if (error) errors.push(`Script inválido en «${node.name}»: ${error}`)
      else node.script = patch.script
    }
  }
}

export function applyActions(project: Project, actions: unknown[], activeSceneId: string): ActionResult {
  const next = structuredClone(project) as Project
  const descriptions: string[] = []
  const errors: string[] = []
  let sceneId = activeSceneId

  if (!Array.isArray(actions)) {
    return { project: next, activeSceneId, descriptions, errors: ['El bloque de acciones no es una lista.'] }
  }

  actions.forEach((rawAction, index) => {
    if (!rawAction || typeof rawAction !== 'object' || Array.isArray(rawAction)) {
      errors.push(`Acción ${index + 1}: formato inválido.`)
      return
    }
    const action = rawAction as any
    const type = String(action.type ?? action.action ?? action.op ?? '').trim()
    try {
      switch (type) {
        case 'set_project': {
          if (action.name !== undefined) next.name = sanitizeName(action.name, next.name)
          if (action.settings && typeof action.settings === 'object') {
            const settings = action.settings
            for (const key of ['width', 'height', 'gravity'] as const) {
              if (settings[key] !== undefined) {
                const value = numberOr(settings[key], next.settings[key])
                if (value > 0) next.settings[key] = value
              }
            }
            if (typeof settings.background === 'string') next.settings.background = settings.background
            if (typeof settings.accent === 'string') next.settings.accent = settings.accent
            if (['gradient', 'solid', 'stars', 'grid'].includes(settings.backgroundStyle)) {
              next.settings.backgroundStyle = settings.backgroundStyle
            }
            if (settings.pixelArt !== undefined) next.settings.pixelArt = Boolean(settings.pixelArt)
            if (settings.showFps !== undefined) next.settings.showFps = Boolean(settings.showFps)
          }
          descriptions.push('Ajustes del proyecto actualizados')
          break
        }
        case 'create_scene': {
          const scene = createScene(sanitizeName(action.name, `Escena ${next.scenes.length + 1}`))
          if (action.rootName) scene.root.name = sanitizeName(action.rootName, scene.name)
          if (action.root && typeof action.root === 'object') {
            const scriptErrors: string[] = []
            collectUnknownTypes(action.root, scriptErrors)
            errors.push(...scriptErrors)
            const root = nodeSpecToSceneNode({ ...action.root, name: action.root.name ?? scene.root.name })
            attachScripts(root, scriptErrors)
            scene.root = root
          }
          if (action.settings && typeof action.settings === 'object') {
            if (typeof action.settings.background === 'string') scene.settings.background = action.settings.background
            if (['gradient', 'solid', 'stars', 'grid'].includes(action.settings.style)) {
              scene.settings.style = action.settings.style
            }
          }
          next.scenes.push(scene)
          sceneId = scene.id
          if (action.setMain) next.mainSceneId = scene.id
          descriptions.push(`Escena «${scene.name}» creada`)
          break
        }
        case 'delete_scene': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) {
            errors.push(`No se encontró la escena «${String(action.scene)}».`)
            break
          }
          if (next.scenes.length <= 1) {
            errors.push('No se puede eliminar la última escena.')
            break
          }
          next.scenes = next.scenes.filter((item) => item.id !== scene.id)
          if (next.mainSceneId === scene.id) next.mainSceneId = next.scenes[0].id
          if (sceneId === scene.id) sceneId = next.mainSceneId
          descriptions.push(`Escena «${scene.name}» eliminada`)
          break
        }
        case 'set_main_scene': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) {
            errors.push(`No se encontró la escena «${String(action.scene)}».`)
            break
          }
          next.mainSceneId = scene.id
          descriptions.push(`Escena principal: «${scene.name}»`)
          break
        }
        case 'add_node': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) {
            errors.push('No hay una escena activa para añadir el nodo.')
            break
          }
          applyAddNode(next, scene, action, descriptions, errors)
          break
        }
        case 'update_node': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) {
            errors.push('No hay una escena activa.')
            break
          }
          const target = findNode(scene.root, String(action.target ?? action.node ?? ''))
          if (!target) {
            errors.push(`No se encontró el nodo «${String(action.target ?? action.node)}».`)
            break
          }
          updateNodeFields(target, action.patch ?? action, findParent(scene.root, target), errors)
          descriptions.push(`Nodo «${target.name}» actualizado`)
          break
        }
        case 'delete_node': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) break
          const target = findNode(scene.root, String(action.target ?? action.node ?? ''))
          if (!target) {
            errors.push(`No se encontró el nodo «${String(action.target ?? action.node)}».`)
            break
          }
          if (target === scene.root) {
            errors.push('No se puede eliminar el nodo raíz de la escena.')
            break
          }
          removeNode(scene.root, target)
          descriptions.push(`Nodo «${target.name}» eliminado`)
          break
        }
        case 'duplicate_node': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) break
          const target = findNode(scene.root, String(action.target ?? action.node ?? ''))
          if (!target) {
            errors.push(`No se encontró el nodo «${String(action.target ?? action.node)}».`)
            break
          }
          const parent = findParent(scene.root, target)
          if (!parent) {
            errors.push('No se puede duplicar la raíz.')
            break
          }
          const copy = structuredClone(target)
          copy.id = uid('node')
          copy.name = uniqueName(parent, sanitizeName(action.name, `${target.name} copia`))
          copy.children.forEach(function assign(child) {
            child.id = uid('node')
            child.children.forEach(assign)
          })
          parent.children.push(copy)
          descriptions.push(`Nodo «${target.name}» duplicado`)
          break
        }
        case 'set_script': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) break
          const target = findNode(scene.root, String(action.target ?? action.node ?? ''))
          if (!target) {
            errors.push(`No se encontró el nodo «${String(action.target ?? action.node)}».`)
            break
          }
          const code = typeof action.code === 'string' ? action.code : ''
          if (code.trim()) {
            const error = validateScriptSyntax(code)
            if (error) {
              errors.push(`Script inválido en «${target.name}»: ${error}`)
              break
            }
            target.script = code
            descriptions.push(`Script de «${target.name}» actualizado`)
          } else {
            delete target.script
            descriptions.push(`Script de «${target.name}» eliminado`)
          }
          break
        }
        case 'set_scene_settings': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) break
          const settings = action.settings ?? {}
          if (typeof settings.background === 'string') scene.settings.background = settings.background
          if (['gradient', 'solid', 'stars', 'grid'].includes(settings.style)) scene.settings.style = settings.style
          descriptions.push(`Fondo de «${scene.name}» actualizado`)
          break
        }
        case 'create_asset': {
          const asset = createAssetFromAction(action, next.assets, errors)
          if (asset) {
            next.assets.push(asset)
            descriptions.push(`Asset «${asset.name}» creado`)
          }
          break
        }
        case 'move_node': {
          const scene = resolveScene(next, action.scene, sceneId)
          if (!scene) break
          const target = findNode(scene.root, String(action.target ?? action.node ?? ''))
          if (!target || target === scene.root) {
            errors.push('El nodo a mover no es válido.')
            break
          }
          const newParent = findParentForAction(scene, action.parent)
          if (!newParent) {
            errors.push(`No se encontró el nodo padre «${String(action.parent)}».`)
            break
          }
          if (findNode(target, newParent.name)) {
            errors.push('No se puede mover un nodo dentro de sí mismo.')
            break
          }
          removeNode(scene.root, target)
          addChild(newParent, target)
          descriptions.push(`«${target.name}» movido a ${newParent.name}`)
          break
        }
        default:
          errors.push(`Acción desconocida: "${type || '(sin tipo)'}".`)
      }
    } catch (error) {
      errors.push(`Acción "${type}" falló: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  next.updatedAt = new Date().toISOString()
  return { project: next, activeSceneId: sceneId, descriptions, errors }
}

function createAssetFromAction(action: any, existing: Asset[], errors: string[]): Asset | null {
  const source = action.asset && typeof action.asset === 'object' ? action.asset : action
  const name = sanitizeName(source.name, '')
  if (!name) {
    errors.push('create_asset requiere un nombre.')
    return null
  }
  const idBase = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32)
  if (!idBase) {
    errors.push('El nombre del asset no produce un id válido.')
    return null
  }
  let id = idBase
  let suffix = 2
  while (existing.some((asset) => asset.id === id)) id = `${idBase}_${suffix++}`
  const kind = source.kind === 'shape' ? 'shape' : 'emoji'
  if (kind === 'shape') {
    const color = typeof source.color === 'string' ? source.color : '#38bdf8'
    const color2 = typeof source.color2 === 'string' ? source.color2 : undefined
    const shape = ['rect', 'circle', 'triangle', 'star', 'hexagon', 'diamond'].includes(source.shape)
      ? source.shape
      : 'star'
    return { id, name, kind: 'shape', shape, color, color2, size: 96 }
  }
  const glyph = typeof source.glyph === 'string' && source.glyph.trim() ? source.glyph.trim().slice(0, 8) : '✨'
  return {
    id,
    name,
    kind: 'emoji',
    glyph,
    background: typeof source.background === 'string' ? source.background : undefined,
    size: 96
  }
}
