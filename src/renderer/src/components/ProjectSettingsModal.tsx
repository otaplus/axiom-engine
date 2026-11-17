import { Monitor, Palette, Settings2 } from 'lucide-react'
import { useEditorStore } from '../store/editor'
import { ColorInput, Field, Modal, NumberInput, Select, TextInput, Toggle } from './ui'

const PRESETS = [
  { label: '960 × 540', width: 960, height: 540 },
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '480 × 270', width: 480, height: 270 },
  { label: '1920 × 1080', width: 1920, height: 1080 }
]

export function ProjectSettingsModal() {
  const project = useEditorStore((state) => state.project)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const setProjectName = useEditorStore((state) => state.setProjectName)
  const setProjectSettings = useEditorStore((state) => state.setProjectSettings)
  const setSceneSettings = useEditorStore((state) => state.setSceneSettings)
  const setModal = useEditorStore((state) => state.setModal)
  const scene = project.scenes.find((item) => item.id === activeSceneId)

  return (
    <Modal
      title="Configuración del proyecto"
      subtitle="Resolución, física y atmósfera visual del juego."
      onClose={() => setModal(null)}
      wide
      footer={
        <>
          <div className="modal-footer-note">
            <Settings2 size={14} /> Los cambios se guardan en el proyecto.
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="primary-btn" onClick={() => setModal(null)}>
              Listo
            </button>
          </div>
        </>
      }
    >
      <div className="project-settings-grid">
        <div className="settings-main">
          <div className="settings-section-title">
            <Monitor size={13} /> Identidad y resolución
          </div>
          <div className="settings-card">
            <Field label="Nombre del proyecto">
              <TextInput value={project.name} onChange={setProjectName} />
            </Field>
            <div className="preset-row">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`preset-chip ${
                    project.settings.width === preset.width && project.settings.height === preset.height ? 'is-active' : ''
                  }`}
                  onClick={() => setProjectSettings({ width: preset.width, height: preset.height })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="two-col">
              <Field label="Ancho">
                <NumberInput value={project.settings.width} onChange={(value) => setProjectSettings({ width: Math.round(value) })} suffix="px" />
              </Field>
              <Field label="Alto">
                <NumberInput value={project.settings.height} onChange={(value) => setProjectSettings({ height: Math.round(value) })} suffix="px" />
              </Field>
            </div>
            <div className="toggle-row">
              <span>Pixel art (desactiva suavizado)</span>
              <Toggle checked={project.settings.pixelArt} onChange={(value) => setProjectSettings({ pixelArt: value })} />
            </div>
            <div className="toggle-row">
              <span>Mostrar FPS en el juego</span>
              <Toggle checked={project.settings.showFps} onChange={(value) => setProjectSettings({ showFps: value })} />
            </div>
          </div>

          <div className="settings-section-title">
            <Palette size={13} /> Física y ambiente
          </div>
          <div className="settings-card">
            <Field label="Gravedad global" hint="Usada por los scripts con this.gravity.">
              <NumberInput value={project.settings.gravity} onChange={(value) => setProjectSettings({ gravity: value })} suffix="px/s²" />
            </Field>
            <div className="two-col">
              <Field label="Color de fondo">
                <ColorInput value={project.settings.background} onChange={(value) => setProjectSettings({ background: value })} />
              </Field>
              <Field label="Color de acento">
                <ColorInput value={project.settings.accent} onChange={(value) => setProjectSettings({ accent: value })} />
              </Field>
            </div>
            <Field label="Estilo de fondo">
              <Select
                value={project.settings.backgroundStyle}
                onChange={(value) => setProjectSettings({ backgroundStyle: value as any })}
                options={[
                  { value: 'stars', label: 'Estrellas y nebulosa' },
                  { value: 'gradient', label: 'Degradado con resplandor' },
                  { value: 'grid', label: 'Rejilla técnica' },
                  { value: 'solid', label: 'Color plano' }
                ]}
              />
            </Field>
            {scene ? (
              <Field label={`Fondo específico de «${scene.name}»`} hint="Opcional: sustituye el fondo global en esta escena.">
                <ColorInput value={scene.settings.background || project.settings.background} onChange={(value) => setSceneSettings({ background: value })} />
              </Field>
            ) : null}
          </div>
        </div>
        <aside className="settings-aside project-aside">
          <div className="project-preview-card">
            <div className="project-preview-frame" style={{ aspectRatio: `${project.settings.width} / ${project.settings.height}` }}>
              <div
                className="project-preview-bg"
                style={{
                  background: `radial-gradient(circle at 30% 20%, ${project.settings.accent}22, transparent 55%), linear-gradient(140deg, ${project.settings.background}, #05070d)`
                }}
              >
                <span className="preview-label">{project.settings.width} × {project.settings.height}</span>
              </div>
            </div>
          </div>
          <div className="settings-facts">
            <div><strong>{project.scenes.length}</strong><span>Escenas</span></div>
            <div><strong>{project.assets.length}</strong><span>Assets</span></div>
            <div><strong>{project.settings.gravity}</strong><span>Gravedad</span></div>
          </div>
          <p className="project-aside-note">
            La resolución base es la ventana lógica del juego. El lienzo se escala para adaptarse a cualquier pantalla sin deformar la escena.
          </p>
        </aside>
      </div>
    </Modal>
  )
}
