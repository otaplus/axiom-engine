import { create } from 'zustand'
import { applyActions } from '../engine/actions'
import { cloneNode, createNode, createScene, findNode, findParent, removeNode, uniqueName, uid } from '../engine/project'
import { normalizeProject, parseProject, projectStats } from '../engine/projectIO'
import type { Asset, NodeProps, NodeType, Project, ProjectSettings, Scene, SceneNode } from '../engine/types'
import { createTemplate, type TemplateId } from '../templates'

export type ModalKind =
  | 'new-project'
  | 'ai-settings'
  | 'shortcuts'
  | 'about'
  | 'script'
  | 'project-settings'
  | 'updates'
  | null
export type BottomTab = 'assets' | 'files' | 'console'

interface Snapshot {
  project: Project
  activeSceneId: string
  selectedNodeId: string | null
}

export interface LogItem {
  id: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  time: number
}

interface CameraState {
  x: number
  y: number
  zoom: number
}

interface EditorState {
  project: Project
  activeSceneId: string
  selectedNodeId: string | null
  expanded: Record<string, boolean>
  filePath: string | null
  dirty: boolean
  past: Snapshot[]
  future: Snapshot[]
  logs: LogItem[]
  camera: CameraState
  showGrid: boolean
  showCollision: boolean
  snapToGrid: boolean
  bottomTab: BottomTab
  bottomOpen: boolean
  copilotOpen: boolean
  modal: ModalKind
  scriptNodeId: string | null
  playing: boolean
  paused: boolean
  runtimeNodes: number
  editorFps: number
  selectedSceneId: string
  setCamera: (camera: Partial<CameraState>) => void
  setEditorFps: (fps: number) => void
  setShowGrid: (value: boolean) => void
  setShowCollision: (value: boolean) => void
  setSnapToGrid: (value: boolean) => void
  setBottomTab: (tab: BottomTab) => void
  setBottomOpen: (open: boolean) => void
  setCopilotOpen: (open: boolean) => void
  setModal: (modal: ModalKind, scriptNodeId?: string | null) => void
  selectNode: (id: string | null) => void
  toggleExpanded: (id: string) => void
  expandNode: (id: string) => void
  setActiveScene: (id: string) => void
  addScene: () => string
  deleteScene: (id: string) => void
  setMainScene: (id: string) => void
  setSceneSettings: (patch: Partial<Scene['settings']>) => void
  addNode: (type: NodeType, parentId?: string) => string
  addSpriteFromAsset: (assetId: string, x: number, y: number) => void
  addImageAsset: (dataUrl: string, width: number, height: number, name: string) => void
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  renameNode: (id: string, name: string) => void
  toggleNodeVisibility: (id: string) => void
  reparentNode: (id: string, parentId: string) => void
  patchNode: (id: string, patch: Partial<SceneNode> & { props?: NodeProps }, recordHistory?: boolean) => void
  setNodeTransformLive: (id: string, patch: { x?: number; y?: number }) => void
  setNodeProp: (id: string, key: string, value: any) => void
  setNodeScript: (id: string, code: string | undefined) => void
  setProjectName: (name: string) => void
  setProjectSettings: (patch: Partial<ProjectSettings>) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  log: (level: LogItem['level'], message: string) => void
  clearLogs: () => void
  play: () => void
  stop: () => void
  setPaused: (paused: boolean) => void
  newProject: (templateId: TemplateId) => void
  loadProjectContent: (content: string, path: string) => void
  markSaved: (path: string) => void
  applyAIActions: (actions: unknown[]) => { descriptions: string[]; errors: string[] }
  setRuntimeNodes: (count: number) => void
}

const AUTOSAVE_KEY = 'axiom.autosave.v1'

