export interface ParsedResponse {
  text: string
  actions: unknown[] | null
  error: string | null
  hadBlock: boolean
}

function normalizeActionPayload(parsed: any): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  if (!parsed || typeof parsed !== 'object') return null
  if (Array.isArray(parsed.actions)) return parsed.actions
  if (Array.isArray(parsed.acciones)) return parsed.acciones
  return null
}

function cleanText(text: string): string {
  return text
    .replace(/<acciones>[\s\S]*?<\/acciones>/gi, '')
    .replace(/<actions>[\s\S]*?<\/actions>/gi, '')
    .replace(/```(?:json)?\s*\{\s*"(?:actions|acciones)"[\s\S]*?```/gi, '')
    .trim()
}

export function parseAIResponse(raw: string): ParsedResponse {
  const text = raw ?? ''
  const xmlMatch = text.match(/<acciones>([\s\S]*?)<\/acciones>/i) ?? text.match(/<actions>([\s\S]*?)<\/actions>/i)
  if (xmlMatch) {
    const json = xmlMatch[1].trim()
    try {
      const parsed = JSON.parse(json)
      const actions = normalizeActionPayload(parsed)
      if (!actions) {
        return {
          text: cleanText(text),
          actions: null,
          error: 'El bloque de cambios no contiene una lista de acciones.',
          hadBlock: true
        }
      }
      if (actions.length > 80) {
        return {
          text: cleanText(text),
          actions: null,
          error: 'La propuesta contiene demasiados cambios (máximo 80). Pídeme que la divida en partes.',
          hadBlock: true
        }
      }
      return { text: cleanText(text), actions, error: null, hadBlock: true }
    } catch (error) {
      return {
        text: cleanText(text),
        actions: null,
        error: `El bloque de cambios no es JSON válido: ${error instanceof Error ? error.message : String(error)}`,
        hadBlock: true
      }
    }
  }

  if (/<acciones>/i.test(text) || /<actions>/i.test(text)) {
    return {
      text: text.replace(/<acciones>[\s\S]*$/i, '').replace(/<actions>[\s\S]*$/i, '').trim(),
      actions: null,
      error: 'El bloque de cambios quedó incompleto. Pídeme que repita la propuesta.',
      hadBlock: true
    }
  }

  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  for (const fence of fences) {
    try {
      const parsed = JSON.parse(fence[1].trim())
      const actions = normalizeActionPayload(parsed)
      if (actions) {
        return { text: cleanText(text), actions, error: null, hadBlock: true }
      }
    } catch {
      // Try the next block before reporting malformed output.
    }
  }

  if (fences.length > 0) {
    const last = fences[fences.length - 1][1].trim()
    if (last.startsWith('{') || last.startsWith('[')) {
      return {
        text: cleanText(text),
        actions: null,
        error: 'La propuesta de cambios no se pudo leer. Pídeme que la repita.',
        hadBlock: true
      }
    }
  }

  return { text: cleanText(text) || text.trim(), actions: null, error: null, hadBlock: false }
}

export function visibleDuringStream(raw: string): string {
  if (!raw) return ''
  const xmlIndex = raw.search(/<acciones>|<actions>/i)
  if (xmlIndex >= 0) return raw.slice(0, xmlIndex).trimEnd()
  const fenceIndex = raw.search(/```(?:json)?\s*\{\s*"(?:actions|acciones)"/i)
  if (fenceIndex >= 0) return raw.slice(0, fenceIndex).trimEnd()
  return raw
}
