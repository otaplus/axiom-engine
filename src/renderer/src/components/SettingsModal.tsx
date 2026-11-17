import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, PlugZap, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEditorStore } from '../store/editor'
import { useSettingsStore } from '../store/settings'
import { Field, Modal, Select, TextInput } from './ui'

const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tag: 'Recomendado',
    logo: 'DS',
    description: 'Rápido y económico. Excelente escribiendo lógica de juego y scripts.',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tag: 'Popular',
    logo: 'OA',
    description: 'GPT-4o y modelos compatibles con Chat Completions.',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    tag: 'Claude',
    logo: 'AN',
    description: 'Claude Sonnet y Opus mediante la API nativa de Anthropic.',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',
    keyUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'google',
    name: 'Google Gemini',
    tag: 'Gemini',
    logo: 'GE',
    description: 'Gemini 2.5 a través del endpoint compatible con OpenAI.',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    tag: 'Grok',
    logo: 'XA',
    description: 'Modelos Grok para razonamiento, código y conversación.',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-3',
    keyUrl: 'https://console.x.ai'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tag: 'Multi-modelo',
    logo: 'OR',
    description: 'DeepSeek, Claude, Gemini y más con una sola clave.',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    keyUrl: 'https://openrouter.ai/keys'
  },
  {
    id: 'groq',
    name: 'Groq',
    tag: 'Ultrarrápido',
    logo: 'GQ',
    description: 'Inferencia de modelos abiertos con muy baja latencia.',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    tag: 'Europa',
    logo: 'MI',
    description: 'Mistral Large y Codestral, con API compatible con OpenAI.',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-large-latest',
    keyUrl: 'https://console.mistral.ai/api-keys'
  },
  {
    id: 'together',
    name: 'Together AI',
    tag: 'Open source',
    logo: 'TA',
    description: 'Catálogo amplio de modelos abiertos y endpoints dedicados.',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    keyUrl: 'https://api.together.xyz/settings/api-keys'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    tag: 'Búsqueda web',
    logo: 'PX',
    description: 'Modelos Sonar con búsqueda web y respuestas actualizadas.',
    baseUrl: 'https://api.perplexity.ai',
    model: 'sonar-pro',
    keyUrl: 'https://www.perplexity.ai/settings/api'
  },
  {
    id: 'github',
    name: 'GitHub Models',
    tag: 'GitHub',
    logo: 'GH',
    description: 'Modelos de OpenAI, Meta y otros con un token de GitHub.',
    baseUrl: 'https://models.github.ai/inference',
    model: 'openai/gpt-4o-mini',
    keyUrl: 'https://github.com/settings/personal-access-tokens'
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    tag: 'Open source',
    logo: 'HF',
    description: 'Router de Inference Providers con catálogo abierto.',
    baseUrl: 'https://router.huggingface.co/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    keyUrl: 'https://huggingface.co/settings/tokens'
  },
  {
    id: 'ollama',
    name: 'Ollama local',
    tag: 'Sin nube',
    logo: 'OL',
    description: 'Ejecuta modelos en tu equipo. Sin coste por token.',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    keyUrl: ''
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    tag: 'Local',
    logo: 'LM',
    description: 'Modelos locales desde la interfaz de LM Studio.',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    keyUrl: ''
  },
  {
    id: 'vllm',
    name: 'vLLM',
    tag: 'Autoalojado',
    logo: 'vL',
    description: 'Servidor OpenAI-compatible para tu propia infraestructura.',
    baseUrl: 'http://localhost:8000/v1',
    model: 'local-model',
    keyUrl: ''
  },
  {
    id: 'custom',
    name: 'Personalizado',
    tag: 'API propia',
    logo: 'API',
    description: 'Cualquier endpoint compatible con OpenAI Chat Completions.',
    baseUrl: 'https://api.example.com/v1',
    model: '',
    keyUrl: ''
  }
] as const

