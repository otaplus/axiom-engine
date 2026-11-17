import { Maximize2, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GameRuntime } from '../engine/runtime'
import type { Project, Scene } from '../engine/types'
import { useEditorStore } from '../store/editor'
import { IconButton } from './ui'

export function GameView({ project, scene }: { project: Project; scene: Scene }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<GameRuntime | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [fps, setFps] = useState(60)
  const [nodeCount, setNodeCount] = useState(0)
  const [state, setState] = useState<'running' | 'paused' | 'gameover'>('running')
  const paused = useEditorStore((store) => store.paused)
  const setPaused = useEditorStore((store) => store.setPaused)
  const stop = useEditorStore((store) => store.stop)
  const log = useEditorStore((store) => store.log)
  const setRuntimeNodes = useEditorStore((store) => store.setRuntimeNodes)
  const gameWidth = project.settings.width
  const gameHeight = project.settings.height

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      const padding = 28
      const availableWidth = Math.max(200, rect.width - padding)
      const availableHeight = Math.max(140, rect.height - padding)
      const scale = Math.min(availableWidth / gameWidth, availableHeight / gameHeight)
      setStageSize({
        width: Math.max(160, Math.floor(gameWidth * scale)),
        height: Math.max(90, Math.floor(gameHeight * scale))
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [gameWidth, gameHeight])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const runtime = new GameRuntime(canvas, project, scene, {
      onLog: (level, message) => {
        log(level, message)
      },
      onState: (nextState) => {
        setState(nextState)
        setPaused(nextState === 'paused')
      },
      onFps: (value) => setFps(value)
    })
    runtimeRef.current = runtime
    ;(window as any).__AXIOM_GAME__ = runtime
    setNodeCount(runtime.nodes.filter((node) => !node.deleted).length)
    setRuntimeNodes(runtime.nodes.filter((node) => !node.deleted).length)
    setState(runtime.state)
    const focus = () => canvas.focus()
    canvas.addEventListener('pointerdown', focus)
    return () => {
      canvas.removeEventListener('pointerdown', focus)
      runtime.dispose()
      runtimeRef.current = null
      setRuntimeNodes(0)
    }
    // The runtime is a snapshot of the project at play time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime || runtime.state === 'gameover') return
    if (paused && runtime.state === 'running') runtime.pause()
    if (!paused && runtime.state === 'paused') runtime.pause()
    setState(runtime.state)
  }, [paused])

  const togglePause = () => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.pause()
    setPaused(runtime.state === 'paused')
    setState(runtime.state)
  }

  const restart = () => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.restart()
    setPaused(false)
    setState('running')
    setNodeCount(runtime.nodes.filter((node) => !node.deleted).length)
  }

  const fullscreen = () => {
    const element = containerRef.current?.parentElement
    if (!element) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void element.requestFullscreen()
  }

  return (
    <div className="game-stage" ref={containerRef}>
      <div className="game-glow" />
      <div className="game-controls">
        <div className="live-badge">
          <span className={`live-dot ${state === 'gameover' ? 'is-over' : ''}`} />
          {state === 'gameover' ? 'FIN DE PARTIDA' : state === 'paused' ? 'EN PAUSA' : 'EN EJECUCIÓN'}
        </div>
        <div className="game-control-actions">
          <span className="game-stat">{fps} FPS</span>
          <span className="game-stat">{nodeCount} nodos</span>
          <span className="game-stat">{gameWidth}×{gameHeight}</span>
          <IconButton title={state === 'paused' ? 'Reanudar' : 'Pausar'} onClick={togglePause} active={state === 'paused'}>
            {state === 'paused' ? <Play size={14} /> : <Pause size={14} />}
          </IconButton>
          <IconButton title="Reiniciar partida (R)" onClick={restart}>
            <RotateCcw size={14} />
          </IconButton>
          <IconButton title="Pantalla completa" onClick={fullscreen}>
            <Maximize2 size={14} />
          </IconButton>
          <IconButton title="Detener (Shift+F5)" onClick={stop} className="stop-btn">
            <Square size={12} fill="currentColor" />
          </IconButton>
        </div>
      </div>
      <div className="game-canvas-wrap" style={{ width: stageSize.width || undefined, height: stageSize.height || undefined }}>
        <canvas ref={canvasRef} className="game-canvas" tabIndex={0} />
      </div>
      <div className="game-hint">
        <span>{scene.name}</span>
        <span>ESC pausa · R reinicia · Shift+F5 detener</span>
      </div>
    </div>
  )
}
