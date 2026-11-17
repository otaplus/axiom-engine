import type { IpcMainInvokeEvent } from 'electron'
import { getApiKey, getPublicSettings, type PublicSettings } from './settings'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  requestId: string
  messages: ChatMessage[]
  model?: string
  temperature?: number
}

const activeRequests = new Map<string, AbortController>()
const ANTHROPIC_VERSION = '2023-06-01'

function isAnthropic(settings: Pick<PublicSettings, 'provider' | 'baseUrl'>): boolean {
  return settings.provider === 'anthropic' || /api\.anthropic\.com/i.test(settings.baseUrl)
}

function cleanBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function endpointFor(settings: PublicSettings): string {
  const base = cleanBaseUrl(settings.baseUrl)
  return isAnthropic(settings) ? `${base}/messages` : `${base}/chat/completions`
}

function headersFor(settings: PublicSettings, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (isAnthropic(settings)) {
    headers['anthropic-version'] = ANTHROPIC_VERSION
    if (apiKey) headers['x-api-key'] = apiKey
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/otaplus/axiom-engine'
    headers['X-Title'] = 'Axiom Engine'
  }
  return headers
}

function normalizeDialog(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const dialog: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const message of messages) {
    if (message.role === 'system') continue
    const role = message.role === 'assistant' ? 'assistant' : 'user'
    const previous = dialog[dialog.length - 1]
    if (previous && previous.role === role) {
      previous.content += `\n\n${message.content}`
    } else {
      dialog.push({ role, content: message.content })
    }
  }
  if (!dialog.length) dialog.push({ role: 'user', content: 'Hola' })
  return dialog
}

function requestBody(
  settings: PublicSettings,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  stream = true
): Record<string, unknown> {
  if (isAnthropic(settings)) {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
    const body: Record<string, unknown> = {
      model,
      max_tokens: 8000,
      messages: normalizeDialog(messages),
      stream
    }
    if (system) body.system = system
    body.temperature = Math.max(0, Math.min(1, temperature))
    return body
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    stream,
    max_tokens: 8000
  }
  if (!/reasoner|r1|thinking/i.test(model)) {
    body.temperature = temperature
  }
  return body
}

function friendlyError(status: number, body: string): string {
  if (status === 401) return 'La clave API no es válida o ha caducado. Revísala en Ajustes de IA.'
  if (status === 402) return 'La cuenta no tiene saldo suficiente para usar este modelo.'
  if (status === 403) return 'El proveedor denegó la petición. Comprueba los permisos de la clave API.'
  if (status === 404) return 'No se encontró el modelo o el endpoint. Revisa la URL base y el modelo.'
  if (status === 429) return 'Demasiadas peticiones. Espera unos segundos y vuelve a intentarlo.'
  if (status >= 500) return 'El proveedor de IA está teniendo problemas. Inténtalo de nuevo en un momento.'
  try {
    const parsed = JSON.parse(body)
    return parsed?.error?.message ?? parsed?.message ?? `Error HTTP ${status}`
  } catch {
    return body.slice(0, 300) || `Error HTTP ${status}`
  }
}

