import {
  Box,
  Camera,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Eye,
  EyeOff,
  Image,
  Layers,
  Plus,
  Search,
  Sparkles,
  Square,
  Timer,
  Trash2,
  Type,
  User,
  Volume2,
  Copy,
  MoreHorizontal
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { NodeType, SceneNode } from '../engine/types'
import { useEditorStore } from '../store/editor'
import { IconButton } from './ui'

const NODE_ICONS: Record<NodeType, ReactNode> = {
  Node2D: <Box size={13} />,
  Sprite2D: <Image size={13} />,
  CharacterBody2D: <User size={13} />,
  StaticBody2D: <Square size={13} />,
  Area2D: <CircleDot size={13} />,
  Camera2D: <Camera size={13} />,
  Label2D: <Type size={13} />,
  Timer: <Timer size={13} />,
  AudioPlayer: <Volume2 size={13} />,
  Particles2D: <Sparkles size={13} />,
  CanvasLayer: <Layers size={13} />
}

const NODE_GROUPS: Array<{ title: string; items: Array<{ type: NodeType; label: string; description: string }> }> = [
  {
    title: 'Básicos',
    items: [
      { type: 'Node2D', label: 'Grupo / Node2D', description: 'Organiza y transforma hijos' },
      { type: 'Sprite2D', label: 'Sprite 2D', description: 'Imagen o emoji en escena' },
      { type: 'Label2D', label: 'Etiqueta', description: 'Texto de mundo o HUD' },
      { type: 'CanvasLayer', label: 'Capa de interfaz', description: 'HUD fijo en pantalla' }
    ]
  },
  {
    title: 'Física y juego',
    items: [
      { type: 'CharacterBody2D', label: 'Cuerpo de personaje', description: 'Movimiento y colisión' },
      { type: 'StaticBody2D', label: 'Cuerpo estático', description: 'Suelo y paredes' },
      { type: 'Area2D', label: 'Área', description: 'Detección, monedas, daño' }
    ]
  },
  {
    title: 'Utilidades',
    items: [
      { type: 'Camera2D', label: 'Cámara 2D', description: 'Sigue a un nodo' },
      { type: 'Timer', label: 'Temporizador', description: 'Eventos repetidos o únicos' },
      { type: 'AudioPlayer', label: 'Reproductor de sonido', description: 'Efectos sintetizados' },
      { type: 'Particles2D', label: 'Partículas', description: 'Chispas y efectos' }
    ]
  }
]

export function SceneTree() {
  const project = useEditorStore((state) => state.project)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const expanded = useEditorStore((state) => state.expanded)
  const selectNode = useEditorStore((state) => state.selectNode)
  const toggleExpanded = useEditorStore((state) => state.toggleExpanded)
  const toggleNodeVisibility = useEditorStore((state) => state.toggleNodeVisibility)
  const renameNode = useEditorStore((state) => state.renameNode)
  const addNode = useEditorStore((state) => state.addNode)
  const addScene = useEditorStore((state) => state.addScene)
  const setActiveScene = useEditorStore((state) => state.setActiveScene)
  const deleteNode = useEditorStore((state) => state.deleteNode)
  const duplicateNode = useEditorStore((state) => state.duplicateNode)
  const reparentNode = useEditorStore((state) => state.reparentNode)
  const setMainScene = useEditorStore((state) => state.setMainScene)
  const deleteScene = useEditorStore((state) => state.deleteScene)
  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId) ?? project.scenes[0]
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [sceneMenuOpen, setSceneMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [context, setContext] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const sceneMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) setAddMenuOpen(false)
      if (sceneMenuRef.current && !sceneMenuRef.current.contains(event.target as Node)) setSceneMenuOpen(false)
      if (context) setContext(null)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [context])

  const startRename = (node: SceneNode) => {
    setRenamingId(node.id)
    setRenameValue(node.name)
  }

  const finishRename = () => {
    if (renamingId) renameNode(renamingId, renameValue)
    setRenamingId(null)
  }

  const matchesSearch = (node: SceneNode): boolean => {
    if (!search.trim()) return true
    const query = search.toLowerCase()
    if (node.name.toLowerCase().includes(query) || node.type.toLowerCase().includes(query)) return true
    return node.children.some(matchesSearch)
  }

  const renderNode = (node: SceneNode, depth: number): ReactNode => {
    if (!matchesSearch(node)) return null
    const isRoot = node.id === activeScene.root.id
    const hasChildren = node.children.length > 0
    const isOpen = expanded[node.id] ?? true
    const isSelected = selectedNodeId === node.id
    const isDropTarget = dropTargetId === node.id
    const isTemplate = node.template

    return (
      <div key={node.id} className="tree-branch">
        <div
          className={`tree-row ${isSelected ? 'is-selected' : ''} ${isDropTarget ? 'is-drop-target' : ''} ${
            isTemplate ? 'is-template' : ''
          }`}
          style={{ paddingLeft: 6 + depth * 14 }}
          draggable={!isRoot}
          onDragStart={(event) => {
            event.dataTransfer.setData('application/x-axiom-node', node.id)
            event.dataTransfer.effectAllowed = 'move'
            setDraggingId(node.id)
          }}
          onDragEnd={() => {
            setDraggingId(null)
            setDropTargetId(null)
          }}
          onDragOver={(event) => {
            if (!draggingId || draggingId === node.id) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTargetId(node.id)
          }}
          onDragLeave={() => setDropTargetId((current) => (current === node.id ? null : current))}
          onDrop={(event) => {
            event.preventDefault()
            const dragged = event.dataTransfer.getData('application/x-axiom-node') || draggingId
            if (dragged && dragged !== node.id) reparentNode(dragged, node.id)
            setDraggingId(null)
            setDropTargetId(null)
          }}
          onClick={() => selectNode(node.id)}
          onDoubleClick={() => startRename(node)}
          onContextMenu={(event) => {
            event.preventDefault()
            selectNode(node.id)
            setContext({ x: event.clientX, y: event.clientY, nodeId: node.id })
          }}
        >
          <button
            type="button"
            className={`tree-chevron ${hasChildren ? '' : 'is-empty'}`}
            onClick={(event) => {
              event.stopPropagation()
              if (hasChildren) toggleExpanded(node.id)
            }}
            tabIndex={-1}
          >
            {hasChildren ? isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : <span />}
          </button>
          <span className={`node-icon node-icon-${node.type}`}>{NODE_ICONS[node.type]}</span>
          {renamingId === node.id ? (
            <input
              className="tree-rename"
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={finishRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') finishRename()
                if (event.key === 'Escape') setRenamingId(null)
              }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span className="tree-name" title={`${node.name} · ${node.type}`}>
              {node.name}
            </span>
          )}
          {node.script ? <span className="script-pip" title="Tiene script">JS</span> : null}
          {node.template ? <span className="template-pip">TPL</span> : null}
          {node.props.group ? <span className="group-pip">{node.props.group}</span> : null}
          <span className="tree-row-actions">
            <button
              type="button"
              className="tree-eye"
              title={node.visible ? 'Ocultar nodo' : 'Mostrar nodo'}
              onClick={(event) => {
                event.stopPropagation()
                toggleNodeVisibility(node.id)
              }}
            >
              {node.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </span>
        </div>
        {hasChildren && isOpen ? <div className="tree-children">{node.children.map((child) => renderNode(child, depth + 1))}</div> : null}
      </div>
    )
  }

  return (
    <aside className="left-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span>ESCENA</span>
          <span className="panel-count">{activeScene.root.children.length} raíz</span>
        </div>
        <div className="panel-actions">
          <div className="relative" ref={sceneMenuRef}>
            <IconButton title="Opciones de escena" onClick={() => setSceneMenuOpen(!sceneMenuOpen)}>
              <MoreHorizontal size={15} />
            </IconButton>
            {sceneMenuOpen ? (
              <div className="popover scene-popover">
                <button type="button" className="menu-item" onClick={() => setMainScene(activeScene.id)}>
                  Marcar como escena principal
                </button>
                <button type="button" className="menu-item" onClick={() => addScene()}>
                  Nueva escena
                </button>
                <div className="menu-separator" />
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => deleteScene(activeScene.id)}
                  disabled={project.scenes.length <= 1}
                >
                  Eliminar escena
                </button>
              </div>
            ) : null}
          </div>
          <IconButton title="Añadir escena" onClick={() => addScene()}>
            <Plus size={15} />
          </IconButton>
        </div>
      </div>

      <div className="scene-tabs">
        {project.scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            className={`scene-tab ${scene.id === activeScene.id ? 'is-active' : ''}`}
            onClick={() => setActiveScene(scene.id)}
            title={scene.id === project.mainSceneId ? 'Escena principal' : scene.name}
          >
            {scene.name}
            {scene.id === project.mainSceneId ? <span className="main-scene-dot" /> : null}
          </button>
        ))}
      </div>

      <div className="scene-search">
        <Search size={13} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nodo…" />
        {search ? (
          <button type="button" onClick={() => setSearch('')} title="Limpiar búsqueda">
            ×
          </button>
        ) : null}
      </div>

      <div className="tree-scroll" onClick={() => selectNode(null)}>
        <div onClick={(event) => event.stopPropagation()}>{renderNode(activeScene.root, 0)}</div>
        <div
          className={`tree-root-drop ${dropTargetId === 'root' ? 'is-drop-target' : ''}`}
          onDragOver={(event) => {
            if (!draggingId) return
            event.preventDefault()
            setDropTargetId('root')
          }}
          onDragLeave={() => setDropTargetId((current) => (current === 'root' ? null : current))}
          onDrop={(event) => {
            event.preventDefault()
            if (draggingId) reparentNode(draggingId, activeScene.root.id)
            setDraggingId(null)
            setDropTargetId(null)
          }}
        >
          Arrastra aquí para mover a la raíz
        </div>
      </div>

      <div className="left-footer">
        <div className="relative add-menu-anchor" ref={addMenuRef}>
          <button type="button" className="primary-btn add-node-btn" onClick={() => setAddMenuOpen(!addMenuOpen)}>
            <Plus size={14} />
            Añadir nodo
            <ChevronDown size={12} />
          </button>
          {addMenuOpen ? (
            <div className="popover add-popover">
              {NODE_GROUPS.map((group) => (
                <div className="add-group" key={group.title}>
                  <div className="add-group-title">{group.title}</div>
                  {group.items.map((item) => (
                    <button
                      type="button"
                      className="add-item"
                      key={item.type}
                      onClick={() => {
                        addNode(item.type)
                        setAddMenuOpen(false)
                      }}
                    >
                      <span className={`node-icon node-icon-${item.type}`}>{NODE_ICONS[item.type]}</span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <span className="node-total">{useEditorStore.getState().project.scenes.find((scene) => scene.id === activeSceneId)?.root.children.length ?? 0} grupos</span>
      </div>

      {context ? (
        <div className="context-menu" style={{ left: context.x, top: context.y }} onMouseDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              selectNode(context.nodeId)
              setAddMenuOpen(true)
              setContext(null)
            }}
          >
            <Plus size={13} /> Añadir hijo
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              duplicateNode(context.nodeId)
              setContext(null)
            }}
          >
            <Copy size={13} /> Duplicar
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              toggleNodeVisibility(context.nodeId)
              setContext(null)
            }}
          >
            <Eye size={13} /> Mostrar / ocultar
          </button>
          <div className="menu-separator" />
          <button
            type="button"
            className="menu-item danger"
            onClick={() => {
              deleteNode(context.nodeId)
              setContext(null)
            }}
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      ) : null}
    </aside>
  )
}