function loadInitial(): { project: Project; activeSceneId: string; camera: CameraState; filePath: string | null } {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const project = normalizeProject(parsed.project)
      const sceneId = project.scenes.some((scene) => scene.id === parsed.activeSceneId)
        ? parsed.activeSceneId
        : project.mainSceneId
      const camera = parsed.camera ?? { x: 0, y: 0, zoom: 1 }
      return { project, activeSceneId: sceneId, camera, filePath: parsed.filePath ?? null }
    }
  } catch {
    // A corrupt autosave should never block startup.
  }
  const project = createTemplate('platformer')
  return {
    project,
    activeSceneId: project.mainSceneId,
    camera: { x: 0, y: 0, zoom: 1 },
    filePath: null
  }
}

function findNodeById(scene: Scene, id: string | null): SceneNode | null {
  if (!id) return null
  const visit = (node: SceneNode): SceneNode | null => {
    if (node.id === id) return node
    for (const child of node.children) {
      const found = visit(child)
      if (found) return found
    }
    return null
  }
  return visit(scene.root)
}

function findNodeAcrossProject(project: Project, id: string): { scene: Scene; node: SceneNode } | null {
  for (const scene of project.scenes) {
    const node = findNodeById(scene, id)
    if (node) return { scene, node }
  }
  return null
}

function defaultNameForType(type: NodeType): string {
  const names: Record<NodeType, string> = {
    Node2D: 'Grupo',
    Sprite2D: 'Sprite',
    CharacterBody2D: 'Personaje',
    StaticBody2D: 'Sólido',
    Area2D: 'Área',
    Camera2D: 'Cámara',
    Label2D: 'Etiqueta',
    Timer: 'Temporizador',
    AudioPlayer: 'Sonido',
    Particles2D: 'Partículas',
    CanvasLayer: 'Interfaz'
  }
  return names[type]
}

function snapshotOf(state: EditorState): Snapshot {
  return {
    project: structuredClone(state.project),
    activeSceneId: state.activeSceneId,
    selectedNodeId: state.selectedNodeId
  }
}

function withHistory(state: EditorState): Partial<EditorState> {
  return {
    past: [...state.past, snapshotOf(state)].slice(-60),
    future: []
  }
}

function activeSceneOf(state: EditorState): Scene {
  return state.project.scenes.find((scene) => scene.id === state.activeSceneId) ?? state.project.scenes[0]
}

const initial = loadInitial()
const initialScene = initial.project.scenes.find((scene) => scene.id === initial.activeSceneId) ?? initial.project.scenes[0]

