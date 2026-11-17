# Seguridad

## Claves API

- La clave se introduce en el proceso de renderer, pero se envía inmediatamente al proceso principal por IPC.
- Se guarda cifrada con `safeStorage` (DPAPI en Windows) en `userData/ai-settings.json`.
- El renderer solo recibe `hasApiKey` y los últimos cuatro caracteres.
- Las peticiones al proveedor salen del proceso principal.
- No hay telemetría ni envío de datos a servidores de Axiom.

## Scripts de juegos

Los scripts se ejecutan dentro del renderer con `new Function`. Tienen acceso al DOM y a las APIs del navegador disponibles en ese contexto. El aislamiento de Electron (`contextIsolation: true`, `nodeIntegration: false`) impide el acceso directo a Node.js, pero **un proyecto `.axiom` de una fuente no confiable puede contener scripts maliciosos**. Revisa los scripts antes de abrir proyectos de terceros.

La CSP bloquea conexiones externas no declaradas y restringe recursos. El motor permite `unsafe-eval` porque necesita compilar los scripts del juego en tiempo de ejecución.

## Actualizaciones

- Las actualizaciones se descargan desde GitHub Releases.
- El instalador se verifica con el checksum SHA-256 publicado junto al archivo.
- El instalador de Windows no está firmado digitalmente en esta etapa alfa; Windows SmartScreen puede mostrar un aviso.
- En Linux, si el llavero del sistema no está disponible, la clave se guarda localmente en texto codificado en lugar de cifrada. Axiom lo indica en los ajustes.

## Reportar una vulnerabilidad

Abre un issue privado o contacta al mantenedor del repositorio cuando esté publicado. Incluye una descripción, pasos para reproducir y el impacto. No publiques claves ni datos personales.
