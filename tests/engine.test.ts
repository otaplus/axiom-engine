import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyActions } from '../src/renderer/src/engine/actions'
import { parseAIResponse, visibleDuringStream } from '../src/renderer/src/ai/parser'
import { createTemplate, platformerTemplate, shooterTemplate } from '../src/renderer/src/templates'
import { findNode, flatten, nodePath } from '../src/renderer/src/engine/project'
import { normalizeProject, parseProject, serializeProject } from '../src/renderer/src/engine/projectIO'
import { compileBehavior, validateScriptSyntax } from '../src/renderer/src/engine/script'
import type { SceneNode } from '../src/renderer/src/engine/types'

function visitScripts(node: SceneNode, callback: (node: SceneNode) => void): void {
  if (node.script) callback(node)
  node.children.forEach((child) => visitScripts(child, callback))
}

describe('proyectos y plantillas', () => {
  it('crea plantillas jugables con escena principal válida', () => {
    const platformer = platformerTemplate()
    expect(platformer.scenes.length).toBeGreaterThan(0)
    expect(platformer.mainSceneId).toBe(platformer.scenes[0].id)
    expect(flatten(platformer.scenes[0].root).length).toBeGreaterThan(20)
    const shooter = shooterTemplate()
    expect(flatten(shooter.scenes[0].root).some((node) => node.template)).toBe(true)
  })

  it('todos los scripts de plantilla compilan', () => {
    for (const template of [platformerTemplate(), shooterTemplate(), createTemplate('empty')]) {
      for (const scene of template.scenes) {
        visitScripts(scene.root, (node) => {
          expect(validateScriptSyntax(node.script!), `${template.name} / ${node.name}`).toBeNull()
        })
      }
    }
  })

  it('serializa y normaliza un proyecto sin perder escenas ni scripts', () => {
    const project = platformerTemplate()
    const restored = parseProject(serializeProject(project))
    expect(restored.name).toBe(project.name)
    expect(restored.scenes[0].root.children.length).toBe(project.scenes[0].root.children.length)
    const player = flatten(restored.scenes[0].root).find((node) => node.name === 'Jugador')
    expect(player?.script).toContain('_physics_process')
    expect(restored.assets.some((asset) => asset.id === 'coin' && asset.kind === 'vector')).toBe(true)
  })

  it('normaliza ids y nombres duplicados', () => {
    const project = platformerTemplate()
    const raw = JSON.parse(serializeProject(project))
    raw.scenes[0].root.children[1].id = raw.scenes[0].root.children[0].id
    raw.scenes[0].root.children[1].name = raw.scenes[0].root.children[0].name
    const normalized = normalizeProject(raw)
    const all = flatten(normalized.scenes[0].root)
    expect(new Set(all.map((node) => node.id)).size).toBe(all.length)
    expect(normalized.scenes[0].root.children[0].name).not.toBe(normalized.scenes[0].root.children[1].name)
  })

  it('encuentra nodos por ruta y calcula su ruta', () => {
    const project = platformerTemplate()
    const player = findNode(project.scenes[0].root, 'Bosque/Jugador')
    expect(player?.name).toBe('Jugador')
    expect(nodePath(project.scenes[0].root, player!)).toBe('Bosque/Jugador')
  })

  it('los proyectos de ejemplo incluidos son válidos', () => {
    if (!existsSync('examples')) return
    const files = readdirSync('examples').filter((file) => file.endsWith('.axiom'))
    if (!files.length) return
    for (const file of files) {
      const project = parseProject(readFileSync(`examples/${file}`, 'utf8'))
      expect(project.scenes.length).toBeGreaterThan(0)
      expect(project.assets.length).toBeGreaterThan(0)
    }
  })
})