async function readError(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

function sseBlocks(buffer: string): { blocks: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  return { blocks: parts, rest }
}

function modelHeaders(settings: PublicSettings, apiKey: string): Record<string, string> {
  const headers = headersFor(settings, apiKey)
  delete headers['Content-Type']
  return headers
}

export async function streamChat(event: IpcMainInvokeEvent, request: ChatRequest): Promise<void> {
  const contents = event.sender
  const apiKey = getApiKey()
  const settings = getPublicSettings()
  if (!apiKey && settings.requiresApiKey) {
    contents.send('ai:error', {
      requestId: request.requestId,
      message: 'Falta la clave API. Abre Ajustes de IA y guarda tu clave para empezar.'
    })
    return
  }
  const endpoint = endpointFor(settings)
  if (!/^https?:\/\//i.test(endpoint)) {
    contents.send('ai:error', {
      requestId: request.requestId,
      message: 'La URL base del proveedor no es válida. Debe comenzar por http:// o https://.'
    })
    return
  }
  if (activeRequests.has(request.requestId)) activeRequests.get(request.requestId)!.abort()
  const controller = new AbortController()
  activeRequests.set(request.requestId, controller)

  const model = request.model || settings.model
  const anthropic = isAnthropic(settings)
  const body = requestBody(settings, model, request.messages, request.temperature ?? settings.temperature, true)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headersFor(settings, apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorBody = await readError(response)
      contents.send('ai:error', {
        requestId: request.requestId,
        message: friendlyError(response.status, errorBody),
        status: response.status
      })
      return
    }

    if (!response.body) {
      const text = await response.text()
      contents.send('ai:chunk', { requestId: request.requestId, text })
      contents.send('ai:done', { requestId: request.requestId })
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let usage: unknown = null
    let finishReason: string | null = null
    let streamError: string | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const split = sseBlocks(buffer)
      buffer = split.rest
      for (const block of split.blocks) {
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (anthropic) {
              if (parsed.type === 'message_start') {
                usage = parsed.message?.usage ?? usage
              } else if (parsed.type === 'content_block_delta') {
                const delta = parsed.delta
                if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
                  contents.send('ai:chunk', { requestId: request.requestId, text: delta.text })
                } else if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
                  contents.send('ai:reasoning', { requestId: request.requestId, text: delta.thinking })
                }
              } else if (parsed.type === 'message_delta') {
                finishReason = parsed.delta?.stop_reason ?? finishReason
                usage = parsed.usage ?? usage
              } else if (parsed.type === 'error') {
                streamError = parsed.error?.message ?? 'El proveedor devolvió un error durante la respuesta.'
                contents.send('ai:error', { requestId: request.requestId, message: streamError })
              }
            } else {
              if (parsed.error) {
                streamError = parsed.error.message ?? 'El proveedor devolvió un error durante la respuesta.'
                contents.send('ai:error', { requestId: request.requestId, message: streamError })
                continue
              }
              usage = parsed.usage ?? usage
              finishReason = parsed.choices?.[0]?.finish_reason ?? finishReason
              const delta = parsed.choices?.[0]?.delta
              if (delta?.reasoning_content) {
                contents.send('ai:reasoning', { requestId: request.requestId, text: String(delta.reasoning_content) })
              }
              if (typeof delta?.content === 'string' && delta.content.length > 0) {
                contents.send('ai:chunk', { requestId: request.requestId, text: delta.content })
              }
              if (parsed.choices?.[0]?.message?.content) {
                contents.send('ai:chunk', {
                  requestId: request.requestId,
                  text: String(parsed.choices[0].message.content)
                })
              }
            }
          } catch {
            // Ignore malformed keep-alive fragments; the stream can recover.
          }
        }
      }
    }
    if (!streamError) {
      contents.send('ai:done', { requestId: request.requestId, usage, finishReason })
    }
  } catch (error) {
    if (controller.signal.aborted) {
      contents.send('ai:done', { requestId: request.requestId, aborted: true })
    } else {
      const message =
        error instanceof Error
          ? error.message.includes('fetch failed')
            ? 'No se pudo conectar con el proveedor. Comprueba tu conexión y la URL base.'
            : error.message
          : String(error)
      contents.send('ai:error', { requestId: request.requestId, message })
    }
  } finally {
    activeRequests.delete(request.requestId)
  }
}

export function abortChat(requestId: string): void {
  const controller = activeRequests.get(requestId)
  if (controller) {
    controller.abort()
    activeRequests.delete(requestId)
  }
}

async function fetchModels(
  settings: PublicSettings,
  apiKey: string
): Promise<{ ok: boolean; response: Response; models: string[]; error?: string }> {
  const base = cleanBaseUrl(settings.baseUrl)
  const response = await fetch(`${base}/models`, {
    headers: modelHeaders(settings, apiKey),
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) {
    return { ok: false, response, models: [], error: friendlyError(response.status, await readError(response)) }
  }
  const parsed: any = await response.json()
  const models = Array.isArray(parsed?.data)
    ? parsed.data.map((model: any) => String(model.id)).filter(Boolean)
    : []
  return { ok: true, response, models }
}

async function testWithChat(settings: PublicSettings, apiKey: string): Promise<{ ok: boolean; message: string }> {
  const model = settings.model
  const response = await fetch(endpointFor(settings), {
    method: 'POST',
    headers: headersFor(settings, apiKey),
    body: JSON.stringify(
      requestBody(settings, model, [{ role: 'user', content: 'Responde únicamente "ok".' }], 0, false)
    ),
    signal: AbortSignal.timeout(25000)
  })
  if (response.ok) return { ok: true, message: 'Conexión correcta.' }
  return { ok: false, message: friendlyError(response.status, await readError(response)) }
}

export async function testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
  const apiKey = getApiKey()
  const settings = getPublicSettings()
  if (!apiKey && settings.requiresApiKey) return { ok: false, message: 'No hay una clave API guardada.' }
  try {
    const result = await fetchModels(settings, apiKey)
    if (result.ok) {
      return {
        ok: true,
        message: `Conexión correcta${result.models.length ? ` · ${result.models.length} modelos disponibles` : ''}.`,
        models: result.models.slice(0, 30)
      }
    }
    if (result.response.status === 404 || result.response.status === 405) {
      const fallback = await testWithChat(settings, apiKey)
      return fallback
    }
    return { ok: false, message: result.error ?? 'No se pudo verificar la conexión.' }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'TimeoutError'
          ? 'La conexión tardó demasiado. Comprueba la URL base.'
          : error.message
        : String(error)
    return { ok: false, message }
  }
}

export async function listModels(): Promise<{ ok: boolean; message: string; models: string[] }> {
  const apiKey = getApiKey()
  const settings = getPublicSettings()
  if (!apiKey && settings.requiresApiKey) {
    return { ok: false, message: 'No hay una clave API guardada.', models: [] }
  }
  try {
    const result = await fetchModels(settings, apiKey)
    if (!result.ok) {
      return { ok: false, message: result.error ?? 'No se pudieron listar los modelos.', models: [] }
    }
    return { ok: true, message: `${result.models.length} modelos encontrados.`, models: result.models }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), models: [] }
  }
}

export function abortAll(): void {
  for (const controller of activeRequests.values()) controller.abort()
  activeRequests.clear()
}
