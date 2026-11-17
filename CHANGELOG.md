# Changelog

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
