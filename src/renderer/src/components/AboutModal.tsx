import { Cpu, Download, Github, Heart, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEditorStore } from '../store/editor'
import { Modal } from './ui'

export function AboutModal() {
  const setModal = useEditorStore((state) => state.setModal)
  const [versions, setVersions] = useState<{ app: string; electron: string; chrome: string; node: string } | null>(null)

  useEffect(() => {
    void window.axiom?.app.versions().then(setVersions)
  }, [])

  return (
    <Modal title="Acerca de Axiom Engine" subtitle="Un motor de videojuegos para crear conversando." onClose={() => setModal(null)} wide>
      <div className="about-layout">
        <div className="about-hero">
          <div className="about-mark">
            <svg viewBox="0 0 32 32" width="42" height="42">
              <defs>
                <linearGradient id="about-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="55%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <path d="M16 3.5 29 27H21.2L16 16.6 10.8 27H3Z" fill="url(#about-gradient)" />
              <circle cx="16" cy="23.4" r="2.2" fill="#e0f2fe" />
            </svg>
          </div>
          <div>
            <h2>AXIOM <span>ENGINE</span></h2>
            <p className="about-version">Versión {versions?.app ?? '0.1.0'} · Alfa</p>
          </div>
        </div>
        <p className="about-description">
          Axiom es un motor 2D con un editor visual inspirado en Godot y un Copiloto de IA en el centro. Escenas, física, scripts, partículas y HUD conviven con un flujo de trabajo donde describes lo que quieres y lo ves aparecer.
        </p>
        <div className="about-features">
          <div>
            <Sparkles size={15} />
            <strong>IA primero</strong>
            <span>Chat con DeepSeek, Claude, Gemini y más; agente de cambios y contexto real.</span>
          </div>
          <div>
            <Cpu size={15} />
            <strong>Motor propio</strong>
            <span>Runtime 2D, física AABB, scripts, cámara, partículas y sonido sintetizado.</span>
          </div>
          <div>
            <Github size={15} />
            <strong>Comunidad</strong>
            <span>Repositorio público, releases y proyectos de ejemplo en GitHub.</span>
          </div>
        </div>
        <div className="about-tech">
          <span>Electron {versions?.electron ?? '—'}</span>
          <span>Chromium {versions?.chrome ?? '—'}</span>
          <span>Node {versions?.node ?? '—'}</span>
          <span>React + TypeScript</span>
        </div>
        <div className="about-links">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => window.axiom?.app.openExternal('https://github.com/otaplus/axiom-engine')}
          >
            <Github size={14} /> Ver en GitHub
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => window.axiom?.app.openExternal('https://github.com/otaplus/axiom-engine/releases/tag/v0.1.0')}
          >
            <Download size={14} /> Descargar release
          </button>
        </div>
        <div className="about-footer">
          <span>
            Hecho con <Heart size={12} /> para creadores que piensan en grande.
          </span>
          <span>Proyecto local · sin telemetría</span>
        </div>
      </div>
    </Modal>
  )
}
