import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  KeyRound,
  Loader2,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  User,
  WandSparkles,
  X
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { visibleDuringStream } from '../ai/parser'
import { activeScene, selectedNode, useEditorStore } from '../store/editor'
import { useAIStore, type ChatMessage } from '../store/ai'
import { useSettingsStore } from '../store/settings'
import { IconButton, Spinner } from './ui'

const SUGGESTIONS = [
  { icon: '⚔️', title: 'Un jefe final', prompt: 'Añade un jefe final con tres ataques distintos, barra de vida y una recompensa al derrotarlo.' },
  { icon: '🧱', title: 'Más plataformas', prompt: 'Crea un nivel secreto encima del actual, con plataformas móviles, monedas y un portal de salida.' },
  { icon: '🔫', title: 'Poder de disparo', prompt: 'Haz que el jugador pueda disparar proyectiles con la tecla J, con efecto de partículas y sonido.' },
  { icon: '🌧️', title: 'Cambiar el ambiente', prompt: 'Cambia el ambiente a una noche cyberpunk con lluvia de partículas, nuevos colores y un HUD más elegante.' }
]

export function Copilot() {
  const messages = useAIStore((state) => state.messages)
  const isStreaming = useAIStore((state) => state.isStreaming)
  const autoApply = useAIStore((state) => state.autoApply)
  const error = useAIStore((state) => state.error)
  const send = useAIStore((state) => state.send)
  const abort = useAIStore((state) => state.abort)
  const setAutoApply = useAIStore((state) => state.setAutoApply)
  const applyMessageActions = useAIStore((state) => state.applyMessageActions)
  const discardMessageActions = useAIStore((state) => state.discardMessageActions)
  const clearConversation = useAIStore((state) => state.clearConversation)
  const retryLast = useAIStore((state) => state.retryLast)
  const project = useEditorStore((state) => state.project)
  const activeSceneId = useEditorStore((state) => state.activeSceneId)
  const selected = useEditorStore(selectedNode)
  const scene = useEditorStore(activeScene)
  const setModal = useEditorStore((state) => state.setModal)
  const setCopilotOpen = useEditorStore((state) => state.setCopilotOpen)
  const log = useEditorStore((state) => state.log)
  const undo = useEditorStore((state) => state.undo)
  const settings = useSettingsStore((state) => state.settings)
  const loadSettings = useSettingsStore((state) => state.load)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!settings) void loadSettings()
  }, [settings, loadSettings])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    if (messages.length === 0) {
      element.scrollTop = 0
      return
    }
    element.scrollTo({ top: element.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' })
  }, [messages, isStreaming, error])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(150, Math.max(48, textarea.scrollHeight))}px`
  }, [input])

  const context = { project, activeSceneId, selectedNodeId: selected?.id ?? null }

  const connected = Boolean(settings?.hasApiKey || settings?.requiresApiKey === false)
  const requireKey = (): boolean => {
    if (connected) return true
    setModal('ai-settings')
    return false
  }

  const submit = async (prompt?: string) => {
    const text = (prompt ?? input).trim()
    if (!text || isStreaming) return
    if (!requireKey()) return
    setInput('')
    await send(text, context)
  }

  const retry = async () => {
    if (!requireKey()) return
    await retryLast(context)
  }

  return (
    <section className="copilot-panel">
      <div className="copilot-header">
        <div className="copilot-identity">
          <span className="copilot-avatar">
            <Sparkles size={14} />
          </span>
          <div>
            <div className="copilot-title">
              Copiloto <span className="copilot-alpha">IA</span>
            </div>
            <div className="copilot-subtitle">
              <span className={`status-dot ${connected ? 'is-online' : ''}`} />
              {connected ? settings?.model : 'Conecta un proveedor'}
            </div>
          </div>
        </div>
        <div className="copilot-header-actions">
          <IconButton title="Nueva conversación" onClick={() => clearConversation()} disabled={!messages.length}>
            <Trash2 size={14} />
          </IconButton>
          <IconButton title="Ajustes de IA" onClick={() => setModal('ai-settings')}>
            <Settings2 size={14} />
          </IconButton>
          <IconButton title="Ocultar Copiloto" onClick={() => setCopilotOpen(false)}>
            <ChevronDown size={15} />
          </IconButton>
        </div>
      </div>

      <div className="copilot-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <Welcome onSuggestion={(prompt) => submit(prompt)} connected={connected} onConnect={() => setModal('ai-settings')} />
        ) : (
          <div className="chat-thread">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                onApply={() => applyMessageActions(message.id)}
                onDiscard={() => discardMessageActions(message.id)}
                onUndo={() => {
                  undo()
                  log('info', 'Cambios del Copiloto revertidos')
                }}
              />
            ))}
            {isStreaming ? (
              <div className="chat-stream-status">
                <Spinner size={12} />
                <span>El Copiloto está trabajando…</span>
                <button type="button" onClick={() => void abort()} className="mini-stop">
                  <Square size={10} fill="currentColor" /> Detener
                </button>
              </div>
            ) : null}
            {error ? (
              <div className="chat-error-banner">
                <AlertTriangle size={14} />
                <div>
                  <strong>No se pudo completar la respuesta</strong>
                  <p>{error}</p>
                </div>
                <div className="chat-error-actions">
                  <button type="button" onClick={() => void retry()} className="mini-btn">
                    <RotateCcw size={12} /> Reintentar
                  </button>
                  <button type="button" onClick={() => useAIStore.getState().setError(null)} className="mini-btn ghost">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="composer">
        <div className="composer-context">
          <span className="context-pill">
            <span className="context-dot" /> {scene?.name ?? 'Escena'}
          </span>
          {selected ? <span className="context-pill muted">{selected.name}</span> : null}
          <button
            type="button"
            className={`agent-toggle ${autoApply ? 'is-on' : ''}`}
            onClick={() => setAutoApply(!autoApply)}
            title="Cuando está activo, el Copiloto aplica los cambios automáticamente"
          >
            <Bot size={12} /> Agente
          </button>
          <span className="composer-spacer" />
          {connected ? (
            <span className="model-chip" title="Modelo configurado">
              {settings?.model}
            </span>
          ) : (
            <button type="button" className="connect-chip" onClick={() => setModal('ai-settings')}>
              <KeyRound size={11} /> Conectar
            </button>
          )}
        </div>
        <div className="composer-box">
          <textarea
            ref={textareaRef}
            value={input}
            rows={2}
            placeholder="Describe un juego, una mecánica o un cambio…"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
            disabled={isStreaming}
          />
          <div className="composer-actions">
            <span className="composer-hint">Enter envía · Shift+Enter salto</span>
            {isStreaming ? (
              <button type="button" className="send-btn stop" onClick={() => void abort()} title="Detener generación">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button type="button" className="send-btn" onClick={() => void submit()} disabled={!input.trim()} title="Enviar mensaje">
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="composer-footer">
          <Sparkles size={11} />
          <span>{autoApply ? 'Modo agente: los cambios se aplican solos' : 'Modo consejo: revisarás cada cambio'}</span>
        </div>
      </div>
    </section>
  )
}

function Welcome({ onSuggestion, connected, onConnect }: { onSuggestion: (prompt: string) => void; connected: boolean; onConnect: () => void }) {
  return (
    <div className="copilot-welcome">
      <div className="welcome-glow">
        <div className="welcome-orb">
          <WandSparkles size={24} />
        </div>
      </div>
      <h2>Describe. Crea. Juega.</h2>
      <p className="welcome-lead">
        Conozco la escena, los scripts y los assets. Cuéntame qué quieres construir y lo haré por ti.
      </p>
      {!connected ? (
        <button type="button" className="connect-banner" onClick={onConnect}>
          <span className="connect-banner-icon">
            <KeyRound size={16} />
          </span>
          <span>
            <strong>Conecta DeepSeek para empezar</strong>
            <small>Tu clave se guarda cifrada en este equipo</small>
          </span>
          <span className="connect-arrow">→</span>
        </button>
      ) : null}
      <div className="suggestion-grid">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion.title} type="button" className="suggestion-card" onClick={() => onSuggestion(suggestion.prompt)} disabled={!connected}>
            <span className="suggestion-icon">{suggestion.icon}</span>
            <span>
              <strong>{suggestion.title}</strong>
              <small>{suggestion.prompt}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="welcome-footnote">
        <Bot size={12} /> El Copiloto puede editar escenas, crear scripts y añadir assets.
      </div>
    </div>
  )
}

function ChatBubble({
  message,
  onApply,
  onDiscard,
  onUndo
}: {
  message: ChatMessage
  onApply: () => void
  onDiscard: () => void
  onUndo: () => void
}) {
  const [showReasoning, setShowReasoning] = useState(false)
  const isUser = message.role === 'user'
  const content = message.streaming ? visibleDuringStream(message.content) : message.content
  const pendingActions = Boolean(message.actions?.length && !message.applied && !message.actionErrors?.length)
  const applied = Boolean(message.applied)

  return (
    <div className={`chat-message ${isUser ? 'is-user' : 'is-assistant'}`}>
      <div className={`chat-avatar ${isUser ? 'is-user' : 'is-ai'}`}>{isUser ? <User size={13} /> : <Sparkles size={13} />}</div>
      <div className="chat-content">
        <div className="chat-meta">
          <strong>{isUser ? 'Tú' : 'Axiom Copilot'}</strong>
          <span>{formatClock(message.createdAt)}</span>
          {!isUser && message.streaming ? <span className="chat-live">generando</span> : null}
        </div>
        {message.reasoning ? (
          <div className="reasoning-block">
            <button type="button" onClick={() => setShowReasoning(!showReasoning)}>
              <ChevronDown size={12} className={showReasoning ? 'rotated' : ''} /> Razonamiento
            </button>
            {showReasoning ? <pre>{message.reasoning}</pre> : null}
          </div>
        ) : null}
        {isUser ? (
          <div className="user-bubble">{message.content}</div>
        ) : (
          <div className="assistant-text markdown">
            {content ? (
              <MarkdownContent content={content} />
            ) : message.streaming ? (
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            {message.streaming && content ? <span className="stream-caret" /> : null}
          </div>
        )}

        {message.actions?.length ? (
          <div className={`action-card ${applied ? 'is-applied' : pendingActions ? 'is-pending' : 'is-error'}`}>
            <div className="action-card-head">
              <div className="action-title">
                <span className="action-icon">{applied ? <Check size={13} /> : pendingActions ? <WandSparkles size={13} /> : <AlertTriangle size={13} />}</span>
                <strong>
                  {applied
                    ? `${message.actionDescriptions?.length ?? message.actions.length} cambio${(message.actionDescriptions?.length ?? 1) !== 1 ? 's' : ''} aplicado${(message.actionDescriptions?.length ?? 1) !== 1 ? 's' : ''}`
                    : pendingActions
                      ? `${message.actions.length} cambio${message.actions.length !== 1 ? 's' : ''} propuesto${message.actions.length !== 1 ? 's' : ''}`
                      : 'No se pudieron aplicar los cambios'}
                </strong>
              </div>
              {applied ? (
                <button type="button" className="mini-btn ghost" onClick={onUndo} title="Deshacer estos cambios">
                  <Undo2 size={12} /> Deshacer
                </button>
              ) : null}
            </div>
            {message.actionDescriptions?.length ? (
              <ul className="action-list">
                {message.actionDescriptions.slice(0, 10).map((description, index) => (
                  <li key={index}>
                    <Check size={11} /> {description}
                  </li>
                ))}
              </ul>
            ) : null}
            {message.actionErrors?.length ? (
              <div className="action-errors">
                {message.actionErrors.map((actionError, index) => (
                  <div key={index}>
                    <AlertTriangle size={11} /> {actionError}
                  </div>
                ))}
              </div>
            ) : null}
            {pendingActions ? (
              <div className="action-actions">
                <button type="button" className="secondary-btn ghost small" onClick={onDiscard}>
                  Descartar
                </button>
                <button type="button" className="primary-btn small" onClick={onApply}>
                  <WandSparkles size={13} /> Aplicar cambios
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {message.error && !message.actions?.length ? (
          <div className="message-error">
            <AlertTriangle size={12} /> {message.error}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }: { href?: string; children?: ReactNode }) => (
          <a
            href={href}
            onClick={(event) => {
              event.preventDefault()
              if (href) void window.axiom?.app.openExternal(href)
            }}
          >
            {children}
          </a>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
