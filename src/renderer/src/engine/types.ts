export type NodeType =
  | 'Node2D'
  | 'Sprite2D'
  | 'CharacterBody2D'
  | 'StaticBody2D'
  | 'Area2D'
  | 'Camera2D'
  | 'Label2D'
  | 'Timer'
  | 'AudioPlayer'
  | 'Particles2D'
  | 'CanvasLayer'

export type NodeProps = Record<string, any>

export interface SceneNode {
  id: string
  name: string
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
  children: SceneNode[]
  script?: string
}

export interface SceneSettings {
  background?: string
  style?: 'gradient' | 'solid' | 'stars' | 'grid'
}

export interface Scene {
  id: string
  name: string
  root: SceneNode
  settings: SceneSettings
}

export interface ProjectSettings {
  width: number
  height: number
  gravity: number
  background: string
  backgroundStyle: 'gradient' | 'solid' | 'stars' | 'grid'
  accent: string
  pixelArt: boolean
  showFps: boolean
}

export type Asset =
  | {
      id: string
      name: string
      kind: 'emoji'
      glyph: string
      background?: string
      size?: number
    }
  | {
      id: string
      name: string
      kind: 'shape'
      shape: 'rect' | 'circle' | 'triangle' | 'star' | 'hexagon' | 'diamond'
      color: string
      color2?: string
      size?: number
    }
  | {
      id: string
      name: string
      kind: 'vector'
      variant: 'coin' | 'heart' | 'gem' | 'star' | 'key' | 'slime'
      color?: string
      color2?: string
      size?: number
    }
  | {
      id: string
      name: string
      kind: 'image'
      dataUrl: string
      width: number
      height: number
    }

export interface Project {
  format: 'axiom-project'
  version: 1
  name: string
  settings: ProjectSettings
  assets: Asset[]
  scenes: Scene[]
  mainSceneId: string
  createdAt: string
  updatedAt: string
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  id: string
  level: LogLevel
  message: string
  time: number
}

export const NODE_DEFAULTS: Record<NodeType, NodeProps> = {
  Node2D: {},
  Sprite2D: {
    assetId: 'hero',
    width: 64,
    height: 64,
    tint: '#ffffff',
    opacity: 1,
    flipX: false,
    flipY: false
  },
  CharacterBody2D: {
    width: 36,
    height: 52,
    color: '#4ade80',
    bodyVisual: 'capsule',
    group: 'player'
  },
  StaticBody2D: {
    width: 240,
    height: 28,
    color: '#273244',
    edgeColor: '#38bdf8',
    oneWay: false
  },
  Area2D: {
    width: 36,
    height: 36,
    group: 'area',
    debug: false
  },
  Camera2D: {
    active: true,
    zoom: 1,
    smoothing: 6,
    target: '',
    offsetX: 0,
    offsetY: 0
  },
  Label2D: {
    text: 'Texto',
    bind: '',
    prefix: '',
    suffix: '',
    width: 220,
    height: 32,
    fontSize: 24,
    color: '#f8fafc',
    fontWeight: 700,
    align: 'left',
    shadow: true
  },
  Timer: {
    waitTime: 1,
    autostart: false,
    oneShot: true
  },
  AudioPlayer: {
    sound: 'coin',
    volume: 0.5,
    autoplay: false
  },
  Particles2D: {
    color: '#38bdf8',
    amount: 18,
    size: 4,
    lifetime: 0.9,
    speed: 90,
    spread: 360,
    gravity: 0,
    emitting: true
  },
  CanvasLayer: {}
}

export const NODE_ICON_HINT: Record<NodeType, string> = {
  Node2D: 'group',
  Sprite2D: 'image',
  CharacterBody2D: 'person',
  StaticBody2D: 'platform',
  Area2D: 'zone',
  Camera2D: 'camera',
  Label2D: 'text',
  Timer: 'timer',
  AudioPlayer: 'audio',
  Particles2D: 'sparkles',
  CanvasLayer: 'layers'
}

export const NODE_COLORS: Record<NodeType, string> = {
  Node2D: '#94a3b8',
  Sprite2D: '#38bdf8',
  CharacterBody2D: '#4ade80',
  StaticBody2D: '#f59e0b',
  Area2D: '#a78bfa',
  Camera2D: '#fb7185',
  Label2D: '#f8fafc',
  Timer: '#22d3ee',
  AudioPlayer: '#f472b6',
  Particles2D: '#facc15',
  CanvasLayer: '#818cf8'
}
