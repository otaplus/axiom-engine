import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type ProviderId =
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

export interface StoredSettings {
  version: 1
  provider: ProviderId
  baseUrl: string
  model: string
  temperature: number
  encryptedKey?: string
  keyIsPlain?: boolean
}

export interface PublicSettings {
  provider: ProviderId
  baseUrl: string
  model: string
  temperature: number
  hasApiKey: boolean
  requiresApiKey: boolean
  keyHint: string
  keyEncrypted: boolean
  fromEnvironment: boolean
}

export function providerRequiresApiKey(stored: Pick<StoredSettings, 'provider' | 'baseUrl'>): boolean {
  if (['ollama', 'lmstudio', 'vllm'].includes(stored.provider)) return false
  return !/(^|[/.])(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(stored.baseUrl)
}

const DEFAULTS: StoredSettings = {
  version: 1,
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  temperature: 0.7
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'ai-settings.json')
}

function readStored(): StoredSettings {
  try {
    const path = settingsPath()
    if (!existsSync(path)) return { ...DEFAULTS }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredSettings>
    return {
      ...DEFAULTS,
      ...parsed,
      version: 1,
      temperature: Number(parsed.temperature ?? DEFAULTS.temperature)
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeStored(settings: StoredSettings): void {
  const path = settingsPath()
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  writeFileSync(temporary, JSON.stringify(settings, null, 2), 'utf8')
  renameSync(temporary, path)
}

function encryptKey(key: string): Pick<StoredSettings, 'encryptedKey' | 'keyIsPlain'> {
  if (safeStorage.isEncryptionAvailable()) {
    return { encryptedKey: safeStorage.encryptString(key).toString('base64'), keyIsPlain: false }
  }
  return { encryptedKey: Buffer.from(key, 'utf8').toString('base64'), keyIsPlain: true }
}

function decryptKey(settings: StoredSettings): string {
  if (!settings.encryptedKey) return ''
  try {
    const buffer = Buffer.from(settings.encryptedKey, 'base64')
    if (settings.keyIsPlain) return buffer.toString('utf8')
    return safeStorage.decryptString(buffer)
  } catch {
    return ''
  }
}

export function getApiKey(): string {
  const stored = readStored()
  const key = decryptKey(stored)
  if (key) return key
  return process.env.DEEPSEEK_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || ''
}

export function getPublicSettings(): PublicSettings {
  const stored = readStored()
  const key = decryptKey(stored)
  const envKey = !key && Boolean(process.env.DEEPSEEK_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim())
  const effective = key || getApiKey()
  return {
    provider: stored.provider,
    baseUrl: stored.baseUrl,
    model: stored.model,
    temperature: stored.temperature,
    hasApiKey: Boolean(effective),
    requiresApiKey: providerRequiresApiKey(stored),
    keyHint: effective ? `••••${effective.slice(-4)}` : '',
    keyEncrypted: Boolean(stored.encryptedKey) && !stored.keyIsPlain,
    fromEnvironment: Boolean(envKey)
  }
}

export function saveSettings(input: {
  provider?: ProviderId
  baseUrl?: string
  model?: string
  temperature?: number
  apiKey?: string | null
}): PublicSettings {
  const stored = readStored()
  if (input.provider) stored.provider = input.provider
  if (typeof input.baseUrl === 'string' && input.baseUrl.trim()) {
    stored.baseUrl = input.baseUrl.trim().replace(/\/+$/, '')
  }
  if (typeof input.model === 'string' && input.model.trim()) stored.model = input.model.trim()
  if (input.temperature !== undefined && Number.isFinite(Number(input.temperature))) {
    stored.temperature = Math.max(0, Math.min(2, Number(input.temperature)))
  }
  if (input.apiKey === null) {
    delete stored.encryptedKey
    delete stored.keyIsPlain
  } else if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    Object.assign(stored, encryptKey(input.apiKey.trim()))
  }
  writeStored(stored)
  return getPublicSettings()
}

export function chatEndpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return `${base}/chat/completions`
}
