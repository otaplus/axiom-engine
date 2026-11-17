import { cloneBuiltinAssets } from './engine/builtinAssets'
import { createNode, createScene, uid } from './engine/project'
import type { Project, SceneNode } from './engine/types'

function baseProject(name: string, options: { background?: string; style?: 'stars' | 'grid' | 'gradient' | 'solid'; accent?: string } = {}): Project {
  const scene = createScene('Mundo principal')
  scene.settings = {
    background: options.background ?? '#0d1526',
    style: options.style ?? 'stars'
  }
  return {
    format: 'axiom-project',
    version: 1,
    name,
    settings: {
      width: 960,
      height: 540,
      gravity: 1600,
      background: options.background ?? '#0d1526',
      backgroundStyle: options.style ?? 'stars',
      accent: options.accent ?? '#38bdf8',
      pixelArt: false,
      showFps: false
    },
    assets: cloneBuiltinAssets(),
    scenes: [scene],
    mainSceneId: scene.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function sprite(name: string, assetId: string, x: number, y: number, width: number, height: number, extra: Record<string, any> = {}): SceneNode {
  return createNode('Sprite2D', name, {
    x,
    y,
    zIndex: Number(extra.zIndex ?? 0),
    visible: extra.visible !== false,
    props: {
      assetId,
      width,
      height,
      opacity: extra.opacity ?? 1,
      flipX: Boolean(extra.flipX),
      glow: extra.glow ?? 0,
      glowColor: extra.glowColor,
      shadow: Boolean(extra.shadow)
    }
  })
}

function label(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  props: Record<string, any>
): SceneNode {
  return createNode('Label2D', name, {
    x,
    y,
    zIndex: 10,
    props: { width, height, ...props }
  })
}

function hud(): SceneNode {
  const layer = createNode('CanvasLayer', 'Interfaz')
  layer.children.push(
    label('Puntos', 130, 32, 220, 30, {
      bind: 'score',
      prefix: 'CHISPAS  ',
      fontSize: 19,
      color: '#facc15',
      align: 'left'
    }),
    label('Vidas', 104, 60, 168, 28, {
      bind: 'lives',
      prefix: 'VIDAS  ',
      fontSize: 17,
      color: '#fb7185',
      align: 'left'
    }),
    label('Titulo', 780, 32, 320, 28, {
      text: 'BOSQUE DE CHISPAS',
      fontSize: 14,
      color: '#7dd3fc',
      align: 'right'
    }),
    label('Ayuda', 480, 512, 620, 26, {
      text: '← → / A D para mover   ·   ESPACIO para saltar   ·   R para reiniciar',
      fontSize: 13,
      color: '#94a3b8',
      align: 'center',
      shadow: false
    })
  )
  return layer
}

const PLAYER_SCRIPT = `_ready() {
  this.speed = 315
  this.jump_force = 735
  this.coyote = 0
  this.buffer = 0
  this.invuln = 0
  this.facing = 1
  Game.on('damage', () => this.hurt())
}

_physics_process(dt) {
  const dir = Input.get_axis('left', 'right')
  this.velocity.x = dir * this.speed
  if (dir !== 0) {
    this.facing = dir
    const sprite = this.get_node('Aspecto')
    if (sprite) sprite.props.flipX = dir < 0
  }

  if (this.on_floor) this.coyote = 0.11
  else this.coyote = Math.max(0, this.coyote - dt)

  if (Input.is_action_just_pressed('jump')) this.buffer = 0.13
  else this.buffer = Math.max(0, this.buffer - dt)

  this.velocity.y += this.gravity * dt
  if (this.buffer > 0 && this.coyote > 0) {
    this.velocity.y = -this.jump_force
    this.buffer = 0
    this.coyote = 0
    this.play_sound('jump')
  }

  this.move_and_slide(dt)

  if (this.invuln > 0) {
    this.invuln -= dt
    const sprite = this.get_node('Aspecto')
    if (sprite) sprite.visible = Math.floor(this.invuln * 18) % 2 === 0
  } else {
    const sprite = this.get_node('Aspecto')
    if (sprite) sprite.visible = true
  }

  if (this.y > 430) this.hurt()
}

hurt() {
  if (this.invuln > 0) return
  this.invuln = 1.35
  this.play_sound('hit')
  this.shake(10, 0.32)
  Game.lives = Math.max(0, Game.lives - 1)
  if (Game.lives <= 0) {
    Game.game_over(false, 'Las sombras del bosque te atraparon')
    return
  }
  this.x = -380
  this.y = 120
  this.velocity.x = 0
  this.velocity.y = 0
}`

const COIN_SCRIPT = `_ready() {
  this.taken = false
}

_physics_process() {
  if (this.taken) return
  if (this.overlaps('player').length > 0) {
    this.taken = true
    Game.add_score(10)
    this.play_sound('coin')
    Game.emit('coin')
    this.queue_free()
  }
}`

const ENEMY_SCRIPT = `_ready() {
  this.dir = 1
  this.speed = 58
  this.min_x = this.x - 95
  this.max_x = this.x + 95
}

_physics_process(dt) {
  this.x += this.dir * this.speed * dt
  if (this.x < this.min_x || this.x > this.max_x) this.dir *= -1
  const sprite = this.get_node('Slime')
  if (sprite) sprite.props.flipX = this.dir < 0
  if (this.overlaps('player').length > 0) Game.emit('damage')
}`

const HAZARD_SCRIPT = `_physics_process() {
  if (this.overlaps('player').length > 0) Game.emit('damage')
}`

const GOAL_SCRIPT = `_physics_process() {
  if (this.overlaps('player').length > 0) {
    this.play_sound('win')
    Game.win('¡Has encontrado la chispa dorada!')
  }
}`

function coin(name: string, x: number, y: number): SceneNode {
  const node = createNode('Area2D', name, {
    x,
    y,
    props: { width: 34, height: 34, group: 'coin' },
    script: COIN_SCRIPT
  })
  node.children.push(sprite('Moneda', 'coin', 0, 0, 30, 30, { glow: 14, glowColor: '#facc15', shadow: false }))
  const sparkle = createNode('Particles2D', 'Brillo', {
    props: {
      color: '#fde68a',
      amount: 8,
      size: 2.5,
      lifetime: 0.7,
      speed: 34,
      spread: 360,
      gravity: -10
    }
  })
  node.children.push(sparkle)
  return node
}

export function platformerTemplate(): Project {
  const project = baseProject('Bosque de Chispas', {
    background: '#091c20',
    style: 'stars',
    accent: '#4ade80'
  })
  project.settings.gravity = 1750
  project.settings.background = '#091c20'
  const scene = project.scenes[0]
  scene.name = 'Bosque'
  scene.settings = { background: '#091c20', style: 'stars' }
  scene.root.name = 'Bosque'
  const root = scene.root

  const background = createNode('Node2D', 'Fondo', { zIndex: -10 })
  background.children.push(
    sprite('Luna', 'spark', 300, -170, 150, 150, { opacity: 0.45, glow: 40, glowColor: '#a7f3d0', shadow: false }),
    sprite('Nube lejana', 'cloud', -340, -150, 190, 90, { opacity: 0.18, shadow: false }),
    sprite('Nube alta', 'cloud', 80, -215, 130, 60, { opacity: 0.14, shadow: false }),
    sprite('Árbol izquierdo', 'tree', -590, 140, 150, 150, { opacity: 0.5, shadow: false }),
    sprite('Árbol medio', 'tree', -460, 175, 110, 110, { opacity: 0.32, shadow: false }),
    sprite('Árbol derecho', 'tree', 540, 155, 135, 135, { opacity: 0.38, shadow: false })
  )
  root.children.push(background)

  const camera = createNode('Camera2D', 'Cámara', {
    props: { active: true, zoom: 1, smoothing: 4.5, target: 'Jugador', offsetY: -20 }
  })
  root.children.push(camera)

  const ground = createNode('StaticBody2D', 'Suelo', {
    y: 260,
    props: { width: 1400, height: 60, color: '#10251f', edgeColor: '#34d399' }
  })
  root.children.push(ground)

  const platforms = [
    { name: 'Plataforma oeste', x: -520, y: 125, width: 210, height: 24, oneWay: true },
    { name: 'Plataforma baja', x: -265, y: 165, width: 220, height: 26, oneWay: false },
    { name: 'Plataforma media', x: 40, y: 80, width: 220, height: 26, oneWay: true },
    { name: 'Plataforma este', x: 360, y: 145, width: 205, height: 26, oneWay: true },
    { name: 'Plataforma alta', x: 570, y: 35, width: 190, height: 24, oneWay: true }
  ]
  for (const platform of platforms) {
    root.children.push(
      createNode('StaticBody2D', platform.name, {
        x: platform.x,
        y: platform.y,
        props: {
          width: platform.width,
          height: platform.height,
          color: '#142a27',
          edgeColor: '#4ade80',
          oneWay: platform.oneWay
        }
      })
    )
  }

  const player = createNode('CharacterBody2D', 'Jugador', {
    x: -380,
    y: 170,
    zIndex: 5,
    props: { width: 34, height: 48, bodyVisual: 'none', group: 'player' },
    script: PLAYER_SCRIPT
  })
  player.children.push(
    sprite('Aspecto', 'hero', 0, -4, 62, 62, { shadow: true }),
    createNode('Particles2D', 'Aura', {
      props: {
        color: '#86efac',
        amount: 5,
        size: 2,
        lifetime: 0.5,
        speed: 24,
        spread: 130,
        gravity: -25
      }
    })
  )
  root.children.push(player)

  const coinSpots = [
    [-520, 80],
    [-265, 120],
    [-160, 120],
    [40, 35],
    [360, 100],
    [570, -10],
    [660, 205],
    [-690, 205]
  ]
  coinSpots.forEach(([x, y], index) => root.children.push(coin(`Chispa ${index + 1}`, x, y)))

  const enemyA = createNode('Area2D', 'Slime patrulla', {
    x: -90,
    y: 205,
    props: { width: 54, height: 42, group: 'enemy' },
    script: ENEMY_SCRIPT
  })
  enemyA.children.push(sprite('Slime', 'slime', 0, 0, 44, 44, { shadow: true }))
  const enemyB = createNode('Area2D', 'Slime curioso', {
    x: 280,
    y: 205,
    props: { width: 54, height: 42, group: 'enemy' },
    script: ENEMY_SCRIPT
  })
  enemyB.children.push(sprite('Slime', 'slime', 0, 0, 40, 40, { shadow: true }))
  root.children.push(enemyA, enemyB)

  const spikeVisual = createNode('StaticBody2D', 'Pinchos visuales', {
    x: 465,
    y: 240,
    props: { width: 96, height: 20, color: '#32221c', edgeColor: '#fb7185', style: 'spikes' }
  })
  const spikeHazard = createNode('Area2D', 'Pinchos', {
    x: 465,
    y: 220,
    props: { width: 88, height: 34, group: 'hazard' },
    script: HAZARD_SCRIPT
  })
  root.children.push(spikeVisual, spikeHazard)

  const goal = createNode('Area2D', 'Meta', {
    x: 655,
    y: 185,
    zIndex: 4,
    props: { width: 50, height: 90, group: 'goal' },
    script: GOAL_SCRIPT
  })
  goal.children.push(sprite('Bandera', 'flag', 0, 0, 68, 68, { glow: 18, glowColor: '#facc15', shadow: true }))
  root.children.push(goal)

  root.children.push(hud())
  return project
}

const SHOOTER_PLAYER = `_ready() {
  this.speed = 380
  this.invuln = 0
  this.auto = 0.2
  Game.on('damage', () => this.hurt())
}

_process(dt) {
  this.auto -= dt
  if (this.auto <= 0) {
    this.auto = 0.2
    this.shoot()
  }
}

_physics_process(dt) {
  const dirX = Input.get_axis('left', 'right')
  const dirY = Input.get_axis('up', 'down')
  this.velocity.x = dirX * this.speed
  this.velocity.y = dirY * this.speed
  this.move_and_slide(dt)
  this.x = clamp(this.x, -430, 430)
  this.y = clamp(this.y, -220, 225)
  if (this.invuln > 0) {
    this.invuln -= dt
    const sprite = this.get_node('Aspecto')
    if (sprite) sprite.visible = Math.floor(this.invuln * 16) % 2 === 0
  } else {
    const sprite = this.get_node('Aspecto')
    if (sprite) sprite.visible = true
  }
}

shoot() {
  this.spawn('Bala', this.x, this.y - 34)
  this.play_sound('laser', 0.35)
}

hurt() {
  if (this.invuln > 0) return
  this.invuln = 1.5
  this.shake(15, 0.4)
  this.play_sound('hit')
  Game.lives = Math.max(0, Game.lives - 1)
  if (Game.lives <= 0) Game.game_over(false, 'La nave fue destruida en el cinturón de asteroides')
}`

const BULLET_SCRIPT = `_ready() {
  this.velocity.y = -680
}

_physics_process(dt) {
  this.y += this.velocity.y * dt
  if (this.y < -330) {
    this.queue_free()
    return
  }
  const hits = this.overlaps('enemy')
  if (hits.length > 0) {
    for (const enemy of hits) {
      Game.add_score(5)
      enemy.queue_free()
    }
    this.play_sound('explosion', 0.4)
    this.queue_free()
  }
}`

const ENEMY_SHOOTER_SCRIPT = `_ready() {
  this.speed = 85
  this.drift = rand(-35, 35)
  this.spin = rand(-1, 1)
}

_physics_process(dt) {
  this.y += this.speed * dt
  this.x += this.drift * dt
  this.rotation += this.spin * 35 * dt
  if (this.y > 330) {
    this.queue_free()
    return
  }
  if (this.overlaps('player').length > 0) {
    this.play_sound('hit')
    Game.emit('damage')
    this.queue_free()
  }
}`

const SPAWNER_SCRIPT = `_ready() {
  this.count = 0
}

_on_timeout() {
  this.count += 1
  const x = rand(-410, 410)
  const enemy = this.spawn('Enemigo', x, -310)
  if (enemy) enemy.speed = 72 + Math.min(140, this.count * 4)
}`

const SHOOTER_HUD = `_ready() {
  const layer = this.get_node('Interfaz')
}`

export function shooterTemplate(): Project {
  const project = baseProject('Cazador Estelar', {
    background: '#070b1c',
    style: 'stars',
    accent: '#818cf8'
  })
  project.settings.gravity = 0
  project.settings.background = '#070b1c'
  const scene = project.scenes[0]
  scene.name = 'Cinturón Estelar'
  scene.settings = { background: '#070b1c', style: 'stars' }
  scene.root.name = 'Cinturón Estelar'
  const root = scene.root

  const background = createNode('Node2D', 'Cosmos', { zIndex: -10 })
  background.children.push(
    sprite('Planeta lejano', 'orb', 350, -140, 260, 260, { opacity: 0.16, glow: 30, glowColor: '#6366f1', shadow: false }),
    sprite('Nebulosa', 'spark', -330, -110, 120, 120, { opacity: 0.18, glow: 30, glowColor: '#a78bfa', shadow: false })
  )
  root.children.push(background)

  const player = createNode('CharacterBody2D', 'Nave', {
    x: 0,
    y: 190,
    zIndex: 6,
    props: { width: 34, height: 42, bodyVisual: 'none', group: 'player' },
    script: SHOOTER_PLAYER
  })
  player.children.push(
    sprite('Aspecto', 'ship', 0, 0, 70, 70, { glow: 14, glowColor: '#38bdf8', shadow: false }),
    createNode('Particles2D', 'Propulsión', {
      props: {
        color: '#38bdf8',
        amount: 26,
        size: 3,
        lifetime: 0.45,
        speed: 65,
        spread: 38,
        gravity: -100
      }
    })
  )
  root.children.push(player)

  const templates = createNode('Node2D', 'Plantillas')
  const bullet = createNode('Area2D', 'Bala', {
    template: true,
    visible: false,
    props: { width: 14, height: 26, group: 'bullet' },
    script: BULLET_SCRIPT
  })
  bullet.children.push(sprite('Chispa', 'bolt', 0, 0, 24, 30, { glow: 12, glowColor: '#e0f2fe', shadow: false }))
  const enemy = createNode('Area2D', 'Enemigo', {
    template: true,
    visible: false,
    props: { width: 46, height: 46, group: 'enemy' },
    script: ENEMY_SHOOTER_SCRIPT
  })
  enemy.children.push(sprite('Alien', 'alien', 0, 0, 54, 54, { shadow: false, glow: 6, glowColor: '#a78bfa' }))
  templates.children.push(bullet, enemy)
  root.children.push(templates)

  const spawner = createNode('Timer', 'Generador', {
    props: { waitTime: 0.85, autostart: true, oneShot: false },
    script: SPAWNER_SCRIPT
  })
  root.children.push(spawner)

  const layer = createNode('CanvasLayer', 'Interfaz')
  layer.children.push(
    label('Puntos', 130, 32, 220, 30, {
      bind: 'score',
      prefix: 'PUNTOS  ',
      fontSize: 19,
      color: '#a5b4fc',
      align: 'left'
    }),
    label('Vidas', 100, 60, 160, 28, {
      bind: 'lives',
      prefix: 'VIDAS  ',
      fontSize: 17,
      color: '#fb7185',
      align: 'left'
    }),
    label('Titulo', 780, 32, 320, 28, {
      text: 'CAZADOR ESTELAR',
      fontSize: 14,
      color: '#818cf8',
      align: 'right'
    }),
    label('Ayuda', 480, 512, 630, 26, {
      text: 'WASD / flechas para volar   ·   disparo automático   ·   Esc pausa   ·   R reinicia',
      fontSize: 13,
      color: '#94a3b8',
      align: 'center',
      shadow: false
    })
  )
  root.children.push(layer)

  return project
}

export type TemplateId = 'platformer' | 'shooter' | 'empty'

export function createTemplate(id: TemplateId): Project {
  if (id === 'platformer') return platformerTemplate()
  if (id === 'shooter') return shooterTemplate()
  const project = baseProject('Proyecto sin título', { background: '#0b1220', style: 'grid', accent: '#38bdf8' })
  project.settings.gravity = 1600
  const scene = project.scenes[0]
  scene.name = 'Mundo'
  scene.root.name = 'Mundo'
  scene.root.children.push(
    createNode('Camera2D', 'Cámara', { props: { active: true, zoom: 1, target: '' } }),
    createNode('CharacterBody2D', 'Jugador', {
      props: { width: 38, height: 54, color: '#4ade80', group: 'player' },
      children: [sprite('Aspecto', 'hero', 0, 0, 64, 64)]
    }),
    createNode('StaticBody2D', 'Suelo', {
      y: 250,
      props: { width: 1100, height: 40, color: '#172136', edgeColor: '#38bdf8' }
    })
  )
  rootCanvas(scene.root)
  return project
}

function rootCanvas(root: SceneNode): void {
  const layer = createNode('CanvasLayer', 'Interfaz')
  layer.children.push(
    label('Título', 160, 32, 280, 30, {
      text: 'MI NUEVO JUEGO',
      fontSize: 18,
      color: '#7dd3fc',
      align: 'left'
    })
  )
  root.children.push(layer)
}

export const TEMPLATE_INFO: Array<{ id: TemplateId; name: string; description: string; tag: string; accent: string }> = [
  {
    id: 'platformer',
    name: 'Bosque de Chispas',
    description: 'Plataformas, saltos, monedas y slimes. Ideal para empezar en 2D.',
    tag: 'PLATAFORMAS',
    accent: '#4ade80'
  },
  {
    id: 'shooter',
    name: 'Cazador Estelar',
    description: 'Nave, disparos automáticos, enemigos y puntuación.',
    tag: 'ARCADE',
    accent: '#818cf8'
  },
  {
    id: 'empty',
    name: 'Proyecto vacío',
    description: 'Una escena mínima con jugador, cámara y suelo.',
    tag: 'DESDE CERO',
    accent: '#38bdf8'
  }
]

export function uniqueSceneId(): string {
  return uid('scene')
}
