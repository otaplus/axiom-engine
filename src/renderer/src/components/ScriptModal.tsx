import { Code2, Keyboard, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { useEffect, useMemo, useState } from 'react'
import { validateScriptSyntax, scriptTemplate } from '../engine/script'
import { useEditorStore } from '../store/editor'
import { Kbd, Modal } from './ui'

export function ScriptModal() {
  const scriptNodeId = useEditorStore((state) => state.scriptNodeId)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const project = useEditorStore((state) => state.project)
  const setNodeScript = useEditorStore((state) => state.setNodeScript)
  const setModal = useEditorStore((state) => state.setModal)
  const scene = project.scenes.find((item) => item.id === activeSceneId) ?? project.scenes[0]
  const findNode = (root: any, id: string | null): any => {
    if (!root || !id) return null
    if (root.id === id) return root
    for (const child of root.children) {
      const found = findNode(child, id)
      if (found) return found
    }
    return null
  }
  const node = findNode(scene.root, scriptNodeId ?? selectedNodeId)
  const [code, setCode] = useState(node?.script ?? '')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const error = useMemo(() => validateScriptSyntax(code), [code])

  useEffect(() => {
    setCode(node?.script ?? '')
    setSavedAt(null)
  }, [node?.id, node?.script])

  const save = () => {
    if (!node || error) return
    setNodeScript(node.id, code)
    setSavedAt(Date.now())
    setModal(null)
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (!node) return null

  return (
    <Modal
      title={`Script · ${node.name}`}
      subtitle="Comportamiento en JavaScript. Solo métodos: _ready, _process, _physics_process y callbacks."
      onClose={() => setModal(null)}
      wide
      footer={
        <>
          <div className="modal-footer-note">
            {error ? (
              <span className="script-syntax is-error">Error de sintaxis: {error}</span>
            ) : (
              <span className="script-syntax is-ok"><Code2 size={13} /> Sintaxis válida</span>
            )}
          </div>
          <div className="modal-footer-actions">
            {node.script ? (
              <button
                type="button"
                className="secondary-btn danger"
                onClick={() => {
                  setNodeScript(node.id, undefined)
                  setModal(null)
                }}
              >
                <Trash2 size={14} /> Quitar script
              </button>
            ) : null}
            <button type="button" className="secondary-btn" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className="primary-btn" onClick={save} disabled={Boolean(error)}>
              <Code2 size={14} /> Guardar script
            </button>
          </div>
        </>
      }
    >
      <div className="script-layout">
        <div className="script-editor-wrap">
          <div className="script-editor-toolbar">
            <span className="script-file-name">{node.name}.js</span>
            <span className="script-editor-meta">JavaScript · contexto Axiom</span>
            <button
              type="button"
              className="subtle-btn"
              onClick={() => setCode(scriptTemplate(node.type))}
              title="Sustituir por una plantilla base"
            >
              <WandSparkles size={13} /> Insertar plantilla
            </button>
          </div>
          <CodeMirror
            value={code}
            height="430px"
            theme="dark"
            extensions={[javascript({ jsx: false })]}
            onChange={setCode}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              indentOnInput: true,
              tabSize: 2
            }}
            className="code-mirror"
          />
          <div className="script-editor-status">
            <span><Keyboard size={12} /> <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> guardar</span>
            <span>{code.split('\n').length} líneas</span>
            {savedAt ? <span className="saved-flash">Guardado</span> : null}
          </div>
        </div>
        <aside className="script-cheatsheet">
          <div className="cheatsheet-head">
            <Sparkles size={14} />
            <strong>Contexto del script</strong>
          </div>
          <div className="cheat-block">
            <h4>Hooks</h4>
            <code>_ready()</code>
            <code>_process(dt)</code>
            <code>_physics_process(dt)</code>
            <code>_on_timeout()</code>
            <code>_on_area_entered(otro)</code>
          </div>
          <div className="cheat-block">
            <h4>Nodo</h4>
            <code>this.x / this.y</code>
            <code>this.velocity</code>
            <code>this.on_floor</code>
            <code>this.move_and_slide(dt)</code>
            <code>this.get_node("Nombre")</code>
            <code>this.spawn("Bala", x, y)</code>
            <code>this.overlaps("enemy")</code>
            <code>this.queue_free()</code>
          </div>
          <div className="cheat-block">
            <h4>Juego</h4>
            <code>Game.add_score(10)</code>
            <code>Game.lives -= 1</code>
            <code>Game.game_over(false, "…")</code>
            <code>Game.on("evento", fn)</code>
            <code>this.play_sound("coin")</code>
            <code>this.shake(8, 0.25)</code>
          </div>
          <div className="cheat-block">
            <h4>Entrada</h4>
            <code>Input.get_axis("left","right")</code>
            <code>Input.is_action_just_pressed("jump")</code>
            <code>Input.mouse_world</code>
          </div>
          <p className="cheatsheet-tip">Pídele al Copiloto que escriba o modifique este script por ti usando lenguaje natural.</p>
        </aside>
      </div>
    </Modal>
  )
}
