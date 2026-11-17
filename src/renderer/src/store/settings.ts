import { create } from 'zustand'

export const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  google: 'Google Gemini',
  xai: 'xAI Grok',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  mistral: 'Mistral AI',
  together: 'Together AI',
  perplexity: 'Perplexity',
  github: 'GitHub Models',
  huggingface: 'Hugging Face',
  ollama: 'Ollama local',
  lmstudio: 'LM Studio',
  vllm: 'vLLM',
  custom: 'Personalizado'
}

export function providerName(id: string): string {
  return PROVIDER_NAMES[id] ?? id
}

export interface PublicSettings {
  provider:
    | 'deepseek'
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'xai'
    | 'openrouter'
    | 'groq'
    | 'mistral'
    | 'together'
    | 'perplexity'
    | 'github'
    | 'huggingface'
    | 'ollama'
    | 'lmstudio'
    | 'vllm'
    | 'custom'
  baseUrl: string
  model: string
  temperature: number
  hasApiKey: boolean
  requiresApiKey: boolean
  keyHint: string
  keyEncrypted: boolean
  fromEnvironment: boolean
}

interface SettingsState {
  settings: PublicSettings | null
  loading: boolean
  saving: boolean
  testing: boolean
  testResult: { ok: boolean; message: string; models?: string[] } | null
  models: string[]
  modelsLoading: boolean
  error: string | null
  load: () => Promise<void>
  save: (input: {
    provider?: string
    baseUrl?: string
    model?: string
    temperature?: number
    apiKey?: string | null
  }) => Promise<boolean>
  test: () => Promise<{ ok: boolean; message: string; models?: string[] }>
  fetchModels: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: null,
  loading: false,
  saving: false,
  testing: false,
  testResult: null,
  models: [],
  modelsLoading: false,
  error: null,

  load: async () => {
    if (!window.axiom) return
    set({ loading: true, error: null })
    try {
      const settings = await window.axiom.settings.get()
      set({ settings, loading: false })
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : String(error) })
    }
  },

  save: async (input) => {
    if (!window.axiom) return false
    set({ saving: true, error: null })
    try {
      const settings = await window.axiom.settings.save(input)
      set({ settings, saving: false, testResult: null })
      return true
    } catch (error) {
      set({ saving: false, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  },

  test: async () => {
    if (!window.axiom) return { ok: false, message: 'El puente de Electron no está disponible.' }
    set({ testing: true, testResult: null })
    try {
      const result = await window.axiom.settings.test()
      set({ testing: false, testResult: result, models: result.models?.length ? result.models : [] })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ testing: false, testResult: { ok: false, message } })
      return { ok: false, message }
    }
  },

  fetchModels: async () => {
    if (!window.axiom) return
    set({ modelsLoading: true, error: null })
    try {
      const result = await window.axiom.settings.models()
      set({
        modelsLoading: false,
        models: result.models,
        testResult: result.ok ? { ok: true, message: result.message } : { ok: false, message: result.message }
      })
    } catch (error) {
      set({ modelsLoading: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}))
