# API de scripting

Los scripts de Axiom son el comportamiento de un nodo. Se escribe **solo el cuerpo de la clase** (métodos y campos), sin `class`, `import` ni `export`.

```js
_ready() {
  this.speed = 300
}

_physics_process(dt) {
  this.x += this.speed * dt
}
```

El runtime envuelve el código en una clase y lo ejecuta con un contexto que expone el nodo.

## Ciclo de vida

| Hook | Cuándo se ejecuta |
| --- | --- |
| `_ready()` | Una vez, después de construir el árbol |
| `_process(dt)` | Cada frame renderizado |
| `_physics_process(dt)` | Cada paso de física (60 Hz) |
| `_on_area_entered(otro)` | Un área empieza a solaparse con este nodo |
| `_on_body_entered(otro)` | Un cuerpo de personaje entra en un área |
| `_on_area_exited(otro)` | Termina el solapamiento |
| `_on_body_exited(otro)` | Un cuerpo sale del área |
| `_on_timeout()` | Un `Timer` llega a cero |

## Propiedades de `this`

| Propiedad | Tipo | Descripción |
| --- | --- | --- |
| `x`, `y` | number | Posición local (centro del nodo) |
| `position` | `{x,y}` | Alias de posición |
| `rotation` | number | Grados |
| `scaleX`, `scaleY` | number | Escala |
| `visible` | boolean | Visibilidad |
| `zIndex` | number | Orden de dibujo |
| `props` | object | Propiedades editables del nodo |
| `width`, `height` | number | Tamaño de colisión/visual |
| `velocity` | `{x,y}` | Velocidad en px/s |
| `on_floor` / `is_on_floor` | boolean | Último contacto con suelo |
| `gravity` | number | Gravedad del proyecto |
| `name`, `type` | string | Identidad del nodo |
| `game` | Game | Fachada del juego |
| `time` | number | Tiempo de partida |

## Métodos de `this`

### Nodos

```js
const sprite = this.get_node('Aspecto')
const enemigo = this.find_node('Jefe')
const hijos = this.get_children()
if (sprite) sprite.props.flipX = true
```

`get_node` busca desde el nodo actual; `find_node` busca en toda la escena. Devuelven un contexto de script (o el nodo) y `null` si no existe.

### Física

```js
this.velocity.x = 200
this.velocity.y += this.gravity * dt
this.move_and_slide(dt)
```

- Solo los `CharacterBody2D` usan `move_and_slide`.
- Resuelve contra `StaticBody2D`; respeta `oneWay`.
- Aplica la gravedad manualmente.
- Para top-down, pon la gravedad del proyecto a 0 y mueve en ambos ejes.

### Detección

```js
if (this.overlaps('player').length > 0) {
  Game.add_score(10)
  this.queue_free()
}
```

`overlaps(filtro)` acepta grupo, nombre o tipo. Sin filtro devuelve todos los nodos que solapan.

### Instanciar plantillas

Marca un nodo como plantilla (`template: true`), preferiblemente bajo un `Node2D` llamado `Plantillas` en `(0,0)`.

```js
_ready() {
  this.cooldown = 0
}

_process(dt) {
  this.cooldown -= dt
  if (this.cooldown <= 0 && Input.is_action_pressed('shoot')) {
    this.cooldown = 0.2
    const bala = this.spawn('Bala', this.x, this.y - 24)
    if (bala) bala.velocity.y = -700
  }
}
```

La plantilla debe tener su propio script. El clon se añade a la raíz y ejecuta `_ready`.

### Utilidades

```js
this.play_sound('coin', 0.5)
this.shake(8, 0.25)
this.set_prop('color', '#f97316')
this.start_timer(2)
this.stop_timer()
this.add_score(5)
this.game_over(false, 'Has caído')
this.queue_free()
```

## Globales

| Global | Uso |
| --- | --- |
| `Input` | Acciones, teclas y ratón |
| `Game` | Puntuación, vidas, variables, eventos, reinicio |
| `print(...)` | Escribe en la consola del editor |
| `rand(min,max)`, `randInt(min,max)` | Números aleatorios |
| `clamp(v,min,max)`, `lerp(a,b,t)`, `dist(a,b)` | Matemáticas |
| `Vector2(x,y)` | Crea un vector simple |
| `TAU`, `PI` | Constantes |
| `sfx(name, volume)` | Reproduce un sonido |

## Input

```js
Input.is_action_pressed('left')
Input.is_action_just_pressed('jump')
Input.get_axis('left', 'right')       // -1, 0 o 1
Input.is_key_pressed('Space')
Input.is_key_just_pressed('KeyE')
Input.is_mouse_pressed(0)
Input.mouse_position                  // píxeles de pantalla
Input.mouse_world                     // coordenadas del mundo
Input.get_mouse_position()
```

Acciones incluidas: `left`, `right`, `up`, `down`, `jump`, `action`, `shoot`, `dash`, `restart`, `pause`.

También existen alias en español: `izquierda`, `derecha`, `arriba`, `abajo`, `saltar`, `accion`, `disparar`.

## Game

```js
Game.score
Game.lives
Game.time
Game.width
Game.height
Game.state
Game.vars

Game.add_score(10)
Game.set_var('llave', true)
Game.get_var('llave', false)
Game.emit('checkpoint', { id: 2 })
Game.on('checkpoint', (data) => { ... })
Game.spawn('Bala', x, y)
Game.shake(8, 0.25)
Game.pause()
Game.restart()
Game.game_over(false, 'Fin del juego')
Game.win('¡Nivel completado!')
Game.lose('Inténtalo otra vez')
```

Los labels con `bind: "score"` muestran `Game.score` automáticamente. También funcionan `lives` y `time`.

## Sonidos

`jump`, `coin`, `hit`, `laser`, `explosion`, `powerup`, `click`, `win`, `lose`, `blip`.

Son efectos sintetizados con Web Audio; no requieren archivos.

## HUD

Los nodos hijos de `CanvasLayer` usan coordenadas de pantalla desde la esquina superior izquierda. La posición de un `Label2D` es su centro.

```json
{
  "name": "Puntos",
  "type": "Label2D",
  "x": 130,
  "y": 32,
  "props": {
    "width": 220,
    "height": 30,
    "bind": "score",
    "prefix": "PUNTOS  ",
    "fontSize": 19,
    "color": "#facc15",
    "align": "left"
  }
}
```

## Sistema de coordenadas

- Resolución por defecto: 960 × 540.
- Origen `(0,0)` en el centro de la pantalla.
- X crece a la derecha; Y crece hacia abajo.
- El suelo habitual está en `y ≈ 240`.
- Los cuerpos físicos deben colgar de la raíz o de grupos en `(0,0)` para que su posición local coincida con el mundo.

## Errores comunes

- `this.get_node` devuelve `null` si el nombre no existe o no es descendiente. Usa `find_node` para búsqueda global.
- `move_and_slide` solo existe en `CharacterBody2D`.
- `spawn` necesita una plantilla con `template: true` y un nombre único.
- No uses `import`, `export` ni `class`: el editor ya envuelve el código.
- No olvides llamar a `move_and_slide(dt)`; cambiar `velocity` por sí solo no mueve el cuerpo.