describe('acciones del copiloto', () => {
  it('crea assets, nodos, scripts y actualiza props', () => {
    const project = platformerTemplate()
    const activeSceneId = project.mainSceneId
    const result = applyActions(
      project,
      [
        {
          type: 'create_asset',
          asset: { name: 'Cristal IA', kind: 'emoji', glyph: '🔮' }
        },
        {
          type: 'add_node',
          scene: 'Bosque',
          parent: 'Bosque',
          node: {
            name: 'Cristal',
            type: 'Area2D',
            x: 10,
            y: 20,
            props: { width: 32, height: 32, group: 'gem' },
            script: '_physics_process() { if (this.overlaps("player").length) this.queue_free() }',
            children: [{ name: 'Icono', type: 'Sprite2D', props: { assetId: 'cristal_ia' } }]
          }
        },
        {
          type: 'update_node',
          scene: 'Bosque',
          target: 'Cristal',
          patch: { props: { width: 48 }, y: -30 }
        }
      ],
      activeSceneId
    )
    expect(result.errors).toEqual([])
    expect(result.descriptions.length).toBe(3)
    expect(result.project.assets.some((asset) => asset.id === 'cristal_ia')).toBe(true)
    const crystal = findNode(result.project.scenes[0].root, 'Cristal')
    expect(crystal?.props.width).toBe(48)
    expect(crystal?.y).toBe(-30)
    expect(crystal?.script).toContain('queue_free')
  })

  it('rechaza scripts con errores de sintaxis y tipos desconocidos', () => {
    const project = platformerTemplate()
    const result = applyActions(
      project,
      [
        { type: 'add_node', scene: 'Bosque', parent: 'Bosque', node: { name: 'Malo', type: 'Sprite2D', script: '_ready( {' } },
        { type: 'add_node', scene: 'Bosque', parent: 'Bosque', node: { name: 'Raro', type: 'NotAType' } }
      ],
      project.mainSceneId
    )
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('crea escenas y las marca como principales', () => {
    const project = platformerTemplate()
    const result = applyActions(
      project,
      [
        { type: 'create_scene', name: 'Nivel 2', setMain: true },
        { type: 'add_node', scene: 'Nivel 2', parent: 'Nivel 2', node: { name: 'Suelo', type: 'StaticBody2D', y: 200 } }
      ],
      project.mainSceneId
    )
    expect(result.errors).toEqual([])
    expect(result.project.scenes.length).toBe(2)
    expect(result.project.scenes[1].name).toBe('Nivel 2')
    expect(result.project.mainSceneId).toBe(result.project.scenes[1].id)
  })
})

describe('scripts', () => {
  it('valida sintaxis y ejecuta hooks en un contexto de prueba', () => {
    expect(validateScriptSyntax('_ready() { this.x = 1 }')).toBeNull()
    expect(validateScriptSyntax('_ready() { this.x = }')).toBeTruthy()
    const compiled = compileBehavior('_ready() { this.x = 5; this.speed = 200 }', {
      Input: {},
      Game: {},
      sfx: () => undefined,
      rand: () => 0,
      randInt: () => 0,
      clamp: (v) => v,
      lerp: (a) => a,
      dist: () => 0,
      Vector2: (x = 0, y = 0) => ({ x, y }),
      print: () => undefined,
      TAU: Math.PI * 2,
      PI: Math.PI
    })
    expect(compiled.error).toBeNull()
    const instance = new compiled.Behavior!()
    instance._ready()
    expect(instance.x).toBe(5)
    expect(instance.speed).toBe(200)
  })
})

describe('parser del copiloto', () => {
  const actions = [{ type: 'update_node', scene: 'Bosque', target: 'Jugador', patch: { x: 10 } }]

  it('extrae un bloque <acciones> y limpia el texto', () => {
    const parsed = parseAIResponse(`He movido al jugador.\n\n<acciones>${JSON.stringify({ actions })}</acciones>`)
    expect(parsed.error).toBeNull()
    expect(parsed.text).toBe('He movido al jugador.')
    expect(parsed.actions).toHaveLength(1)
  })

  it('acepta bloques markdown con JSON', () => {
    const parsed = parseAIResponse(`Listo.\n\n\`\`\`json\n${JSON.stringify({ actions })}\n\`\`\``)
    expect(parsed.error).toBeNull()
    expect(parsed.actions).toHaveLength(1)
  })

  it('reporta un bloque incompleto', () => {
    const parsed = parseAIResponse('Texto\n<acciones>{"actions":[')
    expect(parsed.error).toBeTruthy()
    expect(parsed.actions).toBeNull()
  })

  it('oculta el bloque mientras se escribe', () => {
    expect(visibleDuringStream('Hola\n<acciones>{"actions":')).toBe('Hola')
    expect(visibleDuringStream('Hola')).toBe('Hola')
  })
})
