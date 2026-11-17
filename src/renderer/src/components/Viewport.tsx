import {
  Box,
  Crosshair,
  Grid3X3,
  Hand,
  Magnet,
  Maximize,
  MousePointer2,
  Play,
  RotateCcw,
  Scan,
  Square,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { hitTestHud, pickNode, renderEditor, screenToWorld } from '../engine/editorRenderer'
import { useEditorStore } from '../store/editor'
import { GameView } from './GameView'
import { IconButton } from './ui'

type Tool = 'select' | 'hand'

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const camera = useEditorStore((state) => state.camera)
  const setCamera = useEditorStore((state) => state.setCamera)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const selectNode = useEditorStore((state) => state.selectNode)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const project = useEditorStore((state) => state.project)
  const playing = useEditorStore((state) => state.playing)
  const showGrid = useEditorStore((state) => state.showGrid)
  const showCollision = useEditorStore((state) => state.showCollision)
  const snapToGrid = useEditorStore((state) => state.snapToGrid)
  const setShowGrid = useEditorStore((state) => state.setShowGrid)
  const setShowCollision = useEditorStore((state) => state.setShowCollision)
  const setSnapToGrid = useEditorStore((state) => state.setSnapToGrid)
  const play = useEditorStore((state) => state.play)
  const stop = useEditorStore((state) => state.stop)
  const pushHistory = useEditorStore((state) => state.pushHistory)
  const setNodeTransformLive = useEditorStore((state) => state.setNodeTransformLive)
  const addSpriteFromAsset = useEditorStore((state) => state.addSpriteFromAsset)
  const setModal = useEditorStore((state) => state.setModal)
  const setEditorFps = useEditorStore((state) => state.setEditorFps)
  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId) ?? project.scenes[0]
  const [tool, setTool] = useState<Tool>('select')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const hoverRef = useRef<string | null>(null)
  const interaction = useRef<
    | { mode: 'pan'; startX: number; startY: number; cameraX: number; cameraY: number }
    | {
        mode: 'drag'
        startX: number
        startY: number
        nodeId: string
        startNodeX: number
        startNodeY: number
        moved: boolean
        historyPushed: boolean
      }
    | null
  >(null)
  const spaceRef = useRef(false)
  const lastFitKey = useRef('')
  const frameCounter = useRef(0)
  const fpsStart = useRef(performance.now())

  useEffect(() => {
    hoverRef.current = hoverId
  }, [hoverId])

  useEffect(() => {
    spaceRef.current = spaceHeld
  }, [spaceHeld])

  const fitView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 20 || rect.height < 20) return
    const zoom = Math.max(0.15, Math.min(1.6, Math.min((rect.width - 120) / project.settings.width, (rect.height - 100) / project.settings.height)))
    setCamera({ x: 0, y: 0, zoom })
  }, [project.settings.width, project.settings.height, setCamera])

  useEffect(() => {
    const key = `${activeSceneId}:${project.settings.width}x${project.settings.height}`
    if (lastFitKey.current === key) return
    lastFitKey.current = key
    const timer = window.setTimeout(fitView, 30)
    return () => window.clearTimeout(timer)
  }, [activeSceneId, project.settings.width, project.settings.height, fitView])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault()
        setSpaceHeld(true)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const state = useEditorStore.getState()
      const rect = canvas.getBoundingClientRect()
      const localX = event.clientX - rect.left - rect.width / 2
      const localY = event.clientY - rect.top - rect.height / 2
      const beforeX = state.camera.x + localX / state.camera.zoom
      const beforeY = state.camera.y + localY / state.camera.zoom
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
      const zoom = Math.max(0.12, Math.min(5, state.camera.zoom * factor))
      state.setCamera({
        zoom,
        x: beforeX - localX / zoom,
        y: beforeY - localY / zoom
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const state = useEditorStore.getState()
        if (!state.playing) {
          const scene = state.project.scenes.find((item) => item.id === state.activeSceneId) ?? state.project.scenes[0]
          renderEditor(canvas, state.project, scene, {
            selectedId: state.selectedNodeId,
            hoverId: hoverRef.current,
            showGrid: state.showGrid,
            showCollision: state.showCollision,
            camera: state.camera
          })
          frameCounter.current += 1
          const now = performance.now()
          if (now - fpsStart.current > 600) {
            state.setEditorFps(Math.round((frameCounter.current * 1000) / (now - fpsStart.current)))
            frameCounter.current = 0
            fpsStart.current = now
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const localPoint = (event: React.PointerEvent | React.MouseEvent | React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0, width: 1, height: 1 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(event.pointerId)
    const state = useEditorStore.getState()
    const local = localPoint(event)
    const world = screenToWorld(canvas, state.camera, event.clientX, event.clientY)

    if (event.button === 1 || tool === 'hand' || spaceRef.current) {
      interaction.current = {
        mode: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        cameraX: state.camera.x,
        cameraY: state.camera.y
      }
      setIsPanning(true)
      return
    }

    const hudNode = hitTestHud(activeScene, project, state.camera, local.x, local.y, local.width, local.height)
    const node = hudNode ?? pickNode(activeScene, world.x, world.y)
    if (!node) {
      state.selectNode(null)
      return
    }
    state.selectNode(node.id)
    interaction.current = {
      mode: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      nodeId: node.id,
      startNodeX: node.x,
      startNodeY: node.y,
      moved: false,
      historyPushed: false
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const state = useEditorStore.getState()
    const local = localPoint(event)
    const world = screenToWorld(canvas, state.camera, event.clientX, event.clientY)
    setCursor({ x: Math.round(world.x), y: Math.round(world.y) })

    const mode = interaction.current
    if (mode?.mode === 'pan') {
      const dx = (event.clientX - mode.startX) / state.camera.zoom
      const dy = (event.clientY - mode.startY) / state.camera.zoom
      state.setCamera({ x: mode.cameraX - dx, y: mode.cameraY - dy })
      return
    }
    if (mode?.mode === 'drag') {
      const dx = (event.clientX - mode.startX) / state.camera.zoom
      const dy = (event.clientY - mode.startY) / state.camera.zoom
      if (!mode.moved && Math.hypot(dx, dy) < 2 / state.camera.zoom) return
      if (!mode.moved) {
        mode.moved = true
        mode.historyPushed = true
        state.pushHistory()
      }
      let nextX = mode.startNodeX + dx
      let nextY = mode.startNodeY + dy
      if (state.snapToGrid) {
        nextX = Math.round(nextX / 8) * 8
        nextY = Math.round(nextY / 8) * 8
      }
      state.setNodeTransformLive(mode.nodeId, { x: Math.round(nextX * 100) / 100, y: Math.round(nextY * 100) / 100 })
      return
    }
    if (state.playing) return
    const hudNode = hitTestHud(activeScene, project, state.camera, local.x, local.y, local.width, local.height)
    const node = hudNode ?? pickNode(activeScene, world.x, world.y)
    if (node?.id !== hoverRef.current) {
      hoverRef.current = node?.id ?? null
      setHoverId(node?.id ?? null)
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    const mode = interaction.current
    if (mode?.mode === 'drag' && mode.moved) {
      useEditorStore.getState().log('info', 'Nodo movido')
    }
    interaction.current = null
    setIsPanning(false)
    setIsDragging(false)
  }

  const zoomBy = (factor: number) => {
    setCamera({ zoom: Math.max(0.12, Math.min(5, camera.zoom * factor)) })
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDropActive(false)
    const assetId = event.dataTransfer.getData('application/x-axiom-asset')
    const canvas = canvasRef.current
    if (!assetId || !canvas) return
    const world = screenToWorld(canvas, camera, event.clientX, event.clientY)
    addSpriteFromAsset(assetId, Math.round(world.x), Math.round(world.y))
  }

  return (
    <section className="viewport">
      <div className="viewport-toolbar">
        <div className="mode-tabs">
          <button type="button" className="mode-tab is-active">
            <Box size={13} /> 2D
          </button>
          <button type="button" className="mode-tab" disabled title="El modo 3D llegará en una próxima versión">
            3D <span>pronto</span>
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="tool-group">
          <IconButton title="Seleccionar y mover (V)" active={tool === 'select'} onClick={() => setTool('select')}>
            <MousePointer2 size={15} />
          </IconButton>
          <IconButton title="Mover vista (H / Espacio)" active={tool === 'hand'} onClick={() => setTool('hand')}>
            <Hand size={15} />
          </IconButton>
        </div>
        <div className="toolbar-divider" />
        <div className="tool-group">
          <IconButton title="Cuadrícula (G)" active={showGrid} onClick={() => setShowGrid(!showGrid)}>
            <Grid3X3 size={15} />
          </IconButton>
          <IconButton title="Ajustar a cuadrícula" active={snapToGrid} onClick={() => setSnapToGrid(!snapToGrid)}>
            <Magnet size={15} />
          </IconButton>
          <IconButton title="Mostrar colisiones (C)" active={showCollision} onClick={() => setShowCollision(!showCollision)}>
            <Scan size={15} />
          </IconButton>
        </div>
        <div className="toolbar-spacer" />
        <span className="coordinate-readout">
          {cursor.x}, {cursor.y}
        </span>
        <div className="tool-group zoom-group">
          <IconButton title="Alejar" onClick={() => zoomBy(1 / 1.15)}>
            <ZoomOut size={15} />
          </IconButton>
          <button type="button" className="zoom-value" onClick={() => setCamera({ zoom: 1 })} title="Restablecer zoom al 100%">
            {Math.round(camera.zoom * 100)}%
          </button>
          <IconButton title="Acercar" onClick={() => zoomBy(1.15)}>
            <ZoomIn size={15} />
          </IconButton>
          <IconButton title="Centrar y ajustar escena" onClick={fitView}>
            <Maximize size={14} />
          </IconButton>
        </div>
        <div className="toolbar-divider" />
        <button type="button" className="run-button" onClick={playing ? stop : play} title="Reproducir escena (F5)">
          {playing ? <Square size={12} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
          {playing ? 'Detener' : 'Jugar'}
        </button>
      </div>

      <div
        className={`viewport-area ${isPanning ? 'is-panning' : ''} ${isDragging ? 'is-dragging' : ''} ${dropActive ? 'is-drop-active' : ''}`}
        ref={areaRef}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('application/x-axiom-asset')) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
            setDropActive(true)
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          className={`editor-canvas ${tool === 'hand' || spaceHeld ? 'cursor-hand' : ''}`}
          style={{ display: playing ? 'none' : 'block' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            if (!interaction.current) {
              hoverRef.current = null
              setHoverId(null)
            }
          }}
          onDoubleClick={(event) => {
            const canvas = canvasRef.current
            if (!canvas) return
            const state = useEditorStore.getState()
            const world = screenToWorld(canvas, state.camera, event.clientX, event.clientY)
            const node = pickNode(activeScene, world.x, world.y)
            if (node?.script) setModal('script', node.id)
          }}
        />
        {!playing ? <div className="viewport-corner-hint">{hoverId ? activeScene.root ? findHoverName(activeScene.root, hoverId) : '' : 'Doble clic en un script para editarlo'}</div> : null}
        {dropActive ? (
          <div className="drop-overlay">
            <SparklesIcon />
            <strong>Suelta el asset en la escena</strong>
            <span>Se creará un Sprite 2D en esa posición</span>
          </div>
        ) : null}
        {playing ? <GameView project={project} scene={activeScene} /> : null}
      </div>
    </section>
  )
}

function findHoverName(root: any, id: string): string {
  if (root.id === id) return root.name
  for (const child of root.children) {
    const found = findHoverName(child, id)
    if (found) return found
  }
  return ''
}

function SparklesIcon() {
  return (
    <span className="drop-icon">
      <ZapGlyph />
    </span>
  )
}

function ZapGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z" />
    </svg>
  )
}
