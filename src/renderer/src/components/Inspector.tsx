import {
  Box,
  Camera,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  Image,
  Layers,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Type,
  User,
  Volume2,
  WandSparkles,
  Timer as TimerIcon,
  Code2
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { NodeType, SceneNode } from '../engine/types'
import { activeScene, selectedNode, useEditorStore } from '../store/editor'
import { ColorInput, Field, IconButton, NumberInput, Section, Select, TextInput, Toggle } from './ui'

const TYPE_ICONS: Record<NodeType, ReactNode> = {
  Node2D: <Box size={13} />,
  Sprite2D: <Image size={13} />,
  CharacterBody2D: <User size={13} />,
  StaticBody2D: <Square size={13} />,
  Area2D: <CircleDot size={13} />,
  Camera2D: <Camera size={13} />,
  Label2D: <Type size={13} />,
  Timer: <TimerIcon size={13} />,
  AudioPlayer: <Volume2 size={13} />,
  Particles2D: <Sparkles size={13} />,
  CanvasLayer: <Layers size={13} />
}

const TYPE_LABELS: Record<NodeType, string> = {
  Node2D: 'Node2D',
  Sprite2D: 'Sprite 2D',
  CharacterBody2D: 'Cuerpo de personaje',
  StaticBody2D: 'Cuerpo estático',
  Area2D: 'Área',
  Camera2D: 'Cámara 2D',
  Label2D: 'Etiqueta',
  Timer: 'Temporizador',
  AudioPlayer: 'Audio',
  Particles2D: 'Partículas',
  CanvasLayer: 'Capa de interfaz'
}

const SOUND_OPTIONS = ['coin', 'jump', 'hit', 'laser', 'explosion', 'powerup', 'click', 'win', 'lose', 'blip'].map((sound) => ({
  value: sound,
  label: sound
}))

export function Inspector() {
  const project = useEditorStore((state) => state.project)
  const selected = useEditorStore(selectedNode)
  const scene = useEditorStore(activeScene)
  const patchNode = useEditorStore((state) => state.patchNode)
  const setNodeProp = useEditorStore((state) => state.setNodeProp)
  const duplicateNode = useEditorStore((state) => state.duplicateNode)
  const deleteNode = useEditorStore((state) => state.deleteNode)
  const setModal = useEditorStore((state) => state.setModal)
  const setProjectSettings = useEditorStore((state) => state.setProjectSettings)
  const setProjectName = useEditorStore((state) => state.setProjectName)
  const setSceneSettings = useEditorStore((state) => state.setSceneSettings)
  const setMainScene = useEditorStore((state) => state.setMainScene)
  const [projectOpen, setProjectOpen] = useState(false)

  return (
    <aside className="inspector-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span>INSPECTOR</span>
          {selected ? <span className="panel-count">{TYPE_LABELS[selected.type]}</span> : <span className="panel-count">PROYECTO</span>}
        </div>
        <div className="panel-actions">
          <IconButton title="Configuración del proyecto" onClick={() => setModal('project-settings')}>
            <Settings2 size={15} />
          </IconButton>
        </div>
      </div>

      <div className="inspector-scroll">
        {selected ? (
          <NodeInspector
            node={selected}
            sceneNodes={scene ? [scene.root, ...flattenScene(scene.root)] : []}
            onPatch={(patch) => patchNode(selected.id, patch)}
            onProp={(key, value) => setNodeProp(selected.id, key, value)}
            onDuplicate={() => duplicateNode(selected.id)}
            onDelete={() => deleteNode(selected.id)}
            onEditScript={() => setModal('script', selected.id)}
            projectAssets={project.assets}
          />
        ) : (
          <div className="inspector-empty">
            <div className="empty-orbit">
              <WandSparkles size={22} />
            </div>
            <h3>Nada seleccionado</h3>
            <p>Selecciona un nodo en el árbol o en la escena para editar sus propiedades.</p>
            <button type="button" className="secondary-btn" onClick={() => setModal('project-settings')}>
              <Settings2 size={14} /> Configuración del proyecto
            </button>
          </div>
        )}

        <details className="inspector-section project-section" open={projectOpen} onToggle={(event) => setProjectOpen((event.target as HTMLDetailsElement).open)}>
          <summary>
            <span>PROYECTO Y ESCENA</span>
            <span className="section-actions">
              <button
                type="button"
                className="mini-link"
                onClick={(event) => {
                  event.preventDefault()
                  setModal('project-settings')
                }}
              >
                Abrir
              </button>
            </span>
          </summary>
          <div className="section-body">
            <Field label="Proyecto">
              <TextInput value={project.name} onChange={setProjectName} />
            </Field>
            <div className="two-col">
              <Field label="Ancho">
                <NumberInput value={project.settings.width} onChange={(value) => setProjectSettings({ width: Math.max(160, Math.round(value)) })} suffix="px" />
              </Field>
              <Field label="Alto">
                <NumberInput value={project.settings.height} onChange={(value) => setProjectSettings({ height: Math.max(90, Math.round(value)) })} suffix="px" />
              </Field>
            </div>
            <Field label="Gravedad">
              <NumberInput value={project.settings.gravity} onChange={(value) => setProjectSettings({ gravity: value })} suffix="px/s²" />
            </Field>
            <Field label="Escena principal">
              <Select
                value={project.mainSceneId}
                onChange={setMainScene}
                options={project.scenes.map((sceneItem) => ({ value: sceneItem.id, label: sceneItem.name }))}
              />
            </Field>
            {scene ? (
              <>
                <Field label="Fondo de escena">
                  <ColorInput value={scene.settings.background || project.settings.background} onChange={(value) => setSceneSettings({ background: value })} />
                </Field>
                <Field label="Estilo">
                  <Select
                    value={scene.settings.style ?? project.settings.backgroundStyle}
                    onChange={(value) => setSceneSettings({ style: value as any })}
                    options={[
                      { value: 'stars', label: 'Estrellas' },
                      { value: 'gradient', label: 'Degradado' },
                      { value: 'grid', label: 'Rejilla' },
                      { value: 'solid', label: 'Color plano' }
                    ]}
                  />
                </Field>
              </>
            ) : null}
            <div className="project-meta">
              <span>{project.scenes.length} escenas</span>
              <span>{project.assets.length} assets</span>
              <span>{project.settings.width}×{project.settings.height}</span>
            </div>
          </div>
        </details>
      </div>
    </aside>
  )
}

function flattenScene(root: SceneNode): SceneNode[] {
  const result: SceneNode[] = []
  const visit = (node: SceneNode) => {
    for (const child of node.children) {
      result.push(child)
      visit(child)
    }
  }
  visit(root)
  return result
}

function NodeInspector({
  node,
  sceneNodes,
  onPatch,
  onProp,
  onDuplicate,
  onDelete,
  onEditScript,
  projectAssets
}: {
  node: SceneNode
  sceneNodes: SceneNode[]
  onPatch: (patch: Partial<SceneNode> & { props?: Record<string, any> }) => void
  onProp: (key: string, value: any) => void
  onDuplicate: () => void
  onDelete: () => void
  onEditScript: () => void
  projectAssets: any[]
}) {
  const [name, setName] = useState(node.name)
  useEffect(() => setName(node.name), [node.id, node.name])

  return (
    <>
      <div className="inspector-node-head">
        <span className={`node-icon-large node-icon-${node.type}`}>{TYPE_ICONS[node.type]}</span>
        <div className="inspector-node-title">
          <input
            className="node-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => onPatch({ name })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onPatch({ name })
                ;(event.target as HTMLInputElement).blur()
              }
            }}
          />
          <span className="node-type-label">{TYPE_LABELS[node.type]} · {node.template ? 'plantilla' : 'nodo de escena'}</span>
        </div>
        <div className="inspector-node-actions">
          <IconButton title="Duplicar nodo" onClick={onDuplicate}>
            <Copy size={14} />
          </IconButton>
          <IconButton title="Eliminar nodo" onClick={onDelete}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>

      <div className="inspector-badges">
        <button type="button" className={`tiny-toggle ${node.visible ? 'is-on' : ''}`} onClick={() => onPatch({ visible: !node.visible })}>
          {node.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          {node.visible ? 'Visible' : 'Oculto'}
        </button>
        <button type="button" className={`tiny-toggle ${node.template ? 'is-on' : ''}`} onClick={() => onPatch({ template: !node.template })}>
          <Layers size={12} /> {node.template ? 'Plantilla' : 'Normal'}
        </button>
        {node.script ? (
          <button type="button" className="tiny-toggle is-on" onClick={onEditScript}>
            <Code2 size={12} /> Script
          </button>
        ) : (
          <button type="button" className="tiny-toggle" onClick={onEditScript}>
            <Code2 size={12} /> + Script
          </button>
        )}
      </div>

      <Section title="Transformación">
        <div className="two-col">
          <Field label="Posición X">
            <NumberInput value={node.x} onChange={(value) => onPatch({ x: value })} suffix="px" />
          </Field>
          <Field label="Posición Y">
            <NumberInput value={node.y} onChange={(value) => onPatch({ y: value })} suffix="px" />
          </Field>
        </div>
        <div className="two-col">
          <Field label="Rotación">
            <NumberInput value={node.rotation} onChange={(value) => onPatch({ rotation: value })} suffix="°" />
          </Field>
          <Field label="Capa Z">
            <NumberInput value={node.zIndex} onChange={(value) => onPatch({ zIndex: Math.round(value) })} />
          </Field>
        </div>
        <div className="two-col">
          <Field label="Escala X">
            <NumberInput value={node.scaleX} step={0.1} onChange={(value) => onPatch({ scaleX: value })} />
          </Field>
          <Field label="Escala Y">
            <NumberInput value={node.scaleY} step={0.1} onChange={(value) => onPatch({ scaleY: value })} />
          </Field>
        </div>
      </Section>

      {node.type === 'Sprite2D' ? (
        <Section title="Apariencia">
          <AssetField assets={projectAssets} value={node.props.assetId} onChange={(value) => onProp('assetId', value)} />
          <div className="two-col">
            <Field label="Ancho">
              <NumberInput value={node.props.width ?? 64} onChange={(value) => onProp('width', value)} suffix="px" />
            </Field>
            <Field label="Alto">
              <NumberInput value={node.props.height ?? 64} onChange={(value) => onProp('height', value)} suffix="px" />
            </Field>
          </div>
          <div className="two-col">
            <Field label="Opacidad">
              <NumberInput value={node.props.opacity ?? 1} step={0.05} min={0} max={1} onChange={(value) => onProp('opacity', value)} />
            </Field>
            <Field label="Brillo">
              <NumberInput value={node.props.glow ?? 0} min={0} max={60} onChange={(value) => onProp('glow', value)} />
            </Field>
          </div>
          <Field label="Color de brillo">
            <ColorInput value={node.props.glowColor ?? '#38bdf8'} onChange={(value) => onProp('glowColor', value)} />
          </Field>
          <div className="toggle-row">
            <span>Voltear horizontal</span>
            <Toggle checked={Boolean(node.props.flipX)} onChange={(value) => onProp('flipX', value)} />
          </div>
          <div className="toggle-row">
            <span>Voltear vertical</span>
            <Toggle checked={Boolean(node.props.flipY)} onChange={(value) => onProp('flipY', value)} />
          </div>
          <div className="toggle-row">
            <span>Sombra</span>
            <Toggle checked={Boolean(node.props.shadow)} onChange={(value) => onProp('shadow', value)} />
          </div>
        </Section>
      ) : null}

      {node.type === 'CharacterBody2D' ? (
        <Section title="Cuerpo de personaje">
          <div className="two-col">
            <Field label="Ancho">
              <NumberInput value={node.props.width ?? 36} onChange={(value) => onProp('width', value)} suffix="px" />
            </Field>
            <Field label="Alto">
              <NumberInput value={node.props.height ?? 52} onChange={(value) => onProp('height', value)} suffix="px" />
            </Field>
          </div>
          <Field label="Color del cuerpo">
            <ColorInput value={node.props.color ?? '#4ade80'} onChange={(value) => onProp('color', value)} />
          </Field>
          <Field label="Aspecto">
            <Select
              value={node.props.bodyVisual ?? 'capsule'}
              onChange={(value) => onProp('bodyVisual', value)}
              options={[
                { value: 'capsule', label: 'Cápsula con ojos' },
                { value: 'none', label: 'Oculto (usa un Sprite hijo)' }
              ]}
            />
          </Field>
          <Field label="Grupo">
            <TextInput value={String(node.props.group ?? '')} onChange={(value) => onProp('group', value)} placeholder="player" />
          </Field>
          <p className="hint-text">La gravedad no es automática. En el script usa <code>this.velocity.y += this.gravity * dt</code> y <code>this.move_and_slide(dt)</code>.</p>
        </Section>
      ) : null}

      {node.type === 'StaticBody2D' ? (
        <Section title="Sólido">
          <div className="two-col">
            <Field label="Ancho">
              <NumberInput value={node.props.width ?? 240} onChange={(value) => onProp('width', value)} suffix="px" />
            </Field>
            <Field label="Alto">
              <NumberInput value={node.props.height ?? 28} onChange={(value) => onProp('height', value)} suffix="px" />
            </Field>
          </div>
          <Field label="Color">
            <ColorInput value={node.props.color ?? '#273244'} onChange={(value) => onProp('color', value)} />
          </Field>
          <Field label="Color del borde">
            <ColorInput value={node.props.edgeColor ?? '#38bdf8'} onChange={(value) => onProp('edgeColor', value)} />
          </Field>
          <Field label="Estilo">
            <Select
              value={node.props.style ?? 'platform'}
              onChange={(value) => onProp('style', value)}
              options={[
                { value: 'platform', label: 'Plataforma neón' },
                { value: 'spikes', label: 'Pinchos (visual)' }
              ]}
            />
          </Field>
          <div className="toggle-row">
            <span>Plataforma de un solo sentido</span>
            <Toggle checked={Boolean(node.props.oneWay)} onChange={(value) => onProp('oneWay', value)} />
          </div>
        </Section>
      ) : null}

      {node.type === 'Area2D' ? (
        <Section title="Área de detección">
          <div className="two-col">
            <Field label="Ancho">
              <NumberInput value={node.props.width ?? 36} onChange={(value) => onProp('width', value)} suffix="px" />
            </Field>
            <Field label="Alto">
              <NumberInput value={node.props.height ?? 36} onChange={(value) => onProp('height', value)} suffix="px" />
            </Field>
          </div>
          <Field label="Grupo">
            <TextInput value={String(node.props.group ?? '')} onChange={(value) => onProp('group', value)} placeholder="coin / enemy / goal" />
          </Field>
          <div className="toggle-row">
            <span>Mostrar área al jugar</span>
            <Toggle checked={Boolean(node.props.debug)} onChange={(value) => onProp('debug', value)} />
          </div>
          <p className="hint-text">Detecta con <code>this.overlaps("player")</code> o los callbacks <code>_on_area_entered</code>.</p>
        </Section>
      ) : null}

      {node.type === 'Camera2D' ? (
        <Section title="Cámara">
          <Field label="Objetivo">
            <Select
              value={String(node.props.target ?? '')}
              onChange={(value) => onProp('target', value)}
              options={[{ value: '', label: 'Sin objetivo (cámara fija)' }, ...sceneNodes.map((target) => ({ value: target.name, label: target.name }))]}
            />
          </Field>
          <div className="two-col">
            <Field label="Zoom">
              <NumberInput value={node.props.zoom ?? 1} step={0.1} min={0.2} max={4} onChange={(value) => onProp('zoom', value)} />
            </Field>
            <Field label="Suavizado">
              <NumberInput value={node.props.smoothing ?? 4} step={0.5} onChange={(value) => onProp('smoothing', value)} />
            </Field>
          </div>
          <div className="two-col">
            <Field label="Desplaz. X">
              <NumberInput value={node.props.offsetX ?? 0} onChange={(value) => onProp('offsetX', value)} />
            </Field>
            <Field label="Desplaz. Y">
              <NumberInput value={node.props.offsetY ?? 0} onChange={(value) => onProp('offsetY', value)} />
            </Field>
          </div>
          <div className="toggle-row">
            <span>Activa</span>
            <Toggle checked={node.props.active !== false} onChange={(value) => onProp('active', value)} />
          </div>
        </Section>
      ) : null}

      {node.type === 'Label2D' ? (
        <Section title="Etiqueta">
          <Field label="Texto">
            <TextInput value={String(node.props.text ?? '')} onChange={(value) => onProp('text', value)} />
          </Field>
          <Field label="Enlazar variable" hint="score, lives o time">
            <TextInput value={String(node.props.bind ?? '')} onChange={(value) => onProp('bind', value)} placeholder="score" />
          </Field>
          <div className="two-col">
            <Field label="Prefijo">
              <TextInput value={String(node.props.prefix ?? '')} onChange={(value) => onProp('prefix', value)} />
            </Field>
            <Field label="Sufijo">
              <TextInput value={String(node.props.suffix ?? '')} onChange={(value) => onProp('suffix', value)} />
            </Field>
          </div>
          <div className="two-col">
            <Field label="Tamaño">
              <NumberInput value={node.props.fontSize ?? 24} onChange={(value) => onProp('fontSize', value)} suffix="px" />
            </Field>
            <Field label="Color">
              <ColorInput value={node.props.color ?? '#f8fafc'} onChange={(value) => onProp('color', value)} />
            </Field>
          </div>
          <Field label="Alineación">
            <Select
              value={node.props.align ?? 'left'}
              onChange={(value) => onProp('align', value)}
              options={[
                { value: 'left', label: 'Izquierda' },
                { value: 'center', label: 'Centro' },
                { value: 'right', label: 'Derecha' }
              ]}
            />
          </Field>
          <div className="toggle-row">
            <span>Sombra</span>
            <Toggle checked={node.props.shadow !== false} onChange={(value) => onProp('shadow', value)} />
          </div>
        </Section>
      ) : null}

      {node.type === 'Timer' ? (
        <Section title="Temporizador">
          <Field label="Espera">
            <NumberInput value={node.props.waitTime ?? 1} step={0.1} min={0.05} onChange={(value) => onProp('waitTime', value)} suffix="s" />
          </Field>
          <div className="toggle-row">
            <span>Iniciar automáticamente</span>
            <Toggle checked={Boolean(node.props.autostart)} onChange={(value) => onProp('autostart', value)} />
          </div>
          <div className="toggle-row">
            <span>Una sola vez</span>
            <Toggle checked={Boolean(node.props.oneShot)} onChange={(value) => onProp('oneShot', value)} />
          </div>
          <p className="hint-text">Añade <code>_on_timeout()</code> al script para reaccionar.</p>
        </Section>
      ) : null}

      {node.type === 'AudioPlayer' ? (
        <Section title="Sonido">
          <Field label="Efecto">
            <Select value={String(node.props.sound ?? 'coin')} onChange={(value) => onProp('sound', value)} options={SOUND_OPTIONS} />
          </Field>
          <Field label="Volumen">
            <NumberInput value={node.props.volume ?? 0.5} step={0.05} min={0} max={1} onChange={(value) => onProp('volume', value)} />
          </Field>
          <div className="toggle-row">
            <span>Reproducir al iniciar</span>
            <Toggle checked={Boolean(node.props.autoplay)} onChange={(value) => onProp('autoplay', value)} />
          </div>
        </Section>
      ) : null}

      {node.type === 'Particles2D' ? (
        <Section title="Partículas">
          <div className="two-col">
            <Field label="Color">
              <ColorInput value={node.props.color ?? '#38bdf8'} onChange={(value) => onProp('color', value)} />
            </Field>
            <Field label="Cantidad">
              <NumberInput value={node.props.amount ?? 18} onChange={(value) => onProp('amount', value)} min={1} max={80} />
            </Field>
          </div>
          <div className="two-col">
            <Field label="Tamaño">
              <NumberInput value={node.props.size ?? 4} onChange={(value) => onProp('size', value)} />
            </Field>
            <Field label="Vida">
              <NumberInput value={node.props.lifetime ?? 0.9} step={0.1} onChange={(value) => onProp('lifetime', value)} suffix="s" />
            </Field>
          </div>
          <div className="two-col">
            <Field label="Velocidad">
              <NumberInput value={node.props.speed ?? 90} onChange={(value) => onProp('speed', value)} />
            </Field>
            <Field label="Dispersión">
              <NumberInput value={node.props.spread ?? 360} onChange={(value) => onProp('spread', value)} suffix="°" />
            </Field>
          </div>
          <Field label="Gravedad">
            <NumberInput value={node.props.gravity ?? 0} onChange={(value) => onProp('gravity', value)} />
          </Field>
          <div className="toggle-row">
            <span>Emitiendo</span>
            <Toggle checked={node.props.emitting !== false} onChange={(value) => onProp('emitting', value)} />
          </div>
        </Section>
      ) : null}

      <Section title="Comportamiento">
        {node.script ? (
          <div className="script-card">
            <div className="script-card-head">
              <span className="script-dot" />
              <span>Script adjunto</span>
              <Code2 size={13} />
            </div>
            <pre>{node.script.split('\n').slice(0, 7).join('\n')}{node.script.split('\n').length > 7 ? '\n…' : ''}</pre>
            <button type="button" className="secondary-btn full" onClick={onEditScript}>
              <Code2 size={14} /> Editar script
            </button>
          </div>
        ) : (
          <div className="script-empty">
            <div className="script-empty-icon">
              <Code2 size={16} />
            </div>
            <p>Dale vida con un script: movimiento, colisiones, puntuación o IA de enemigos.</p>
            <button type="button" className="secondary-btn" onClick={onEditScript}>
              <Sparkles size={14} /> Añadir script
            </button>
          </div>
        )}
      </Section>
    </>
  )
}

function AssetField({ assets, value, onChange }: { assets: any[]; value: string; onChange: (value: string) => void }) {
  const selected = assets.find((asset) => asset.id === value)
  return (
    <div className="asset-field">
      <div className={`asset-preview ${selected?.kind === 'emoji' ? 'is-emoji' : ''}`}>
        {selected ? (
          selected.kind === 'emoji' ? (
            <span>{selected.glyph}</span>
          ) : selected.kind === 'image' ? (
            <img src={selected.dataUrl} alt={selected.name} />
          ) : selected.kind === 'vector' ? (
            <span className={`vector-preview small vector-${selected.variant}`} />
          ) : (
            <span className={`shape-preview shape-${selected.shape}`} style={{ background: selected.color }} />
          )
        ) : (
          <Image size={18} />
        )}
      </div>
      <Select
        value={value ?? ''}
        onChange={onChange}
        options={assets.map((asset) => ({ value: asset.id, label: `${asset.name}${asset.kind === 'emoji' ? ` · ${asset.glyph}` : ''}` }))}
      />
    </div>
  )
}
