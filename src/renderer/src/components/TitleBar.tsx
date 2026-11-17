import {
  ArrowDownToLine,
  Bot,
  ChevronDown,
  Circle,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Maximize2,
  Minus,
  Pause,
  Play,
  Save,
  Settings2,
  Sparkles,
  Square,
  Undo2,
  Redo2,
  X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editor'
import { useUpdateStore } from '../store/update'
import { IconButton } from './ui'

interface TitleBarProps {
  onNew: () => void
  onOpen: () => void
  onSave: (saveAs?: boolean) => void
}

interface MenuItem {
  label?: string
  shortcut?: string
  onClick?: () => void
  separator?: boolean
  disabled?: boolean
}

export function TitleBar({ onNew, onOpen, onSave }: TitleBarProps) {
  const projectName = useEditorStore((state) => state.project.name)
  const dirty = useEditorStore((state) => state.dirty)
  const playing = useEditorStore((state) => state.playing)
  const paused = useEditorStore((state) => state.paused)
  const copilotOpen = useEditorStore((state) => state.copilotOpen)
  const modal = useEditorStore((state) => state.modal)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const setModal = useEditorStore((state) => state.setModal)
  const setCopilotOpen = useEditorStore((state) => state.setCopilotOpen)
  const play = useEditorStore((state) => state.play)
  const stop = useEditorStore((state) => state.stop)
  const setPaused = useEditorStore((state) => state.setPaused)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const duplicateNode = useEditorStore((state) => state.duplicateNode)
  const deleteNode = useEditorStore((state) => state.deleteNode)
  const showGrid = useEditorStore((state) => state.showGrid)
  const showCollision = useEditorStore((state) => state.showCollision)
  const setShowGrid = useEditorStore((state) => state.setShowGrid)
  const setShowCollision = useEditorStore((state) => state.setShowCollision)
  const bottomOpen = useEditorStore((state) => state.bottomOpen)
  const setBottomOpen = useEditorStore((state) => state.setBottomOpen)
  const setBottomTab = useEditorStore((state) => state.setBottomTab)
  const past = useEditorStore((state) => state.past)
  const future = useEditorStore((state) => state.future)
  const updateStatus = useUpdateStore((state) => state.status)
  const updateAvailable = ['available', 'downloading', 'ready'].includes(updateStatus)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpenMenu(null)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setOpenMenu(null)
  }, [modal])

  const menus: Record<string, MenuItem[]> = {
    Archivo: [
      { label: 'Nuevo proyecto…', shortcut: 'Ctrl+N', onClick: onNew },
      { label: 'Abrir proyecto…', shortcut: 'Ctrl+O', onClick: onOpen },
      { separator: true },
      { label: 'Guardar', shortcut: 'Ctrl+S', onClick: () => onSave(false) },
      { label: 'Guardar como…', shortcut: 'Ctrl+Shift+S', onClick: () => onSave(true) },
      { separator: true },
      { label: 'Salir', onClick: () => window.close() }
    ],
    Edición: [
      { label: 'Deshacer', shortcut: 'Ctrl+Z', onClick: undo, disabled: !past.length },
      { label: 'Rehacer', shortcut: 'Ctrl+Y', onClick: redo, disabled: !future.length },
      { separator: true },
      {
        label: 'Duplicar nodo',
        shortcut: 'Ctrl+D',
        onClick: () => selectedNodeId && duplicateNode(selectedNodeId),
        disabled: !selectedNodeId
      },
      {
        label: 'Eliminar nodo',
        shortcut: 'Supr',
        onClick: () => selectedNodeId && deleteNode(selectedNodeId),
        disabled: !selectedNodeId
      },
      { separator: true },
      { label: 'Ajustes de IA…', onClick: () => setModal('ai-settings') }
    ],
    Ver: [
      { label: `${showGrid ? '✓ ' : ''}Cuadrícula`, shortcut: 'G', onClick: () => setShowGrid(!showGrid) },
      { label: `${showCollision ? '✓ ' : ''}Formas de colisión`, shortcut: 'C', onClick: () => setShowCollision(!showCollision) },
      { separator: true },
      { label: `${bottomOpen ? '✓ ' : ''}Panel inferior`, onClick: () => setBottomOpen(!bottomOpen) },
      { label: `${copilotOpen ? '✓ ' : ''}Copiloto IA`, onClick: () => setCopilotOpen(!copilotOpen) },
      { separator: true },
      { label: 'Consola', onClick: () => setBottomTab('console') }
    ],
    Proyecto: [
      { label: 'Reproducir escena', shortcut: 'F5', onClick: play },
      { label: 'Detener', shortcut: 'Shift+F5', onClick: stop, disabled: !playing },
      { separator: true },
      { label: 'Configuración del proyecto…', onClick: () => setModal('project-settings') },
      { label: 'Ajustes de IA…', onClick: () => setModal('ai-settings') }
    ],
    Ayuda: [
      { label: 'Buscar actualizaciones…', onClick: () => setModal('updates') },
      { separator: true },
      { label: 'Atajos de teclado…', onClick: () => setModal('shortcuts') },
      { label: 'Acerca de Axiom…', onClick: () => setModal('about') }
    ]
  }

  return (
    <header className="titlebar" ref={barRef}>
      <div className="brand">
        <span className="brand-mark">
          <svg viewBox="0 0 32 32" width="21" height="21" aria-hidden="true">
            <defs>
              <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="55%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <path d="M16 3.5 29 27H21.2L16 16.6 10.8 27H3Z" fill="url(#brand-gradient)" />
            <circle cx="16" cy="23.4" r="2.2" fill="#e0f2fe" />
          </svg>
        </span>
        <span className="brand-name">AXIOM</span>
        <span className="brand-tag">ENGINE</span>
      </div>

      <nav className="menubar">
        {Object.entries(menus).map(([label, items]) => (
          <div className="menu-root" key={label}>
            <button
              type="button"
              className={`menu-trigger ${openMenu === label ? 'is-open' : ''}`}
              onClick={() => setOpenMenu(openMenu === label ? null : label)}
            >
              {label}
            </button>
            {openMenu === label ? (
              <div className="menu-popover">
                {items.map((item, index) =>
                  item.separator ? (
                    <div className="menu-separator" key={`sep-${index}`} />
                  ) : (
                    <button
                      type="button"
                      key={item.label}
                      className="menu-item"
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenMenu(null)
                        item.onClick?.()
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut ? <span className="menu-shortcut">{item.shortcut}</span> : null}
                    </button>
                  )
                )}
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div className="title-project">
        <button
          type="button"
          className="project-name"
          title="Doble clic para abrir la configuración del proyecto"
          onDoubleClick={() => setModal('project-settings')}
        >
          {projectName}
        </button>
        <span className={`save-dot ${dirty ? 'is-dirty' : ''}`} title={dirty ? 'Cambios sin guardar' : 'Guardado'}>
          <Circle size={6} fill="currentColor" />
          {dirty ? 'sin guardar' : 'guardado'}
        </span>
      </div>

      <div className="title-actions">
        <div className="transport">
          <IconButton title={playing ? (paused ? 'Reanudar' : 'Pausar') : 'Reproducir escena (F5)'} onClick={() => (playing ? setPaused(!paused) : play())} active={playing} className="play-btn">
            {playing && !paused ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
          </IconButton>
          <IconButton title="Detener (Shift+F5)" onClick={stop} disabled={!playing}>
            <Square size={13} fill="currentColor" />
          </IconButton>
        </div>
        <div className="title-separator" />
        {updateAvailable ? (
          <IconButton
            title="Hay una actualización disponible"
            onClick={() => setModal('updates')}
            className="update-indicator"
            active={updateStatus === 'ready'}
          >
            <ArrowDownToLine size={15} />
            <span className="update-indicator-dot" />
          </IconButton>
        ) : null}
        <IconButton title="Guardar proyecto (Ctrl+S)" onClick={() => onSave(false)}>
          <Save size={15} />
        </IconButton>
        <IconButton title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!past.length}>
          <Undo2 size={15} />
        </IconButton>
        <IconButton title="Rehacer (Ctrl+Y)" onClick={redo} disabled={!future.length}>
          <Redo2 size={15} />
        </IconButton>
        <button
          type="button"
          className={`copilot-toggle ${copilotOpen ? 'is-active' : ''}`}
          onClick={() => setCopilotOpen(!copilotOpen)}
          title="Mostrar u ocultar el Copiloto IA"
        >
          <Sparkles size={14} />
          <span>Copiloto</span>
          <ChevronDown size={12} className={copilotOpen ? 'rotated' : ''} />
        </button>
        <IconButton title="Ajustes de IA" onClick={() => setModal('ai-settings')}>
          <Settings2 size={15} />
        </IconButton>
        <IconButton title="Ayuda y atajos" onClick={() => setModal('shortcuts')}>
          <HelpCircle size={15} />
        </IconButton>
        <span className="beta-chip">
          <Bot size={11} /> ALFA
        </span>
      </div>
      {window.axiom?.platform === 'linux' ? (
        <div className="window-controls">
          <button type="button" title="Minimizar" onClick={() => void window.axiom.windowControls.minimize()}>
            <Minus size={15} />
          </button>
          <button type="button" title="Maximizar" onClick={() => void window.axiom.windowControls.toggleMaximize()}>
            <Maximize2 size={13} />
          </button>
          <button type="button" className="window-close" title="Cerrar" onClick={() => void window.axiom.windowControls.close()}>
            <X size={15} />
          </button>
        </div>
      ) : null}
    </header>
  )
}
