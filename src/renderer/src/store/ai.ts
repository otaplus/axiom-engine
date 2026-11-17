import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSystemPrompt } from '../ai/prompt'
import { parseAIResponse, visibleDuringStream } from '../ai/parser'
import { uid } from '../engine/project'
import { useEditorStore } from './editor'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  createdAt: number
  actions?: unknown[]
  actionDescriptions?: string[]
  actionErrors?: string[]
  applied?: boolean
  error?: string
  streaming?: boolean
  model?: string
}

interface AIState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  requestId: string | null
  autoApply: boolean
  error: string | null
  send: (prompt: string, context: { project: any; activeSceneId: string; selectedNodeId: string | null }) => Promise<void>
  abort: () => Promise<void>
  applyMessageActions: (id: string) => void
  discardMessageActions: (id: string) => void
  clearConversation: () => void
  setAutoApply: (value: boolean) => void
  setError: (error: string | null) => void
  handleChunk: (requestId: string, text: string) => void
  handleReasoning: (requestId: string, text: string) => void
  handleDone: (requestId: string, aborted?: boolean) => void
  handleError: (requestId: string, message: string) => void
  retryLast: (context: { project: any; activeSceneId: string; selectedNodeId: string | null }) => Promise<void>
}

function assistantTextForHistory(message: ChatMessage): string {
  let content = message.content
  if (message.actionDescriptions?.length) {
    content += `\n[Cambios aplicados: ${message.actionDescriptions.join('; ')}]`
  } else if (message.actions?.length) {
    content += '\n[Propuesta de cambios no aplicada]'
  }
  return content
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      requestId: null,
      autoApply: true,
      error: null,

      send: async (prompt, context) => {
        if (!prompt.trim() || get().isStreaming) return
        if (!window.axiom) {
          set({ error: 'El puente de Electron no está disponible. Reinicia la aplicación.' })
          return
        }
        const userMessage: ChatMessage = {
          id: uid('msg'),
          role: 'user',
          content: prompt.trim(),
          createdAt: Date.now()
        }
        const assistantId = uid('msg')
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          streaming: true
        }
        const previousMessages = get().messages
        const history = previousMessages
          .filter((message) => !message.error && !message.streaming && message.content.trim())
          .slice(-12)
          .map((message) => ({
            role: message.role,
            content:
              message.role === 'assistant'
                ? assistantTextForHistory(message).slice(0, 8000)
                : message.content.slice(0, 5000)
          }))

        const requestId = uid('req')
        set({
          messages: [...previousMessages, userMessage, assistantMessage],
          isStreaming: true,
          streamingMessageId: assistantId,
          requestId,
          error: null
        })

        const systemPrompt = buildSystemPrompt(context.project, context.activeSceneId, context.selectedNodeId)
        try {
          await window.axiom.ai.start({
            requestId,
            messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: prompt.trim() }]
          })
        } catch (error) {
          get().handleError(requestId, error instanceof Error ? error.message : String(error))
        }
      },

      abort: async () => {
        const requestId = get().requestId
        if (!requestId) return
        try {
          await window.axiom.ai.abort(requestId)
        } catch {
          // The stream will finish on its own if the bridge is already gone.
        }
      },

      applyMessageActions: (id) => {
        const state = get()
        const message = state.messages.find((item) => item.id === id)
        if (!message?.actions?.length || message.applied) return
        const result = useEditorStore.getState().applyAIActions(message.actions)
        set({
          messages: state.messages.map((item) =>
            item.id === id
              ? {
                  ...item,
                  applied: result.descriptions.length > 0,
                  actionDescriptions: result.descriptions,
                  actionErrors: result.errors
                }
              : item
          )
        })
      },

      discardMessageActions: (id) => {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id
              ? {
                  ...message,
                  actions: undefined,
                  applied: false,
                  actionDescriptions: undefined,
                  actionErrors: ['Propuesta descartada.']
                }
              : message
          )
        }))
      },

      clearConversation: () => set({ messages: [], isStreaming: false, streamingMessageId: null, requestId: null, error: null }),

      setAutoApply: (value) => set({ autoApply: value }),
      setError: (error) => set({ error }),

      handleChunk: (requestId, text) => {
        const state = get()
        if (state.requestId !== requestId || !state.streamingMessageId) return
        set({
          messages: state.messages.map((message) =>
            message.id === state.streamingMessageId
              ? { ...message, content: message.content + text }
              : message
          )
        })
      },

      handleReasoning: (requestId, text) => {
        const state = get()
        if (state.requestId !== requestId || !state.streamingMessageId) return
        set({
          messages: state.messages.map((message) =>
            message.id === state.streamingMessageId
              ? { ...message, reasoning: (message.reasoning ?? '') + text }
              : message
          )
        })
      },

      handleDone: (requestId, aborted = false) => {
        const state = get()
        if (state.requestId !== requestId || !state.streamingMessageId) return
        const id = state.streamingMessageId
        const message = state.messages.find((item) => item.id === id)
        if (!message) {
          set({ isStreaming: false, streamingMessageId: null, requestId: null })
          return
        }
        if (aborted) {
          set({
            isStreaming: false,
            streamingMessageId: null,
            requestId: null,
            messages: state.messages.map((item) =>
              item.id === id
                ? {
                    ...item,
                    streaming: false,
                    content: visibleDuringStream(item.content).trim() || item.content.trim(),
                    error: undefined
                  }
                : item
            )
          })
          return
        }

        const parsed = parseAIResponse(message.content)
        let nextMessage: ChatMessage = {
          ...message,
          streaming: false,
          content: parsed.text || (parsed.actions?.length ? 'He preparado los cambios.' : ''),
          actions: parsed.actions ?? undefined,
          error: parsed.error ?? undefined
        }

        if (parsed.actions?.length && !parsed.error) {
          if (state.autoApply) {
            const result = useEditorStore.getState().applyAIActions(parsed.actions)
            nextMessage = {
              ...nextMessage,
              applied: result.descriptions.length > 0,
              actionDescriptions: result.descriptions,
              actionErrors: result.errors
            }
          }
        }

        set({
          isStreaming: false,
          streamingMessageId: null,
          requestId: null,
          messages: state.messages.map((item) => (item.id === id ? nextMessage : item))
        })
      },

      handleError: (requestId, message) => {
        const state = get()
        if (state.requestId && state.requestId !== requestId) return
        const id = state.streamingMessageId
        set({
          isStreaming: false,
          streamingMessageId: null,
          requestId: null,
          error: message,
          messages: state.messages.map((item) =>
            item.id === id ? { ...item, streaming: false, error: message } : item
          )
        })
      },

      retryLast: async (context) => {
        const state = get()
        const lastUser = [...state.messages].reverse().find((message) => message.role === 'user')
        if (!lastUser || state.isStreaming) return
        set({ messages: state.messages.filter((message) => message.id !== lastUser.id) })
        await get().send(lastUser.content, context)
      }
    }),
    {
      name: 'axiom.copilot.v1',
      partialize: (state) => ({
        messages: state.messages
          .filter((message) => !message.streaming)
          .slice(-80)
          .map((message) => ({ ...message, streaming: false })),
        autoApply: state.autoApply
      })
    }
  )
)

let initialized = false
let cleanups: Array<() => void> = []

export function initAIListeners(): () => void {
  if (!window.axiom) return () => undefined
  if (initialized) return () => undefined
  initialized = true
  const store = useAIStore.getState()
  cleanups = [
    window.axiom.ai.onChunk(({ requestId, text }) => useAIStore.getState().handleChunk(requestId, text)),
    window.axiom.ai.onReasoning(({ requestId, text }) => useAIStore.getState().handleReasoning(requestId, text)),
    window.axiom.ai.onDone(({ requestId, aborted }) => useAIStore.getState().handleDone(requestId, aborted)),
    window.axiom.ai.onError(({ requestId, message }) => useAIStore.getState().handleError(requestId, message))
  ]
  void store
  return () => {
    initialized = false
    cleanups.forEach((cleanup) => cleanup())
    cleanups = []
  }
}
