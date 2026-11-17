import { Command, Gamepad2, MousePointer2 } from 'lucide-react'
import { useEditorStore } from '../store/editor'
import { Kbd, Modal } from './ui'

const GROUPS = [
  {
    title: 'Proyecto',
    icon: <Command size={14} />,
    items: [
      ['Guardar proyecto', ['Ctrl', 'S']],
      ['Guardar como', ['Ctrl', 'Shift', 'S']],
      ['Abrir proyecto', ['Ctrl', 'O']],
      ['Nuevo proyecto', ['Ctrl', 'N']]
    ]
  },
  {
    title: 'Edición',
    icon: <MousePointer2 size={14} />,
    items: [
      ['Deshacer', ['Ctrl', 'Z']],
      ['Rehacer', ['Ctrl', 'Y']],
      ['Duplicar nodo', ['Ctrl', 'D']],
      ['Eliminar nodo', ['Supr']],
      ['Renombrar nodo', ['Doble clic']],
      ['Abrir script del nodo', ['Doble clic en escena']]
    ]
  },
  {
    title: 'Escena',
    icon: <Gamepad2 size={14} />,
    items: [
      ['Mover la vista', ['Espacio', 'Arrastrar']],
      ['Zoom', ['Rueda']],
      ['Ajustar escena', ['Botón ajustar']],
      ['Mostrar cuadrícula', ['G']],
      ['Mostrar colisiones', ['C']],
      ['Reproducir / detener', ['F5']],
      ['Detener partida', ['Shift', 'F5']]
    ]
  }
]

export function ShortcutsModal() {
  const setModal = useEditorStore((state) => state.setModal)
  return (
    <Modal title="Atajos y controles" subtitle="Todo lo que necesitas para moverte por Axiom sin soltar el teclado." onClose={() => setModal(null)} wide>
      <div className="shortcut-grid">
        {GROUPS.map((group) => (
          <div className="shortcut-group" key={group.title}>
            <h3>
              {group.icon} {group.title}
            </h3>
            {group.items.map(([label, keys]) => (
              <div className="shortcut-row" key={label as string}>
                <span>{label}</span>
                <span className="shortcut-keys">
                  {(keys as string[]).map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="shortcut-note">
        <strong>Controles de juego por defecto:</strong> flechas o WASD para moverte, Espacio para saltar, J para disparar, Esc para pausar y R para reiniciar. Puedes cambiarlos en los scripts usando <code>Input</code>.
      </div>
    </Modal>
  )
}
