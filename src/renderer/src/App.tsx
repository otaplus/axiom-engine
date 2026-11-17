import { AlertTriangle, ChevronUp, Command, Sparkles, Terminal } from 'lucide-react'
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { initAIListeners } from './store/ai'
import { activeScene, projectMetrics, useEditorStore } from './store/editor'
import { useSettingsStore } from './store/settings'
import { serializeProject } from './engine/projectIO'
import { AboutModal } from './components/AboutModal'
import { BottomPanel } from './components/BottomPanel'
import { Copilot } from './components/Copilot'
import { Inspector } from './components/Inspector'
import { ProjectSettingsModal } from './components/ProjectSettingsModal'
import { SceneTree } from './components/SceneTree'
import { ScriptModal } from './components/ScriptModal'
import { SettingsModal } from './components/SettingsModal'
import { ShortcutsModal } from './components/ShortcutsModal'
import { TemplateModal } from './components/TemplateModal'
import { TitleBar } from './components/TitleBar'
import { Viewport } from './components/Viewport'
import { Kbd } from './components/ui'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Axiom UI error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-screen">
          <div className="fatal-card">
            <AlertTriangle size={28} />
            <h1>Algo se rompió en la interfaz</h1>
            <p>{this.state.error.message}</p>
            <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
              Reiniciar Axiom
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const project = useEditorStore((state) => state.project)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const filePath = useEditorStore((state) => state.filePath)
  const dirty = useEditorStore((state) => state.dirty)
  const modal = useEditorStore((state) => state.modal)
  const setModal = useEditorStore((state) => state.setModal)
  const log = useEditorStore((state) => state.log)
  const bottomOpen = useEditorStore((state) => state.bottomOpen)
  const setBottomOpen = useEditorStore((state) => state.setBottomOpen)
  const setBottomTab = useEditorStore((state) => state.setBottomTab)
  const copilotOpen = useEditorStore((state) => state.copilotOpen)
  const setCopilotOpen = useEditorStore((state) => state.setCopilotOpen)
  const settings = useSettingsStore((state) => state.settings)
  const loadSettings = useSettingsStore((state) => state.load)
  const editorFps = useEditorStore((state) => state.editorFps)
  const cameraZoom = useEditorStore((state) => state.camera.zoom)
  const autosaveTimer = useRef<number | null>(null)
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = (tone: 'ok' | 'error', message: string) => {
    setToast({ tone, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }

  const saveProject = async (saveAs = false) => {
    const state = useEditorStore.getState()
    const content = serializeProject(state.project)
    try {
      if (!window.axiom) {
        const blob = new Blob([content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${state.project.name.replace(/[^\w\s-]/g, '').trim() || 'mi-juego'}.axiom`
        anchor.click()
        URL.revokeObjectURL(url)
        showToast('ok', 'Proyecto descargado')
        return
      }
      const result = saveAs
        ? await window.axiom.project.saveAs({ content, suggestedName: state.project.name })
        : await window.axiom.project.save({
            content,
            path: state.filePath ?? undefined,
            suggestedName: state.project.name
          })
      if (result) {
        useEditorStore.getState().markSaved(result.path)
        showToast('ok', 'Proyecto guardado')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log('error', `No se pudo guardar: ${message}`)
      showToast('error', `No se pudo guardar: ${message}`)
    }
  }

  const openProject = async () => {
    try {
      if (!window.axiom) {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.axiom,.json'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return
          useEditorStore.getState().loadProjectContent(await file.text(), file.name)
          showToast('ok', 'Proyecto abierto')
        }
        input.click()
        return
      }
      const result = await window.axiom.project.open()
      if (!result) return
      useEditorStore.getState().loadProjectContent(result.content, result.path)
      showToast('ok', 'Proyecto abierto')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log('error', `No se pudo abrir el proyecto: ${message}`)
      showToast('error', message)
    }
  }

  useEffect(() => {
    void loadSettings()
    const cleanup = initAIListeners()
    return cleanup
  }, [loadSettings])

  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${project.name} — Axiom Engine`
  }, [project.name, dirty])

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (
        state.project === previous.project &&
        state.activeSceneId === previous.activeSceneId &&
        state.camera === previous.camera &&
        state.filePath === previous.filePath
      ) {
        return
      }
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = window.setTimeout(() => {
        try {
          const current = useEditorStore.getState()
          localStorage.setItem(
            'axiom.autosave.v1',
            JSON.stringify({
              project: current.project,
              activeSceneId: current.activeSceneId,
              camera: current.camera,
              filePath: current.filePath
            })
          )
        } catch (error) {
          console.warn('No se pudo autoguardar', error)
        }
      }, 550)
    })
    return () => {
      unsubscribe()
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (mod && key === 's') {
        if (useEditorStore.getState().modal === 'script') return
        event.preventDefault()
        void saveProject(event.shiftKey)
        return
      }
      if (mod && key === 'o') {
        event.preventDefault()
        void openProject()
        return
      }
      if (mod && key === 'n') {
        event.preventDefault()
        setModal('new-project')
        return
      }
      if (typing) return
      const state = useEditorStore.getState()
      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (mod && key === 'y') {
        event.preventDefault()
        state.redo()
        return
      }
      if (mod && key === 'd' && state.selectedNodeId) {
        event.preventDefault()
        state.duplicateNode(state.selectedNodeId)
        return
      }
      if (event.key === 'Delete' && state.selectedNodeId && !mod) {
        event.preventDefault()
        state.deleteNode(state.selectedNodeId)
        return
      }
      if (event.key === 'F5') {
        event.preventDefault()
        if (event.shiftKey) state.stop()
        else if (!state.playing) state.play()
        return
      }
      if (key === 'g' && !mod) {
        state.setShowGrid(!state.showGrid)
        return
      }
      if (key === 'c' && !mod) {
        state.setShowCollision(!state.showCollision)
        return
      }
      if (key === 'escape' && !state.playing && !state.modal) {
        state.selectNode(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // saveProject/openProject close over current state via getState, so stable behavior is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const scene = activeScene(useEditorStore.getState())
  const metrics = projectMetrics(project)
  const currentSettings = settings

  return (
    <div className="app-shell">
        <TitleBar onNew={() => setModal('new-project')} onOpen={() => void openProject()} onSave={(saveAs) => void saveProject(saveAs)} />

        <div className={`workspace ${copilotOpen ? '' : 'copilot-closed'}`}>
          <SceneTree />
          <main className="center-column">
            <Viewport />
            {bottomOpen ? (
              <BottomPanel />
            ) : (
              <button type="button" className="dock-reopen" onClick={() => setBottomOpen(true)}>
                <Terminal size={13} /> Assets · Archivos · Consola <ChevronUp size={13} />
              </button>
            )}
          </main>
          <div className="right-column">
            <Inspector />
            {copilotOpen ? (
              <Copilot />
            ) : (
              <button type="button" className="copilot-reopen" onClick={() => setCopilotOpen(true)}>
                <span className="copilot-avatar small"><Sparkles size={13} /></span>
                <span>
                  <strong>Copiloto IA</strong>
                  <small>Describe tu próximo cambio</small>
                </span>
                <ChevronUp size={14} />
              </button>
            )}
          </div>
        </div>

        <footer className="statusbar">
          <div className="status-left">
            <span className="status-ready"><span className="status-dot" /> LISTO</span>
            <span className="status-sep" />
            <span>{scene?.name ?? 'Escena'}</span>
            <span className="status-sep" />
            <span>{metrics.nodes} nodos</span>
            <span className="status-sep" />
            <span>{metrics.scripts} scripts</span>
            <span className="status-sep" />
            <span>{metrics.scenes} escenas</span>
          </div>
          <div className="status-center">
            <Command size={11} /> <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> guardar · <Kbd>F5</Kbd> jugar
          </div>
          <div className="status-right">
            <span className={`ai-status ${currentSettings?.hasApiKey ? 'is-online' : ''}`}>
              <span className="status-dot" />
              {currentSettings?.hasApiKey ? `${currentSettings.provider} · ${currentSettings.model}` : 'IA sin conectar'}
            </span>
            <span className="status-sep" />
            <span>{editorFps} FPS editor</span>
            <span className="status-sep" />
            <span>{Math.round(cameraZoom * 100)}%</span>
            <span className="status-sep" />
            <span>{filePath ? 'guardado en disco' : 'autoguardado local'}</span>
            <span className="status-sep" />
            <span className="status-version">v0.1.0</span>
          </div>
        </footer>

        {toast ? (
          <div className={`toast ${toast.tone === 'ok' ? 'is-ok' : 'is-error'}`}>
            {toast.tone === 'ok' ? <Sparkles size={14} /> : <AlertTriangle size={14} />}
            {toast.message}
          </div>
        ) : null}

        {modal === 'new-project' ? <TemplateModal /> : null}
        {modal === 'ai-settings' ? <SettingsModal /> : null}
        {modal === 'shortcuts' ? <ShortcutsModal /> : null}
        {modal === 'about' ? <AboutModal /> : null}
        {modal === 'project-settings' ? <ProjectSettingsModal /> : null}
        {modal === 'script' ? <ScriptModal /> : null}
    </div>
  )
}
