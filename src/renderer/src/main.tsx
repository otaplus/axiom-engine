import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { AppErrorBoundary } from './App'
import { useAIStore } from './store/ai'
import { useEditorStore } from './store/editor'
import { useSettingsStore } from './store/settings'
import './styles.css'

declare global {
  interface Window {
    __AXIOM__?: {
      editor: typeof useEditorStore
      ai: typeof useAIStore
      settings: typeof useSettingsStore
    }
  }
}

window.__AXIOM__ = { editor: useEditorStore, ai: useAIStore, settings: useSettingsStore }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
)
