# Changelog

## 0.3.0 — 2026-11-17

### Añadido

- Instalador de Windows con Inno Setup, instalación por usuario y acceso en el menú.
- Comprobación automática de actualizaciones en GitHub Releases.
- Descarga con progreso, verificación SHA-256 e instalación con reinicio automático en Windows.
- Pantalla de actualizaciones y aviso flotante cuando hay una versión nueva.
- Soporte Linux: ventana sin marco con controles propios, paquete `tar.gz` y script `install-linux.sh`.
- Enlaces de la aplicación a la release y al repositorio.
- Comandos `dist:win` y `dist:linux`.

### Cambiado

- La build de Windows ahora incluye instalador además del ZIP portable.
- La versión actual se lee dinámicamente en la barra de estado.
- Documentación de instalación, Linux y autoactualización.

## 0.2.0 — 2026-11-17

### Añadido

- Presets para 16 proveedores de IA: DeepSeek, OpenAI, Anthropic Claude, Google Gemini, xAI Grok, OpenRouter, Groq, Mistral AI, Together AI, Perplexity, GitHub Models, Hugging Face, Ollama, LM Studio, vLLM y endpoints personalizados.
- Adaptador nativo para Anthropic Messages API (cabeceras, system prompt, streaming SSE y modelos).
- Soporte para proveedores locales sin clave API (`Ollama`, `LM Studio`, `vLLM` y URLs locales).
- Enlaces contextuales para obtener la clave de cada proveedor.
- Nueva captura y documentación de proveedores.
- Versión dinámica en la barra de estado.
- Pruebas end-to-end del adaptador Anthropic y de un proveedor local sin clave.

### Cambiado

- El estado de conexión reconoce proveedores locales sin clave.
- El mensaje de falta de clave ya no asume DeepSeek.
- Se actualizó la documentación de proveedores y scripting.

## 0.1.0 — 2026-11-17

- Primera alfa pública.
- Editor visual 2D, runtime, scripts, plantillas y Copiloto DeepSeek.
- Build portable de Windows y documentación en español.
