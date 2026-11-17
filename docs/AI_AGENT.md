# Protocolo del agente IA

Axiom no usa una llamada de función propietaria: el Copiloto recibe el contexto del proyecto y responde con una explicación en español seguida de un bloque JSON delimitado por `<acciones>`. Esto funciona con cualquier proveedor compatible con OpenAI Chat Completions.

## Formato

```text
He añadido una plataforma y una moneda.

<acciones>
{"actions":[
  {"type":"add_node","scene":"Bosque","parent":"Bosque","node":{
    "name":"Plataforma nueva","type":"StaticBody2D","x":120,"y":80,
    "props":{"width":180,"height":24,"oneWay":true}
  }}
]}
</acciones>
```

- El bloque debe ser JSON válido, sin comentarios ni comas finales.
- Solo se procesa el último bloque.
- Si solo hay una pregunta o consejo, no se incluye bloque.
- El parser también acepta `<actions>`, vallas Markdown y `{"acciones":[...]}`.

## Acciones

### `set_project`

```json
{
  "type": "set_project",
  "name": "Mi juego",
  "settings": {
    "width": 960,
    "height": 540,
    "gravity": 1600,
    "background": "#0d1526",
    "backgroundStyle": "stars",
    "accent": "#38bdf8",
    "pixelArt": false,
    "showFps": false
  }
}
```

### `create_scene`

```json
{
  "type": "create_scene",
  "name": "Nivel 2",
  "setMain": false,
  "settings": {"background": "#0b1220", "style": "grid"}
}
```

También acepta `root` con un árbol completo de nodos.

### `add_node`

```json
{
  "type": "add_node",
  "scene": "Nivel 1",
  "parent": "Nivel 1",
  "node": {
    "name": "Jugador",
    "type": "CharacterBody2D",
    "x": 0,
    "y": 100,
    "rotation": 0,
    "scaleX": 1,
    "scaleY": 1,
    "visible": true,
    "zIndex": 0,
    "props": {"width": 36, "height": 52, "group": "player"},
    "script": "_ready() { this.speed = 300 }",
    "children": []
  }
}
```

`parent` es una ruta por nombres. Los nombres de hermanos se hacen únicos automáticamente.

### `update_node`

```json
{
  "type": "update_node",
  "scene": "Nivel 1",
  "target": "Jugador",
  "patch": {
    "x": 20,
    "visible": true,
    "props": {"color": "#38bdf8"},
    "script": "..."
  }
}
```

`props` se fusiona con las existentes. `target` acepta una ruta como `Nivel 1/Enemigos/Jefe` o un nombre global único.

### `set_script`

```json
{"type":"set_script","scene":"Nivel 1","target":"Jugador","code":"_ready() { ... }"}
```

Código vacío elimina el script. La sintaxis se valida antes de aplicar.

### `delete_node` / `duplicate_node`

```json
{"type":"delete_node","scene":"Nivel 1","target":"Enemigo 2"}
{"type":"duplicate_node","scene":"Nivel 1","target":"Plataforma","name":"Plataforma copia"}
```

### `create_asset`

```json
{"type":"create_asset","asset":{"name":"Cristal","kind":"emoji","glyph":"🔮","background":"#2e1065"}}
{"type":"create_asset","asset":{"name":"Bloque","kind":"shape","shape":"rect","color":"#7dd3fc","color2":"#0ea5e9"}}
```

El id se deriva del nombre (`cristal`, `bloque`). La respuesta del agente debe usar esos ids.

### `set_main_scene` / `set_scene_settings`

```json
{"type":"set_main_scene","scene":"Nivel 2"}
{"type":"set_scene_settings","scene":"Nivel 2","settings":{"background":"#140b24","style":"stars"}}
```

## Validación y transaccionalidad

`applyActions` clona el proyecto, aplica las acciones en orden y recopila errores. Los tipos de nodo se normalizan (por ejemplo `Sprite` → `Sprite2D`). Las acciones con errores no bloquean al resto. Al final:

- Si hubo cambios, el proyecto se guarda en el historial una sola vez.
- Si solo hubo errores, no se modifica el proyecto.
- Los errores se muestran en la tarjeta del chat y en la consola.
- El usuario puede deshacer todo el lote.

## Contexto enviado al modelo

`buildSystemPrompt` incluye:

- Instrucciones de diseño y formato.
- Resumen del proyecto y assets.
- Árbol completo de la escena activa con props y scripts.
- Nodo seleccionado con su JSON.
- Referencia de la API de scripting y de las acciones.

El árbol se trunca a ~28 000 caracteres para mantener el contexto bajo control. El historial de conversación se limita a los últimos 12 mensajes.

## Modo agente

- **Agente activo**: las acciones se aplican al terminar el streaming.
- **Agente desactivado**: la tarjeta muestra “Aplicar cambios” y el usuario decide.
- La conversación y la preferencia se guardan en `localStorage`.
- La clave API nunca se incluye en el prompt ni en el historial.

## Proveedores

La integración usa `POST {baseUrl}/chat/completions` con `stream: true` y `Authorization: Bearer ...`. Para modelos de razonamiento se omite `temperature` y se muestran los `reasoning_content` en un bloque plegable.

Proveedores probados por diseño: DeepSeek, OpenAI, OpenRouter y Ollama. Cualquier endpoint compatible con Chat Completions debería funcionar.

## Extender el agente

1. Añade la acción a `src/renderer/src/engine/actions.ts`.
2. Documenta su esquema en `src/renderer/src/ai/prompt.ts`.
3. Añade un test en `tests/engine.test.ts`.
4. Actualiza este documento.
