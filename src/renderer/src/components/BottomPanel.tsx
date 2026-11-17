import {
  Box,
  ChevronDown,
  CircleAlert,
  Code2,
  FileCode2,
  FileJson2,
  Folder,
  ImagePlus,
  Layers,
  Package,
  Search,
  Terminal,
  Trash2,
  Upload,
  Play,
  Save
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Asset } from '../engine/types'
import { useEditorStore } from '../store/editor'
import { IconButton } from './ui'

type AssetFilter = 'all' | 'characters' | 'objects' | 'shapes' | 'imported'

const CHARACTER_IDS = new Set([
  'hero', 'robot', 'frog', 'ghost', 'alien', 'ninja', 'wizard', 'knight', 'ship', 'ufo', 'slime', 'bat', 'crab', 'bee', 'dragon', 'zombie'
])

export function BottomPanel() {
  const tab = useEditorStore((state) => state.bottomTab)
  const setTab = useEditorStore((state) => state.setBottomTab)
  const setBottomOpen = useEditorStore((state) => state.setBottomOpen)
  const project = useEditorStore((state) => state.project)
  const logs = useEditorStore((state) => state.logs)
  const clearLogs = useEditorStore((state) => state.clearLogs)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const setActiveScene = useEditorStore((state) => state.setActiveScene)
  const setModal = useEditorStore((state) => state.setModal)
  const addSpriteFromAsset = useEditorStore((state) => state.addSpriteFromAsset)
  const addImageAsset = useEditorStore((state) => state.addImageAsset)
  const filePath = useEditorStore((state) => state.filePath)
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [search, setSearch] = useState('')
  const consoleRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'error'>('all')

  useEffect(() => {
    if (tab === 'console' && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs, tab])

  const assets = useMemo(() => {
    return project.assets.filter((asset) => {
      const query = search.toLowerCase()
      if (query && !asset.name.toLowerCase().includes(query) && !asset.id.toLowerCase().includes(query)) return false
      if (filter === 'all') return true
      if (filter === 'shapes') return asset.kind === 'shape'
      if (filter === 'imported') return asset.kind === 'image'
      if (filter === 'characters') {
        return (asset.kind === 'emoji' && CHARACTER_IDS.has(asset.id)) || (asset.kind === 'vector' && asset.variant === 'slime')
      }
      return (
        (asset.kind === 'emoji' && !CHARACTER_IDS.has(asset.id)) ||
        (asset.kind === 'vector' && asset.variant !== 'slime')
      )
    })
  }, [project.assets, filter, search])

  const filteredLogs = logs.filter((log) => consoleFilter === 'all' || log.level === 'error')

  const upload = () => fileInputRef.current?.click()

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image = new Image()
      image.onload = () => {
        addImageAsset(dataUrl, image.width, image.height, file.name.replace(/\.[^.]+$/, ''))
      }
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  return (
    <section className="bottom-panel">
      <div className="bottom-tabs">
        <div className="bottom-tab-group">
          <button type="button" className={`bottom-tab ${tab === 'assets' ? 'is-active' : ''}`} onClick={() => setTab('assets')}>
            <Package size={14} /> Assets <span className="tab-count">{project.assets.length}</span>
          </button>
          <button type="button" className={`bottom-tab ${tab === 'files' ? 'is-active' : ''}`} onClick={() => setTab('files')}>
            <Folder size={14} /> Archivos
          </button>
          <button type="button" className={`bottom-tab ${tab === 'console' ? 'is-active' : ''}`} onClick={() => setTab('console')}>
            <Terminal size={14} /> Consola
            {logs.some((log) => log.level === 'error') ? <span className="error-dot" /> : null}
          </button>
        </div>
        <div className="bottom-actions">
          {tab === 'assets' ? (
            <>
              <button type="button" className="subtle-btn" onClick={upload}>
                <Upload size={13} /> Importar imagen
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(event) => handleFiles(event.target.files)}
              />
            </>
          ) : null}
          {tab === 'console' ? (
            <>
              <button
                type="button"
                className={`subtle-btn ${consoleFilter === 'error' ? 'is-active' : ''}`}
                onClick={() => setConsoleFilter(consoleFilter === 'error' ? 'all' : 'error')}
              >
                <CircleAlert size={13} /> Errores
              </button>
              <button type="button" className="subtle-btn" onClick={clearLogs}>
                <Trash2 size={13} /> Limpiar
              </button>
            </>
          ) : null}
          <IconButton title="Ocultar panel" onClick={() => setBottomOpen(false)}>
            <ChevronDown size={15} />
          </IconButton>
        </div>
      </div>

      {tab === 'assets' ? (
        <div className="assets-pane">
          <div className="assets-sidebar">
            <div className="asset-search">
              <Search size={13} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar asset…" />
            </div>
            {[
              { id: 'all', label: 'Todos', icon: <Layers size={13} /> },
              { id: 'characters', label: 'Personajes', icon: <Box size={13} /> },
              { id: 'objects', label: 'Objetos', icon: <Package size={13} /> },
              { id: 'shapes', label: 'Formas', icon: <Box size={13} /> },
              { id: 'imported', label: 'Importados', icon: <ImagePlus size={13} /> }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`asset-filter ${filter === item.id ? 'is-active' : ''}`}
                onClick={() => setFilter(item.id as AssetFilter)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <button type="button" className="asset-import-card" onClick={upload}>
              <ImagePlus size={18} />
              <span>Importar imagen</span>
              <small>PNG, JPG o WebP</small>
            </button>
          </div>
          <div className="assets-grid">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onAdd={(x, y) => addSpriteFromAsset(asset.id, x, y)} />
            ))}
            {assets.length === 0 ? <div className="assets-empty">No se encontraron assets.</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'files' ? (
        <div className="files-pane">
          <div className="files-tree">
            <div className="file-root">
              <Folder size={14} /> {project.name}
              <span>{filePath ? filePath : 'Sin guardar en disco'}</span>
            </div>
            <div className="file-row file-project">
              <FileJson2 size={14} />
              proyecto.axiom
              <span>{project.scenes.length} escenas · {project.assets.length} assets</span>
            </div>
            {project.scenes.map((scene) => (
              <div key={scene.id} className="file-scene-block">
                <button
                  type="button"
                  className={`file-row ${scene.id === activeSceneId ? 'is-active' : ''}`}
                  onClick={() => setActiveScene(scene.id)}
                >
                  <FileJson2 size={14} />
                  {scene.name}.scene
                  {scene.id === project.mainSceneId ? <span className="file-badge">principal</span> : null}
                </button>
                {flattenScripts(scene.root).map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className="file-row file-script"
                    onClick={() => {
                      setActiveScene(scene.id)
                      useEditorStore.getState().selectNode(node.id)
                      setModal('script', node.id)
                    }}
                  >
                    <FileCode2 size={13} />
                    {node.name}.js
                    <span>{node.type}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="files-summary">
            <h3>Proyecto Axiom</h3>
            <p>
              Los proyectos se guardan en un único archivo <code>.axiom</code> que contiene escenas, assets y scripts. Puedes moverlo, versionarlo y compartirlo.
            </p>
            <div className="file-stat-grid">
              <div><strong>{project.scenes.length}</strong><span>Escenas</span></div>
              <div><strong>{project.assets.length}</strong><span>Assets</span></div>
              <div><strong>{countScripts(project)}</strong><span>Scripts</span></div>
              <div><strong>{project.settings.width}×{project.settings.height}</strong><span>Resolución</span></div>
            </div>
            <button type="button" className="secondary-btn" onClick={() => useEditorStore.getState().setModal('project-settings')}>
              <Code2 size={14} /> Abrir configuración
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'console' ? (
        <div className="console-pane" ref={consoleRef}>
          {filteredLogs.length === 0 ? (
            <div className="console-empty">La consola está vacía. Reproduce la escena para ver mensajes.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className={`console-line level-${log.level}`}>
                <span className="console-time">{formatTime(log.time)}</span>
                <span className="console-level">{log.level === 'error' ? 'ERR' : log.level === 'warn' ? 'WRN' : log.level === 'success' ? 'OK' : 'LOG'}</span>
                <span className="console-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}

function AssetCard({ asset, onAdd }: { asset: Asset; onAdd: (x: number, y: number) => void }) {
  const add = () => onAdd(Math.round((Math.random() - 0.5) * 200), Math.round((Math.random() - 0.5) * 120))
  return (
    <div
      className="asset-card"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-axiom-asset', asset.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onDoubleClick={add}
      title={`${asset.name} · doble clic o arrastra a la escena`}
    >
      <div className={`asset-thumb ${asset.kind === 'emoji' ? 'is-emoji' : ''}`}>
        {asset.kind === 'emoji' ? (
          <span>{asset.glyph}</span>
        ) : asset.kind === 'image' ? (
          <img src={asset.dataUrl} alt={asset.name} />
        ) : asset.kind === 'vector' ? (
          <span className={`vector-preview vector-${asset.variant}`} />
        ) : (
          <span className={`shape-preview shape-${asset.shape}`} style={{ background: asset.color }} />
        )}
      </div>
      <span className="asset-name">{asset.name}</span>
      <span className="asset-kind">
        {asset.kind === 'emoji' ? 'sprite' : asset.kind === 'image' ? 'imagen' : asset.kind === 'vector' ? 'objeto' : 'forma'}
      </span>
      <button type="button" className="asset-add" onClick={add} title="Añadir a la escena">
        +
      </button>
    </div>
  )
}

function flattenScripts(root: any): any[] {
  const result: any[] = []
  const visit = (node: any) => {
    if (node.script) result.push(node)
    node.children.forEach(visit)
  }
  visit(root)
  return result
}

function countScripts(project: any): number {
  return project.scenes.reduce((total: number, scene: any) => total + flattenScripts(scene.root).length, 0)
}

function formatTime(time: number): string {
  const date = new Date(time)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}`
}