export function SettingsModal() {
  const setModal = useEditorStore((state) => state.setModal)
  const settings = useSettingsStore((state) => state.settings)
  const saving = useSettingsStore((state) => state.saving)
  const testing = useSettingsStore((state) => state.testing)
  const testResult = useSettingsStore((state) => state.testResult)
  const models = useSettingsStore((state) => state.models)
  const modelsLoading = useSettingsStore((state) => state.modelsLoading)
  const load = useSettingsStore((state) => state.load)
  const save = useSettingsStore((state) => state.save)
  const test = useSettingsStore((state) => state.test)
  const fetchModels = useSettingsStore((state) => state.fetchModels)
  const [provider, setProvider] = useState(settings?.provider ?? 'deepseek')
  const [baseUrl, setBaseUrl] = useState(settings?.baseUrl ?? 'https://api.deepseek.com/v1')
  const [model, setModel] = useState(settings?.model ?? 'deepseek-chat')
  const [temperature, setTemperature] = useState(settings?.temperature ?? 0.7)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (!settings) void load()
  }, [settings, load])

  useEffect(() => {
    if (!settings) return
    setProvider(settings.provider)
    setBaseUrl(settings.baseUrl)
    setModel(settings.model)
    setTemperature(settings.temperature)
  }, [settings])

  const selectProvider = (id: string) => {
    const preset = PROVIDERS.find((item) => item.id === id)
    setProvider(id as typeof provider)
    if (preset && id !== 'custom') {
      setBaseUrl(preset.baseUrl)
      setModel(preset.model)
    }
  }

  const handleSave = async (): Promise<boolean> => {
    const ok = await save({
      provider,
      baseUrl,
      model,
      temperature,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
    })
    if (ok) {
      setApiKey('')
      setModal(null)
    }
    return ok
  }

  const handleTest = async () => {
    const saved = await save({
      provider,
      baseUrl,
      model,
      temperature,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
    })
    if (!saved) return
    setApiKey('')
    await test()
  }

  const clearKey = async () => {
    await save({ apiKey: null })
    setApiKey('')
  }

  return (
    <Modal
      title="Conexión de IA"
      subtitle="Elige el cerebro que construirá tus juegos. La clave se guarda cifrada en tu equipo."
      onClose={() => setModal(null)}
      wide
      footer={
        <>
          <div className="modal-footer-note">
            <ShieldCheck size={14} />
            {settings?.hasApiKey && !settings.keyEncrypted && !settings.fromEnvironment
              ? 'Guardada localmente; el llavero del sistema no está disponible'
              : 'Cifrado local con el almacén seguro del sistema'}
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="secondary-btn" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className="primary-btn" onClick={handleSave} disabled={saving || !model.trim()}>
              {saving ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              Guardar y usar
            </button>
          </div>
        </>
      }
    >
      <div className="settings-grid">
        <div className="settings-main">
          <div className="settings-section-title">Proveedor</div>
          <div className="provider-grid">
            {PROVIDERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`provider-card ${provider === item.id ? 'is-active' : ''}`}
                onClick={() => selectProvider(item.id)}
              >
                <div className="provider-top">
                  <span className={`provider-logo provider-${item.id}`}>{item.logo}</span>
                  <span className="provider-tag">{item.tag}</span>
                  {provider === item.id ? <CheckCircle2 size={15} className="provider-check" /> : null}
                </div>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
              </button>
            ))}
          </div>

          <div className="settings-section-title">Credenciales</div>
          <div className="settings-card">
            <Field label="Clave API" hint={settings?.fromEnvironment ? 'Se está usando una clave de las variables de entorno.' : undefined}>
              <div className="key-input-row">
                <KeyRound size={14} className="key-icon" />
                <input
                  className="text-input mono key-input"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={settings?.hasApiKey ? `Guardada ${settings.keyHint} · escribe para reemplazar` : 'sk-…'}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className="key-visibility" onClick={() => setShowKey(!showKey)} title={showKey ? 'Ocultar clave' : 'Mostrar clave'}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <div className="key-meta-row">
              <span className={`key-status ${settings?.hasApiKey || settings?.requiresApiKey === false ? 'is-ok' : 'is-empty'}`}>
                {settings?.hasApiKey || settings?.requiresApiKey === false ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {settings?.hasApiKey
                  ? 'Clave configurada'
                  : settings?.requiresApiKey === false
                    ? 'Sin clave necesaria (proveedor local)'
                    : 'Sin clave todavía'}
              </span>
              {settings?.hasApiKey && !settings.fromEnvironment ? (
                <button type="button" className="link-btn danger" onClick={clearKey}>
                  Eliminar clave
                </button>
              ) : null}
              {PROVIDERS.find((item) => item.id === provider)?.keyUrl ? (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => window.axiom?.app.openExternal(PROVIDERS.find((item) => item.id === provider)!.keyUrl)}
                >
                  Obtener clave de {PROVIDERS.find((item) => item.id === provider)?.name} <ExternalLink size={11} />
                </button>
              ) : null}
            </div>
          </div>

          <button type="button" className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? 'Ocultar' : 'Mostrar'} ajustes avanzados
          </button>
          {showAdvanced ? (
            <div className="settings-card">
              <Field label="URL base" hint="Debe ser compatible con OpenAI Chat Completions. Normalmente termina en /v1.">
                <TextInput value={baseUrl} onChange={setBaseUrl} mono />
              </Field>
              <Field label="Modelo">
                <div className="model-input-row">
                  <input className="text-input mono" value={model} onChange={(event) => setModel(event.target.value)} list="axiom-model-list" />
                  <datalist id="axiom-model-list">
                    {models.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                  <button type="button" className="secondary-btn small" onClick={fetchModels} disabled={modelsLoading}>
                    {modelsLoading ? <Loader2 size={13} className="spin" /> : <PlugZap size={13} />}
                    Detectar
                  </button>
                </div>
              </Field>
              <Field label={`Temperatura · ${temperature.toFixed(1)}`} hint="Baja = más determinista. Alta = más creativa.">
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.1}
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  className="range-input"
                />
              </Field>
            </div>
          ) : (
            <div className="settings-summary-row">
              <span className="mono muted">{baseUrl.replace(/^https?:\/\//, '')}</span>
              <span className="mono">{model || 'sin modelo'}</span>
            </div>
          )}

          <div className="settings-test-row">
            <button type="button" className="secondary-btn" onClick={handleTest} disabled={testing || saving}>
              {testing ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />}
              Probar conexión
            </button>
            {testResult ? (
              <span className={`test-result ${testResult.ok ? 'is-ok' : 'is-error'}`}>
                {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {testResult.message}
              </span>
            ) : null}
          </div>
        </div>

        <aside className="settings-aside">
          <div className="settings-aside-art">
            <div className="ai-orb">
              <span />
              <span />
              <span />
            </div>
            <h3>Tu estudio,<br />en una conversación.</h3>
            <p>El Copiloto conoce el árbol de escena, los scripts y los assets de tu proyecto. Puede crear niveles completos o cambiar un solo detalle.</p>
          </div>
          <div className="settings-facts">
            <div>
              <strong>Proveedores</strong>
              <span>16 integraciones</span>
            </div>
            <div>
              <strong>Compatibilidad</strong>
              <span>OpenAI + Anthropic</span>
            </div>
            <div>
              <strong>Contexto</strong>
              <span>Escena + scripts</span>
            </div>
            <div>
              <strong>Modo agente</strong>
              <span>Aplica cambios</span>
            </div>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={14} />
            <p>Tu clave nunca se envía al renderer ni a terceros. Las peticiones salen desde el proceso principal de Electron directamente al proveedor que elijas.</p>
          </div>
        </aside>
      </div>
    </Modal>
  )
}
