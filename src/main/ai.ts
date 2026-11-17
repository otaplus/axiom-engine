import type { IpcMainInvokeEvent } from 'electron'
import { chatEndpoint, getApiKey, getPublicSettings } from './settings'

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

export async function streamChat(event: IpcMainInvokeEvent, request: ChatRequest): Promise<void> {
  const contents = event.sender
  const apiKey = getApiKey()
  const settings = getPublicSettings()
  if (!apiKey && settings.requiresApiKey) {
    contents.send('ai:error', {
      requestId: request.requestId,
      message: 'Falta la clave API. Abre Ajustes de IA y guarda tu clave de DeepSeek para empezar.'
    })
    return
  }
  const endpoint = chatEndpoint(settings.baseUrl)
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
  const isReasoner = /reasoner|r1|thinking/i.test(model)
  const body: Record<string, unknown> = {
    model,
    messages: request.messages,
    stream: true,
    max_tokens: 8000
  }
  if (!isReasoner) body.temperature = request.temperature ?? settings.temperature

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(settings.provider === 'openrouter'
          ? { 'HTTP-Referer': 'https://github.com/axiom-engine', 'X-Title': 'Axiom Engine' }
          : {})
      },
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
          } catch {
            // Ignore malformed keep-alive fragments; the stream can recover.
          }
        }
      }
    }
    contents.send('ai:done', { requestId: request.requestId, usage, finishReason })
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

export async function testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
  const apiKey = getApiKey()
  const settings = getPublicSettings()
  if (!apiKey && settings.requiresApiKey) return { ok: false, message: 'No hay una clave API guardada.' }
  const base = settings.baseUrl.trim().replace(/\/+$/, '')
  try {
    const response = await fetch(`${base}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) {
      const body = await readError(response)
      return { ok: false, message: friendlyError(response.status, body) }
    }
    const parsed: any = await response.json()
    const models = Array.isArray(parsed?.data)
      ? parsed.data.map((model: any) => String(model.id)).filter(Boolean).slice(0, 30)
      : []
    return {
      ok: true,
      message: `Conexión correcta${models.length ? ` · ${models.length} modelos disponibles` : ''}.`,
      models
    }
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
  const base = settings.baseUrl.trim().replace(/\/+$/, '')
  try {
    const response = await fetch(`${base}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) {
      return { ok: false, message: friendlyError(response.status, await readError(response)), models: [] }
    }
    const parsed: any = await response.json()
    const models = Array.isArray(parsed?.data)
      ? parsed.data.map((model: any) => String(model.id)).filter(Boolean)
      : []
    return { ok: true, message: `${models.length} modelos encontrados.`, models }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), models: [] }
  }
}

export function abortAll(): void {
  for (const controller of activeRequests.values()) controller.abort()
  activeRequests.clear()
}
