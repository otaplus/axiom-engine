# Arquitectura de Axiom Engine

Axiom es una aplicación Electron con tres procesos bien separados: **main**, **preload** y **renderer**. El renderer contiene a la vez el editor (React) y el motor de juego (TypeScript puro sobre Canvas 2D).

## Vista general

```text
┌──────────────────────────────────────────────────────────────┐
│ Electron main                                                 │
│  · ventana y ciclo de vida                                    │
│  · diálogos de archivo                                        │
│  · almacén cifrado de la clave API                            │
│  · proxy de streaming hacia DeepSeek / proveedor compatible   │
└──────────────────────────────┬───────────────────────────────┘
                               │ IPC tipado (contextBridge)
┌──────────────────────────────▼───────────────────────────────┐
│ Preload                                                       │
│  window.axiom.ai / settings / project / app                   │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ Renderer (React + TypeScript)                                 │
│                                                               │
│  Editor UI                Motor 2D                  IA        │
│  · árbol de escena        · GameRuntime            · Copiloto │
│  · viewport               · física AABB            · acciones │
│  · inspector              · scripts                · historial│
│  · assets / consola       · cámara / HUD                      │
│  · Zustand stores         · Canvas 2D                         │
└──────────────────────────────────────────────────────────────┘
```

## Proceso principal

`src/main/index.ts`

- Crea `BrowserWindow` con `contextIsolation`, sin `nodeIntegration` y con preload.
- Registra los handlers IPC.
- Abre/guarda proyectos mediante diálogos nativos.
- Mantiene una única instancia.

`src/main/ai.ts`

- Recibe las peticiones del Copiloto y las envía al endpoint configurado.
- Lee la clave desde el proceso principal; el renderer solo recibe un indicador (`hasApiKey`) y los últimos cuatro caracteres.
- Transforma SSE en eventos `ai:chunk`, `ai:reasoning`, `ai:done` y `ai:error`.
- Soporta cancelación por `requestId`.

`src/main/settings.ts`

- Persiste proveedor, URL base, modelo y temperatura en `userData/ai-settings.json`.
- Cifra la clave con `safeStorage` (DPAPI en Windows).
- Permite usar `DEEPSEEK_API_KEY` u `OPENAI_API_KEY` del entorno como respaldo.

## Modelo de proyecto

El archivo `.axiom` es JSON con:

```ts
interface Project {
  format: 'axiom-project'
  version: 1
  name: string
  settings: ProjectSettings
  assets: Asset[]
  scenes: Scene[]
  mainSceneId: string
  createdAt: string
  updatedAt: string
}
```

Cada escena tiene un árbol de `SceneNode`. Los nodos guardan transformación, visibilidad, z-index, props específicas del tipo, hijos y un script opcional. Los assets pueden ser emoji, formas vectoriales, vectores propios o imágenes en data URL.

`normalizeProject` valida y migra proyectos al abrirlos y al cargar el autoguardado. Añade assets base que falten y garantiza IDs y nombres únicos.

## Runtime del juego

`src/renderer/src/engine/runtime.ts`

- `GameRuntime` construye un árbol de `RuntimeNode` a partir de la escena.
- Ejecuta `_ready` y después un bucle de `requestAnimationFrame`.
- `_process` corre una vez por frame; la física corre a pasos fijos de 1/60 s con un acumulador (máximo 5 pasos por frame).
- `move_and_slide` resuelve las colisiones AABB contra `StaticBody2D`, incluyendo plataformas de un solo sentido y substeps para evitar tunneling.
- Las `Area2D` se comparan por AABB y disparan `_on_area_entered`, `_on_body_entered`, etc.
- La cámara busca una `Camera2D` activa, sigue su `target` y aplica zoom/suavizado/shake.
- Las partículas se simulan por nodo y se dibujan en coordenadas del mundo.
- El HUD vive en `CanvasLayer` y se dibuja en coordenadas de pantalla después del mundo.
- Los errores de scripts se capturan y se registran en la consola sin detener la partida.

El runtime no importa React. El canvas y el proyecto son sus únicas dependencias externas.

## Renderer

`src/renderer/src/engine/draw.ts` dibuja fondos, sprites, cuerpos, plataformas, etiquetas y partículas. `assets.ts` resuelve emojis, formas, vectores e imágenes.

`editorRenderer.ts` reutiliza el mismo lenguaje visual para el editor y añade:

- Fondo de editor con cuadrícula infinita.
- Marco del juego y etiqueta de resolución.
- Selección, hover, asas y bounding boxes.
- Dibujo de formas de colisión.
- HUD en espacio de pantalla.

El canvas del juego se escala por CSS manteniendo la relación de aspecto; su resolución lógica es la del proyecto.

## Scripts

`script.ts` compila el código con `new Function` y devuelve una clase. Cada nodo crea una instancia y un **contexto Proxy**:

- Las propiedades (`x`, `y`, `velocity`, `props`, `width`, ...) se leen y escriben directamente sobre el `RuntimeNode`.
- Los métodos (`move_and_slide`, `spawn`, `overlaps`, `queue_free`, ...) se enlazan al nodo.
- Los campos auxiliares que define el usuario (`this.speed`, `this.cooldown`) viven en el contexto del script.
- Los globales (`Input`, `Game`, `rand`, `clamp`, ...) se inyectan en el momento de compilar.

Un error de sintaxis se detecta al guardar el script y también al aplicar acciones de IA. Un error de ejecución se captura por hook.

## Flujo de IA

1. El usuario escribe en el Copiloto.
2. `buildSystemPrompt` construye un contexto con la escena activa, el árbol, los scripts y los assets.
3. El proceso principal llama al proveedor con streaming.
4. El renderer muestra el texto y acumula la respuesta.
5. Al terminar, `parseAIResponse` extrae el bloque `<acciones>`.
6. `applyActions` valida y aplica cada acción sobre una copia del proyecto.
7. El proyecto resultante se convierte en una nueva entrada del historial y se registra en la consola.
8. La tarjeta del mensaje muestra los cambios y permite deshacer el lote.

El modo agente se puede desactivar en el compositor para revisar los cambios antes de aplicarlos.

## Estado del editor

Tres stores de Zustand:

- `store/editor.ts`: proyecto, escena activa, selección, cámara, historial, logs y modales.
- `store/ai.ts`: conversación, streaming, acciones pendientes y preferencia de auto-aplicar.
- `store/settings.ts`: configuración pública del proveedor de IA.

El autoguardado copia proyecto, escena activa y cámara a `localStorage` con un debounce de 550 ms. Los proyectos abiertos desde disco se guardan como JSON validado.

## Seguridad

- `nodeIntegration: false`, `contextIsolation: true`.
- La API expuesta al renderer es explícita y pequeña.
- La clave nunca cruza el puente IPC.
- CSP restringe scripts, estilos, imágenes y conexiones.
- Los scripts del juego se ejecutan localmente; están pensados para código propio o generado por el usuario. No se debe abrir un proyecto de una fuente no confiable sin revisar sus scripts.

## Pruebas

- Unitarias (`tests/engine.test.ts`): modelo, plantillas, acciones, parser y compilación de scripts.
- End-to-end (`scripts/e2e.mjs`): abre Electron, juega una partida, recoge monedas, comprueba daño/victoria/reinicio, cambia de plantilla y valida el flujo completo de IA contra un servidor local que imita a DeepSeek.
- Empaquetado (`scripts/test-packaged.mjs`): verifica que la build `release/win-unpacked` arranca y reproduce una escena.
