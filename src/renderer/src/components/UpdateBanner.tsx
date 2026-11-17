import { ArrowDownToLine, Download, ExternalLink, Sparkles, X } from 'lucide-react'
import { useEditorStore } from '../store/editor'
import { useUpdateStore } from '../store/update'
import { IconButton } from './ui'

export function UpdateBanner() {
  const status = useUpdateStore((state) => state.status)
  const latestVersion = useUpdateStore((state) => state.latestVersion)
  const progress = useUpdateStore((state) => state.progress ?? 0)
  const message = useUpdateStore((state) => state.message)
  const assetName = useUpdateStore((state) => state.assetName)
  const dismissed = useUpdateStore((state) => state.dismissed)
  const download = useUpdateStore((state) => state.download)
  const install = useUpdateStore((state) => state.install)
  const openRelease = useUpdateStore((state) => state.openRelease)
  const dismiss = useUpdateStore((state) => state.dismiss)
  const setModal = useEditorStore((state) => state.setModal)
  const platform = window.axiom?.platform ?? 'win32'

  if (dismissed || !['available', 'downloading', 'ready'].includes(status)) return null

  return (
    <div className={`update-banner update-banner-${status}`} role="status">
      <div className="update-banner-icon">
        {status === 'ready' ? <ArrowDownToLine size={17} /> : <Sparkles size={17} />}
      </div>
      <div className="update-banner-copy">
        <strong>
          {status === 'available'
            ? `Axiom ${latestVersion} disponible`
            : status === 'downloading'
              ? `Descargando la actualización ${progress}%`
              : 'Actualización lista para instalar'}
        </strong>
        <span>
          {status === 'downloading'
            ? 'Verificaremos el instalador antes de aplicarlo.'
            : status === 'ready'
              ? platform === 'win32'
                ? 'Se reiniciará Axiom para aplicar la nueva versión.'
                : 'El paquete está listo en la carpeta de actualizaciones.'
              : message || 'Hay una nueva versión publicada en GitHub.'}
        </span>
        {status === 'downloading' ? (
          <div className="update-banner-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        <div className="update-banner-actions">
          {status === 'available' && assetName ? (
            <button type="button" className="mini-primary" onClick={() => void download()}>
              <Download size={12} /> Actualizar
            </button>
          ) : null}
          {status === 'available' && !assetName ? (
            <button type="button" className="mini-primary" onClick={() => void openRelease()}>
              <ExternalLink size={12} /> Ver release
            </button>
          ) : null}
          {status === 'ready' ? (
            <button type="button" className="mini-primary" onClick={() => void install()}>
              <ArrowDownToLine size={12} /> {platform === 'win32' ? 'Reiniciar e instalar' : 'Abrir carpeta'}
            </button>
          ) : null}
          {status === 'available' ? (
            <button type="button" className="mini-link" onClick={() => setModal('updates')}>
              Detalles
            </button>
          ) : null}
        </div>
      </div>
      <IconButton title="Más tarde" onClick={dismiss} className="update-banner-close">
        <X size={13} />
      </IconButton>
    </div>
  )
}
