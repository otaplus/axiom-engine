import type { AxiomBridge } from './index'

declare global {
  interface Window {
    axiom: AxiomBridge
  }
}

export {}
