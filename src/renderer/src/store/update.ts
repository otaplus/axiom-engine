import { create } from 'zustand'
import type { UpdateState } from '../../../shared/update'

interface UpdateStore extends UpdateState {
  initialized: boolean
  dismissed: boolean
  init: () => () => void
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
  openRelease: () => Promise<void>
  dismiss: () => void
}

export const useUpdateStore = create<UpdateStore>()((set, get) => ({
  status: 'idle',
  currentVersion: '',
  progress: 0,
  initialized: false,
  dismissed: false,

  init: () => {
    if (!window.axiom) return () => undefined
    const cleanups: Array<() => void> = []
    void window.axiom.update.getState().then((state) => {
      set({ ...state, initialized: true })
    })
    cleanups.push(
      window.axiom.update.onStatus((state) => {
        set({
          ...state,
          dismissed: state.status === 'available' || state.status === 'ready' ? false : get().dismissed
        })
      })
    )
    set({ initialized: true })
    return () => cleanups.forEach((cleanup) => cleanup())
  },

  check: async () => {
    if (!window.axiom) return
    const state = await window.axiom.update.check()
    set({ ...state })
  },

  download: async () => {
    if (!window.axiom) return
    const state = await window.axiom.update.download()
    set({ ...state })
  },

  install: async () => {
    if (!window.axiom) return
    const state = await window.axiom.update.install()
    set({ ...state })
  },

  openRelease: async () => {
    if (window.axiom) await window.axiom.update.openRelease()
  },

  dismiss: () => set({ dismissed: true })
}))