export const useEditorStore = create<EditorState>()((set, get) => ({
  project: initial.project,
  activeSceneId: initialScene.id,
  selectedNodeId: initialScene.root.id,
  expanded: {},
  filePath: initial.filePath,
  dirty: !initial.filePath,
  past: [],
  future: [],
  logs: [
    {
      id: uid('log'),
      level: 'success',
      message: 'Axiom Engine listo. Abre el Copiloto y describe tu próximo juego.',
      time: Date.now()
    }
  ],
  camera: initial.camera,
  showGrid: true,
  showCollision: false,
  snapToGrid: true,
  bottomTab: 'assets',
  bottomOpen: true,
  copilotOpen: true,
  modal: null,
  scriptNodeId: null,
  playing: false,
  paused: false,
  runtimeNodes: 0,
  editorFps: 60,
  selectedSceneId: initialScene.id,

  setCamera: (camera) => set((state) => ({ camera: { ...state.camera, ...camera } })),
  setEditorFps: (fps) => set({ editorFps: fps }),
  setShowGrid: (value) => set({ showGrid: value }),
  setShowCollision: (value) => set({ showCollision: value }),
  setSnapToGrid: (value) => set({ snapToGrid: value }),
  setBottomTab: (tab) => set({ bottomTab: tab, bottomOpen: true }),
  setBottomOpen: (open) => set({ bottomOpen: open }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  setModal: (modal, scriptNodeId = null) => set({ modal, scriptNodeId }),

  selectNode: (id) => {
    const state = get()
    if (!id) {
      set({ selectedNodeId: null })
      return
    }
    const scene = activeSceneOf(state)
    if (findNodeById(scene, id)) {
      const path: string[] = []
      const collect = (node: SceneNode): boolean => {
        if (node.id === id) return true
        for (const child of node.children) {
          path.push(node.id)
          if (collect(child)) return true
          path.pop()
        }
        return false
      }
      collect(scene.root)
      const expanded = { ...state.expanded }
      path.forEach((nodeId) => (expanded[nodeId] = true))
      set({ selectedNodeId: id, expanded })
    }
  },
  toggleExpanded: (id) =>
    set((state) => ({ expanded: { ...state.expanded, [id]: !(state.expanded[id] ?? true) } })),
  expandNode: (id) => set((state) => ({ expanded: { ...state.expanded, [id]: true } })),

  setActiveScene: (id) => {
    const state = get()
    const scene = state.project.scenes.find((item) => item.id === id)
    if (!scene) return
    set({ activeSceneId: id, selectedSceneId: id, selectedNodeId: scene.root.id })
  },

  addScene: () => {
    const state = get()
    const next = structuredClone(state.project)
    const scene = createScene(`Escena ${next.scenes.length + 1}`)
    next.scenes.push(scene)
    next.updatedAt = new Date().toISOString()
    set({
      ...withHistory(state),
      project: next,
      activeSceneId: scene.id,
      selectedSceneId: scene.id,
      selectedNodeId: scene.root.id,
      dirty: true
    })
    get().log('success', `Escena «${scene.name}» creada`)
    return scene.id
  },

  deleteScene: (id) => {
    const state = get()
    if (state.project.scenes.length <= 1) {
      get().log('warn', 'No puedes eliminar la última escena.')
      return
    }
    const next = structuredClone(state.project)
    const target = next.scenes.find((scene) => scene.id === id)
    if (!target) return
    next.scenes = next.scenes.filter((scene) => scene.id !== id)
    if (next.mainSceneId === id) next.mainSceneId = next.scenes[0].id
    const activeSceneId = state.activeSceneId === id ? next.mainSceneId : state.activeSceneId
    next.updatedAt = new Date().toISOString()
    set({
      ...withHistory(state),
      project: next,
      activeSceneId,
      selectedSceneId: activeSceneId,
      selectedNodeId: null,
      dirty: true
    })
    get().log('warn', `Escena «${target.name}» eliminada`)
  },

  setMainScene: (id) => {
    const state = get()
    const next = structuredClone(state.project)
    if (!next.scenes.some((scene) => scene.id === id)) return
    next.mainSceneId = id
    next.updatedAt = new Date().toISOString()
    set({ ...withHistory(state), project: next, dirty: true })
    get().log('info', 'Escena principal actualizada')
  },

  setSceneSettings: (patch) => {
    const state = get()
    const next = structuredClone(state.project)
    const scene = next.scenes.find((item) => item.id === state.activeSceneId)
    if (!scene) return
    scene.settings = { ...scene.settings, ...patch }
    next.updatedAt = new Date().toISOString()
    set({ ...withHistory(state), project: next, dirty: true })
  },

  addNode: (type, parentId) => {
    const state = get()
    const scene = activeSceneOf(state)
    const parent = (parentId ? findNodeById(scene, parentId) : null) ?? findNodeById(scene, state.selectedNodeId) ?? scene.root
    const next = structuredClone(state.project)
    const nextScene = next.scenes.find((item) => item.id === state.activeSceneId)!
    const nextParent = findNodeById(nextScene, parent.id) ?? nextScene.root
    const node = createNode(type, uniqueName(nextParent, defaultNameForType(type)))
    nextParent.children.push(node)
    next.updatedAt = new Date().toISOString()
    set({
      ...withHistory(state),
      project: next,
      selectedNodeId: node.id,
      expanded: { ...state.expanded, [nextParent.id]: true },
      dirty: true
    })
    get().log('info', `Nodo «${node.name}» añadido`)
    return node.id
  },

  addSpriteFromAsset: (assetId, x, y) => {
    const state = get()
    const scene = activeSceneOf(state)
    const asset = state.project.assets.find((item) => item.id === assetId)
    if (!asset) return
    const next = structuredClone(state.project)
    const nextScene = next.scenes.find((item) => item.id === state.activeSceneId)!
    const size = asset.kind === 'image' ? Math.min(140, asset.width) : 64
    const node = createNode('Sprite2D', uniqueName(nextScene.root, asset.name || 'Sprite'), {
      x,
      y,
      zIndex: 1,
      props: {
        assetId: asset.id,
        width: size,
        height: size,
        opacity: 1,
        shadow: true
      }
    })
    nextScene.root.children.push(node)
    next.updatedAt = new Date().toISOString()
    set({ ...withHistory(state), project: next, selectedNodeId: node.id, dirty: true })
    get().log('info', `Asset «${asset.name}» colocado en la escena`)
  },

  addImageAsset: (dataUrl, width, height, name) => {
    const state = get()
    const next = structuredClone(state.project)
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid('image')
    while (next.assets.some((asset) => asset.id === id)) id = `${id}_2`
    const asset: Asset = { id, name, kind: 'image', dataUrl, width, height }
    next.assets.push(asset)
    next.updatedAt = new Date().toISOString()
    set({ ...withHistory(state), project: next, dirty: true })
    get().log('success', `Imagen «${name}» importada`)
  },

  deleteNode: (id) => {
    const state = get()
    const scene = activeSceneOf(state)
    const node = findNodeById(scene, id)
    if (!node) return
    if (node === scene.root) {
      get().log('warn', 'No puedes eliminar el nodo raíz.')
      return
    }
    const next = structuredClone(state.project)
    const nextScene = next.scenes.find((item) => item.id === state.activeSceneId)!
    const target = findNodeById(nextScene, id)
    if (!target) return
    const parent = findParent(nextScene.root, target)
    removeNode(nextScene.root, target)
    next.updatedAt = new Date().toISOString()
    set({
      ...withHistory(state),
      project: next,
      selectedNodeId: parent?.id ?? nextScene.root.id,
      dirty: true
    })
    get().log('info', `Nodo «${node.name}» eliminado`)
  },

  duplicateNode: (id) => {
    const state = get()
    const scene = activeSceneOf(state)
    const node = findNodeById(scene, id)
    if (!node) return
    const parent = findParent(scene.root, node)
    if (!parent) return
    const next = structuredClone(state.project)
    const nextScene = next.scenes.find((item) => item.id === state.activeSceneId)!
    const nextTarget = findNodeById(nextScene, id)
    if (!nextTarget) return
    const nextParent = findParent(nextScene.root, nextTarget) ?? nextScene.root
    const copy = cloneNode(nextTarget, true)
    copy.name = uniqueName(nextParent, `${nextTarget.name} copia`)
    nextParent.children.push(copy)
    next.updatedAt = new Date().toISOString()
    set({ ...withHistory(state), project: next, selectedNodeId: copy.id, dirty: true })
    get().log('info', `Nodo «${node.name}» duplicado`)
  },

  renameNode: (id, name) => {
    const state = get()
    const scene = activeSceneOf(state)
    const node = findNodeById(scene, id)
    if (!node) return
    const parent = findParent(scene.root, node)
    const finalName = parent ? uniqueName(parent, name) : name
    get().patchNode(id, { name: finalName })
  },

  toggleNodeVisibility: (id) => {
    const state = get()
    const scene = activeSceneOf(state)
    const node = findNodeById(scene, id)
    if (!node) return
    get().patchNode(id, { visible: !node.visible })
  },

  reparentNode: (id, parentId) => {
    const state = get()
    const scene = activeSceneOf(state)
    const node = findNodeById(scene, id)
    const parent = findNodeById(scene, parentId)
    if (!node || !parent) return
    if (node === scene.root) return
    if (findNodeById({ ...scene, root: node } as Scene, parentId)) {
      get().log('warn', 'No puedes mover un nodo dentro de sí mismo.')
      return
    }
    if (findParent(scene.root, node)?.id === parent.id) return
    const next = structuredClone(state.project)
    const nextScene = next.scenes.find((item) => item.id === state.activeSceneId)!
    const nextNode = findNodeById(nextScene, id)
    const nextParent = findNodeById(nextScene, parentId)
    if (!nextNode || !nextParent) return
    removeNode(nextScene.root, nextNode)
    nextNode.name = uniqueName(nextParent, nextNode.name)
    nextParent.children.push(nextNode)
    next.updatedAt = new Date().toISOString()
    set({
      ...withHistory(state),
      project: next,
      expanded: { ...state.expanded, [parentId]: true },
      dirty: true
    })
  },

  patchNode: (id, patch, recordHistory = true) => {
    const state = get()
    const scene = activeSceneOf(state)
    const node = findNodeById(scene, id)
    if (!node) return
    const next = structuredClone(state.project)
    const nextScene = next.scenes.find((item) => item.id === state.activeSceneId)!
    const target = findNodeById(nextScene, id)
    if (!target) return
    const parent = findParent(nextScene.root, target)
    if (patch.name !== undefined) {
      const desired = String(patch.name).trim() || target.name
      target.name = parent ? uniqueName(parent, desired) : desired
    }
    for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'zIndex'] as const) {
      if (patch[key] !== undefined) target[key] = Number(patch[key])
    }
    if (patch.visible !== undefined) target.visible = Boolean(patch.visible)
    if (patch.template !== undefined) target.template = Boolean(patch.template)
    if (patch.script !== undefined) {
      if (patch.script) target.script = patch.script
      else delete target.script
    }
    if (patch.props) {
      target.props = { ...target.props, ...patch.props }
    }
    next.updatedAt = new Date().toISOString()
    set({
      ...(recordHistory ? withHistory(state) : {}),
      project: next,
      dirty: true
    })
  },

  setNodeTransformLive: (id, patch) => {
    const state = get()
    const next = structuredClone(state.project)
    const scene = next.scenes.find((item) => item.id === state.activeSceneId)
    if (!scene) return
    const node = findNodeById(scene, id)
    if (!node) return
    if (patch.x !== undefined) node.x = patch.x
    if (patch.y !== undefined) node.y = patch.y
    set({ project: next, dirty: true })
  },

  setNodeProp: (id, key, value) => {
    get().patchNode(id, { props: { [key]: value } })
  },

  setNodeScript: (id, code) => {
    get().patchNode(id, { script: code })
    const state = get()
    const scene = activeSceneOf(state)
    const node = findNodeById(scene, id)
    get().log('success', code ? `Script guardado en «${node?.name ?? 'nodo'}»` : 'Script eliminado')
  },

  setProjectName: (name) => {
    const state = get()
    const next = structuredClone(state.project)
    next.name = name.trim() || 'Proyecto sin título'
    next.updatedAt = new Date().toISOString()
    set({ ...withHistory(state), project: next, dirty: true })
  },

  setProjectSettings: (patch) => {
    const state = get()
    const next = structuredClone(state.project)
    next.settings = { ...next.settings, ...patch }
    next.updatedAt = new Date().toISOString()
    set({ ...withHistory(state), project: next, dirty: true })
  },

  pushHistory: () => {
    const state = get()
    set({ ...withHistory(state), dirty: true })
  },

  undo: () => {
    const state = get()
    if (!state.past.length) return
    const previous = state.past[state.past.length - 1]
    const current = snapshotOf(state)
    const scene = previous.project.scenes.find((item) => item.id === previous.activeSceneId) ?? previous.project.scenes[0]
    const selected = findNodeById(scene, previous.selectedNodeId)
    set({
      project: previous.project,
      activeSceneId: scene.id,
      selectedSceneId: scene.id,
      selectedNodeId: selected ? previous.selectedNodeId : scene.root.id,
      past: state.past.slice(0, -1),
      future: [current, ...state.future].slice(0, 60),
      dirty: true
    })
    get().log('info', 'Deshacer')
  },

  redo: () => {
    const state = get()
    if (!state.future.length) return
    const next = state.future[0]
    const current = snapshotOf(state)
    const scene = next.project.scenes.find((item) => item.id === next.activeSceneId) ?? next.project.scenes[0]
    const selected = findNodeById(scene, next.selectedNodeId)
    set({
      project: next.project,
      activeSceneId: scene.id,
      selectedSceneId: scene.id,
      selectedNodeId: selected ? next.selectedNodeId : scene.root.id,
      past: [...state.past, current].slice(-60),
      future: state.future.slice(1),
      dirty: true
    })
    get().log('info', 'Rehacer')
  },

  log: (level, message) =>
    set((state) => ({
      logs: [...state.logs, { id: uid('log'), level, message, time: Date.now() }].slice(-300)
    })),
  clearLogs: () => set({ logs: [] }),

  play: () => {
    set({ playing: true, paused: false })
    get().log('success', 'Reproduciendo escena')
  },
  stop: () => set({ playing: false, paused: false }),
  setPaused: (paused) => set({ paused }),

  newProject: (templateId) => {
    const project = createTemplate(templateId)
    const scene = project.scenes.find((item) => item.id === project.mainSceneId) ?? project.scenes[0]
    set({
      project,
      activeSceneId: scene.id,
      selectedSceneId: scene.id,
      selectedNodeId: scene.root.id,
      expanded: {},
      filePath: null,
      dirty: true,
      past: [],
      future: [],
      logs: [
        {
          id: uid('log'),
          level: 'success',
          message: `Plantilla «${project.name}» cargada.`,
          time: Date.now()
        }
      ],
      camera: { x: 0, y: 0, zoom: 1 },
      modal: null,
      playing: false,
      paused: false
    })
  },

  loadProjectContent: (content, path) => {
    const project = parseProject(content)
    const scene = project.scenes.find((item) => item.id === project.mainSceneId) ?? project.scenes[0]
    set({
      project,
      activeSceneId: scene.id,
      selectedSceneId: scene.id,
      selectedNodeId: scene.root.id,
      expanded: {},
      filePath: path,
      dirty: false,
      past: [],
      future: [],
      modal: null,
      camera: { x: 0, y: 0, zoom: 1 },
      logs: [
        {
          id: uid('log'),
          level: 'success',
          message: `Proyecto «${project.name}» abierto desde ${path}`,
          time: Date.now()
        }
      ]
    })
  },

  markSaved: (path) => {
    set({ filePath: path, dirty: false })
    get().log('success', 'Proyecto guardado')
  },

  applyAIActions: (actions) => {
    const state = get()
    if (state.playing) set({ playing: false, paused: false })
    const result = applyActions(state.project, actions, state.activeSceneId)
    if (!result.descriptions.length && result.errors.length) {
      result.errors.forEach((error) => get().log('error', error))
      return { descriptions: [], errors: result.errors }
    }
    const scene = result.project.scenes.find((item) => item.id === result.activeSceneId) ?? result.project.scenes[0]
    const selected = findNodeById(scene, state.selectedNodeId)
    set({
      ...withHistory(state),
      project: result.project,
      activeSceneId: scene.id,
      selectedSceneId: scene.id,
      selectedNodeId: selected ? selected.id : scene.root.id,
      dirty: true
    })
    result.descriptions.forEach((description) => get().log('success', description))
    result.errors.forEach((error) => get().log('error', error))
    return { descriptions: result.descriptions, errors: result.errors }
  },

  setRuntimeNodes: (count) => set({ runtimeNodes: count })
}))

export function activeScene(state: EditorState): Scene {
  return state.project.scenes.find((scene) => scene.id === state.activeSceneId) ?? state.project.scenes[0]
}

export function selectedNode(state: EditorState): SceneNode | null {
  const scene = activeScene(state)
  return findNodeById(scene, state.selectedNodeId)
}

export function projectMetrics(project: Project): { nodes: number; scripts: number; scenes: number } {
  return projectStats(project)
}

export function getNodePath(scene: Scene, id: string): string {
  const node = findNodeById(scene, id)
  if (!node) return ''
  const path: string[] = []
  const visit = (current: SceneNode): boolean => {
    if (current.id === id) {
      path.push(current.name)
      return true
    }
    for (const child of current.children) {
      if (visit(child)) {
        path.unshift(current.name)
        return true
      }
    }
    return false
  }
  visit(scene.root)
  return path.join('/')
}
