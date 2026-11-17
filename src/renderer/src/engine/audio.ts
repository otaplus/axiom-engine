export type SoundName =
  | 'jump'
  | 'coin'
  | 'hit'
  | 'laser'
  | 'explosion'
  | 'powerup'
  | 'click'
  | 'win'
  | 'lose'
  | 'blip'

const SOUND_NOTES: Record<string, { type: OscillatorType; notes: number[]; step: number; duration: number; volume: number }> = {
  jump: { type: 'square', notes: [330, 494, 660], step: 0.045, duration: 0.12, volume: 0.12 },
  coin: { type: 'sine', notes: [880, 1174, 1568], step: 0.055, duration: 0.16, volume: 0.14 },
  hit: { type: 'sawtooth', notes: [180, 110, 70], step: 0.04, duration: 0.18, volume: 0.12 },
  laser: { type: 'square', notes: [1100, 700, 420], step: 0.025, duration: 0.1, volume: 0.08 },
  explosion: { type: 'sawtooth', notes: [120, 70, 45, 30], step: 0.05, duration: 0.25, volume: 0.16 },
  powerup: { type: 'triangle', notes: [440, 554, 659, 880], step: 0.06, duration: 0.22, volume: 0.12 },
  click: { type: 'sine', notes: [600], step: 0.01, duration: 0.03, volume: 0.05 },
  win: { type: 'triangle', notes: [523, 659, 784, 1047], step: 0.11, duration: 0.45, volume: 0.15 },
  lose: { type: 'sine', notes: [392, 330, 262, 196], step: 0.13, duration: 0.5, volume: 0.13 },
  blip: { type: 'square', notes: [520], step: 0.01, duration: 0.04, volume: 0.04 }
}

export class SoundManager {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  private ensure(): AudioContext | null {
    if (this.muted) return null
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtor) return null
      this.context = new AudioCtor()
      this.master = this.context.createGain()
      this.master.gain.value = 0.55
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  play(name: string, volume = 0.6): void {
    const context = this.ensure()
    if (!context || !this.master) return
    const preset = SOUND_NOTES[name] ?? SOUND_NOTES.blip
    const now = context.currentTime
    const gain = context.createGain()
    gain.connect(this.master)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, preset.volume * volume), now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration)

    preset.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = preset.type
      oscillator.frequency.setValueAtTime(frequency, now + index * preset.step)
      oscillator.connect(gain)
      oscillator.start(now + index * preset.step)
      oscillator.stop(now + preset.duration)
    })
  }

  unlock(): void {
    this.ensure()
  }

  dispose(): void {
    void this.context?.close()
    this.context = null
    this.master = null
  }
}
