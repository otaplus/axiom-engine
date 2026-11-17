import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateState } from '../shared/update'

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

export interface AxiomBridge {
  platform: string
  ai: {
    start: (request: {
      requestId: string
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
      model?: string
      temperature?: number
    }) => Promise<{ ok: boolean }>
    abort: (requestId: string) => Promise<{ ok: boolean }>
    onChunk: (callback: (payload: { requestId: string; text: string }) => void) => () => void
    onReasoning: (callback: (payload: { requestId: string; text: string }) => void) => () => void
    onDone: (callback: (payload: { requestId: string; aborted?: boolean; usage?: unknown }) => void) => () => void
    onError: (callback: (payload: { requestId: string; message: string; status?: number }) => void) => () => void
  }
  settings: {
    get: () => Promise<PublicSettings>
    save: (settings: {
      provider?: string
      baseUrl?: string
      model?: string
      temperature?: number
      apiKey?: string | null
    }) => Promise<PublicSettings>
    test: () => Promise<{ ok: boolean; message: string; models?: string[] }>
    models: () => Promise<{ ok: boolean; message: string; models: string[] }>
  }
  project: {
    open: () => Promise<{ path: string; name: string; content: string } | null>
    save: (payload: { content: string; path?: string; suggestedName?: string }) => Promise<{
      path: string
      name: string
    } | null>
    saveAs: (payload: { content: string; suggestedName?: string }) => Promise<{ path: string; name: string } | null>
  }
  update: {
    getState: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    download: () => Promise<UpdateState>
    install: () => Promise<UpdateState>
    openRelease: () => Promise<void>
    onStatus: (callback: (state: UpdateState) => void) => () => void
  }
  windowControls: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<boolean>
    close: () => Promise<void>
  }
  app: {
    openExternal: (url: string) => Promise<{ ok: boolean }>
    versions: () => Promise<{ app: string; electron: string; chrome: string; node: string }>
  }
}

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const bridge: AxiomBridge = {
  platform: process.platform,
  ai: {
    start: (request) => ipcRenderer.invoke('ai:start', request),
    abort: (requestId) => ipcRenderer.invoke('ai:abort', requestId),
    onChunk: (callback) => subscribe('ai:chunk', callback),
    onReasoning: (callback) => subscribe('ai:reasoning', callback),
    onDone: (callback) => subscribe('ai:done', callback),
    onError: (callback) => subscribe('ai:error', callback)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
    test: () => ipcRenderer.invoke('settings:test'),
    models: () => ipcRenderer.invoke('settings:models')
  },
  project: {
    open: () => ipcRenderer.invoke('project:open'),
    save: (payload) => ipcRenderer.invoke('project:save', payload),
    saveAs: (payload) => ipcRenderer.invoke('project:saveAs', payload)
  },
  update: {
    getState: () => ipcRenderer.invoke('update:get-state'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    openRelease: () => ipcRenderer.invoke('update:open-release'),
    onStatus: (callback) => subscribe('update:status', callback)
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    versions: () => ipcRenderer.invoke('app:versions')
  }
}

contextBridge.exposeInMainWorld('axiom', bridge)
