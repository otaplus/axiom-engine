export interface ScriptGlobals {
  Input: any
  Game: any
  sfx: (name: string, volume?: number) => void
  rand: (min?: number, max?: number) => number
  randInt: (min: number, max: number) => number
  clamp: (value: number, min: number, max: number) => number
  lerp: (a: number, b: number, t: number) => number
  dist: (a: { x: number; y: number }, b: { x: number; y: number }) => number
  Vector2: (x?: number, y?: number) => { x: number; y: number }
  print: (...args: any[]) => void
  TAU: number
  PI: number
}

export interface CompiledBehavior {
  Behavior: (new () => any) | null
  error: string | null
}

function wrapper(code: string): string {
  return `"use strict";
const { Input, Game, sfx, rand, randInt, clamp, lerp, dist, Vector2, print, TAU, PI } = API;
const console = { log: print, info: print, warn: print, error: print };
return class AxiomBehavior {
${code}
};`
}

export function compileBehavior(code: string, globals: ScriptGlobals): CompiledBehavior {
  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function('API', wrapper(code)) as (api: ScriptGlobals) => new () => any
    const Behavior = factory(globals)
    return { Behavior, error: null }
  } catch (error) {
    return { Behavior: null, error: error instanceof Error ? error.message : String(error) }
  }
}

export function validateScriptSyntax(code: string): string | null {
  if (!code.trim()) return null
  try {
    // Compile only. Never call the factory here: syntax validation must not execute user code.
    // eslint-disable-next-line no-new-func
    new Function('API', wrapper(code))
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function scriptTemplate(type: string): string {
  if (type === 'CharacterBody2D') {
    return `_ready() {
  this.speed = 280
  this.jump_force = 720
}

_physics_process(dt) {
  const dir = Input.get_axis("left", "right")
  this.velocity.x = dir * this.speed

  if (!this.on_floor) this.velocity.y += this.gravity * dt
  if (Input.is_action_just_pressed("jump") && this.on_floor) {
    this.velocity.y = -this.jump_force
    this.play_sound("jump")
  }

  this.move_and_slide(dt)
}`
  }
  return `_ready() {
  this.time = 0
}

_process(dt) {
  this.time += dt
  this.rotation += dt * 0.5
}`
}
