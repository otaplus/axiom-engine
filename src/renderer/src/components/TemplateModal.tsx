import { ArrowRight, Gamepad2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { TEMPLATE_INFO, type TemplateId } from '../templates'
import { useEditorStore } from '../store/editor'
import { Modal } from './ui'

export function TemplateModal() {
  const setModal = useEditorStore((state) => state.setModal)
  const newProject = useEditorStore((state) => state.newProject)
  const [selected, setSelected] = useState<TemplateId>('platformer')

  return (
    <Modal
      title="Nuevo proyecto"
      subtitle="Elige un punto de partida. Podrás cambiarlo todo conversando con el Copiloto."
      onClose={() => setModal(null)}
      wide
      footer={
        <>
          <div className="modal-footer-note">
            <Sparkles size={14} /> El proyecto actual queda en el autoguardado.
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="secondary-btn" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className="primary-btn" onClick={() => newProject(selected)}>
              Crear proyecto <ArrowRight size={14} />
            </button>
          </div>
        </>
      }
    >
      <div className="template-grid">
        {TEMPLATE_INFO.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`template-card ${selected === template.id ? 'is-active' : ''}`}
            onClick={() => setSelected(template.id)}
            style={{ '--template-accent': template.accent } as React.CSSProperties}
          >
            <div className={`template-art art-${template.id}`}>
              {template.id === 'platformer' ? (
                <>
                  <span className="art-moon">✦</span>
                  <span className="art-hill hill-a" />
                  <span className="art-hill hill-b" />
                  <span className="art-platform p1" />
                  <span className="art-platform p2" />
                  <span className="art-hero">🦊</span>
                  <span className="art-coin c1"><span className="mini-coin" /></span>
                  <span className="art-coin c2"><span className="mini-coin" /></span>
                </>
              ) : template.id === 'shooter' ? (
                <>
                  <span className="art-planet" />
                  <span className="art-ship">🚀</span>
                  <span className="art-enemy e1">👾</span>
                  <span className="art-enemy e2">👾</span>
                  <span className="art-bullet" />
                </>
              ) : (
                <>
                  <span className="art-grid" />
                  <span className="art-hero empty-hero">🦊</span>
                  <span className="art-platform empty-floor" />
                </>
              )}
              <span className="art-vignette" />
            </div>
            <div className="template-meta">
              <span className="template-tag" style={{ color: template.accent }}>
                {template.tag}
              </span>
              <strong>{template.name}</strong>
              <p>{template.description}</p>
              <span className="template-cta">
                {selected === template.id ? 'Seleccionado' : 'Elegir plantilla'}
                <ArrowRight size={13} />
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="template-tip">
        <Gamepad2 size={15} />
        <span>
          ¿Prefieres empezar con una idea? Elige cualquier plantilla y escribe <strong>“créame un juego nuevo de…”</strong> en el Copiloto.
        </span>
      </div>
    </Modal>
  )
}
