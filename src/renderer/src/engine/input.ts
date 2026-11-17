export const ACTION_MAP: Record<string, string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  action: ['KeyE', 'Enter'],
  shoot: ['KeyJ', 'KeyX'],
  dash: ['ShiftLeft', 'ShiftRight'],
  restart: ['KeyR'],
  pause: ['Escape'],
  // Alias en español para que los guiones generados por la IA sean flexibles.
  izquierda: ['ArrowLeft', 'KeyA'],
  derecha: ['ArrowRight', 'KeyD'],
  arriba: ['ArrowUp', 'KeyW'],
  abajo: ['ArrowDown', 'KeyS'],
  saltar: ['Space', 'ArrowUp', 'KeyW'],
  accion: ['KeyE', 'Enter'],
  disparar: ['KeyJ', 'KeyX']
}

export class InputManager {
  private down = new Set<string>()
  private justDown = new Set<string>()
  private mouseDown = new Set<number>()
  private mouseJustDown = new Set<number>()
  private mouseScreen = { x: 0, y: 0 }
  private attached = false
  private target: HTMLElement | null = null
  private worldProvider: (() => { x: number; y: number }) | null = null

  setWorldProvider(provider: (() => { x: number; y: number }) | null): void {
    this.worldProvider = provider
  }

  attach(target: HTMLElement): void {
    if (this.attached) this.detach()
    this.target = target
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    target.addEventListener('pointermove', this.onPointerMove)
    target.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    this.attached = true
  }

  detach(): void {
    if (!this.attached) return
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.target?.removeEventListener('pointermove', this.onPointerMove)
    this.target?.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.target = null
    this.attached = false
    this.down.clear()
    this.justDown.clear()
    this.mouseDown.clear()
    this.mouseJustDown.clear()
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const code = event.code
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code) ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault()
      }
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (!this.down.has(code)) this.justDown.add(code)
    this.down.add(code)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.down.delete(event.code)
  }

  private onBlur = (): void => {
    this.down.clear()
    this.justDown.clear()
    this.mouseDown.clear()
  }

  private onPointerMove = (event: PointerEvent): void => {
    const rect = (this.target as HTMLElement).getBoundingClientRect()
    this.mouseScreen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.mouseDown.add(event.button)
    this.mouseJustDown.add(event.button)
    this.onPointerMove(event)
  }

  private onPointerUp = (event: PointerEvent): void => {
    this.mouseDown.delete(event.button)
  }

  private keysFor(action: string): string[] {
    return ACTION_MAP[action] ?? [action]
  }

  isActionPressed(action: string): boolean {
    return this.keysFor(action).some((key) => this.down.has(key))
  }

  isActionJustPressed(action: string): boolean {
    return this.keysFor(action).some((key) => this.justDown.has(key))
  }

  isKeyPressed(code: string): boolean {
    return this.down.has(code)
  }

  isKeyJustPressed(code: string): boolean {
    return this.justDown.has(code)
  }

  isMousePressed(button = 0): boolean {
    return this.mouseDown.has(button)
  }

  isMouseJustPressed(button = 0): boolean {
    return this.mouseJustDown.has(button)
  }

  getMousePosition(): { x: number; y: number } {
    return { ...this.mouseScreen }
  }

  getAxis(negative: string, positive: string): number {
    return (this.isActionPressed(positive) ? 1 : 0) - (this.isActionPressed(negative) ? 1 : 0)
  }

  // Snake-case aliases exposed to game scripts (Godot-style API).
  is_action_pressed(action: string): boolean {
    return this.isActionPressed(action)
  }

  is_action_just_pressed(action: string): boolean {
    return this.isActionJustPressed(action)
  }

  is_key_pressed(code: string): boolean {
    return this.isKeyPressed(code)
  }

  is_key_just_pressed(code: string): boolean {
    return this.isKeyJustPressed(code)
  }

  is_mouse_pressed(button = 0): boolean {
    return this.isMousePressed(button)
  }

  get_axis(negative: string, positive: string): number {
    return this.getAxis(negative, positive)
  }

  get_mouse_position(): { x: number; y: number } {
    return this.getMousePosition()
  }

  get mouse_position(): { x: number; y: number } {
    return this.getMousePosition()
  }

  get mouse_world(): { x: number; y: number } {
    return this.worldProvider?.() ?? this.getMousePosition()
  }

  get_mouse_world(): { x: number; y: number } {
    return this.mouse_world
  }

  endFrame(): void {
    this.justDown.clear()
    this.mouseJustDown.clear()
  }
}
