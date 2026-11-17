import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEditorStore } from '../store/editor'
import { useUpdateStore } from '../store/update'
import { Modal, Spinner } from './ui'

export function UpdateModal() {
  const setModal = useEditorStore((state) => state.setModal)
  const status = useUpdateStore((state) => state.status)
  const currentVersion = useUpdateStore((state) => state.currentVersion)
  const latestVersion = useUpdateStore((state) => state.latestVersion)
  const progress = useUpdateStore((state) => state.progress ?? 0)
  const message = useUpdateStore((state) => state.message)
  const releaseNotes = useUpdateStore((state) => state.releaseNotes)
  const assetName = useUpdateStore((state) => state.assetName)
  const check = useUpdateStore((state) => state.check)
  const download = useUpdateStore((state) => state.download)
  const install = useUpdateStore((state) => state.install)
  const openRelease = useUpdateStore((state) => state.openRelease)
  const checked = useRef(false)
  const platform = window.axiom?.platform ?? 'win32'

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    if (status === 'idle') void check()
  }, [status, check])

  const checkAgain = () => void check()
  const canDownload = status === 'available' && Boolean(assetName)

  return (
    <Modal
      title="Actualizaciones"
      subtitle="Axiom comprueba GitHub Releases y puede instalar la nueva versión por ti."
      onClose={() => setModal(null)}
      wide
      footer={
        <>
          <div className="modal-footer-note">
            <span>Versión actual <strong className="mono">{currentVersion || '—'}</strong></span>
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="secondary-btn" onClick={() => void openRelease()}>
              <ExternalLink size={14} /> Ver release
            </button>
            <button type="button" className="secondary-btn" onClick={checkAgain} disabled={status === 'checking' || status === 'downloading'}>
              {status === 'checking' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              Buscar de nuevo
            </button>
            {status === 'ready' ? (
              <button type="button" className="primary-btn" onClick={() => void install()}>
                {platform === 'win32' ? <ArrowDownToLine size={14} /> : <ExternalLink size={14} />}
                {platform === 'win32' ? 'Reiniciar e instalar' : 'Abrir carpeta'}
              </button>
            ) : null}
            {canDownload ? (
              <button type="button" className="primary-btn" onClick={() => void download()}>
                <Download size={14} /> Descargar {latestVersion}
              </button>
            ) : null}
          </div>
        </>
      }
    >
      <div className="update-layout">
        <div className={`update-hero update-hero-${status}`}>
          <div className="update-icon">
            {status === 'checking' || status === 'downloading' ? (
              <Spinner size={24} />
            ) : status === 'up-to-date' ? (
              <CheckCircle2 size={25} />
            ) : status === 'available' || status === 'ready' ? (
              <Sparkles size={25} />
            ) : (
              <AlertTriangle size={25} />
            )}
          </div>
          <div>
            <h3>
              {status === 'checking'
                ? 'Buscando actualizaciones…'
                : status === 'downloading'
                  ? `Descargando Axiom ${latestVersion}…`
                  : status === 'available'
                    ? `Axiom ${latestVersion} está disponible`
                    : status === 'ready'
                      ? 'Actualización lista'
                      : status === 'up-to-date'
                        ? 'Estás al día'
                        : status === 'unsupported'
                          ? 'Actualizaciones desde la app instalada'
                          : 'No se pudo comprobar'}
            </h3>
            <p>{message || 'Comprobando GitHub Releases.'}</p>
          </div>
        </div>

        {status === 'downloading' ? (
          <div className="update-progress">
            <div className="update-progress-head">
              <span>Descargando instalador</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>Se verifica el SHA-256 antes de instalar. No cierres Axiom.</small>
          </div>
        ) : null}

        {status === 'ready' ? (
          <div className="update-success">
            <CheckCircle2 size={15} />
            <span>
              {platform === 'win32'
                ? 'El instalador se descargó y verificó. Al instalar, Axiom se cerrará, aplicará la actualización y volverá a abrirse.'
                : 'El paquete se descargó. En Linux puedes abrir la carpeta y usar el nuevo AppImage o paquete manualmente.'}
            </span>
          </div>
        ) : null}

        {releaseNotes ? (
          <details className="update-notes" open={status !== 'up-to-date'}>
            <summary>Notas de la versión {latestVersion}</summary>
            <div className="update-notes-body markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{releaseNotes}</ReactMarkdown>
            </div>
          </details>
        ) : null}

        <div className="update-details">
          <div><span>Versión actual</span><strong className="mono">{currentVersion || '—'}</strong></div>
          <div><span>Última detectada</span><strong className="mono">{latestVersion || '—'}</strong></div>
          <div><span>Plataforma</span><strong>{platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : platform}</strong></div>
          <div><span>Origen</span><strong>GitHub Releases</strong></div>
        </div>
        <p className="update-footnote">
          Axiom consulta el repositorio público <span className="mono">otaplus/axiom-engine</span>. Las actualizaciones de Windows se instalan con el instalador; en Linux se descarga el paquete para reemplazo manual.
        </p>
      </div>
    </Modal>
  )
}
