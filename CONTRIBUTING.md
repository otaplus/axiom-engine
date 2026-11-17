# Contribuir a Axiom Engine

Gracias por querer mejorar el motor. Axiom está en alfa y prioriza un flujo de trabajo claro, pruebas reproducibles y cambios pequeños.

## Entorno

- Node.js 20+ (probado con Node 24).
- Windows 10/11 para la app de escritorio.
- `npm install`
- `npm run dev`

## Antes de abrir un PR

```bash
npm run typecheck
npm test
npm run build
```

Si tocas el runtime o la UI, prueba también el flujo de juego y, si es posible, ejecuta `node scripts/e2e.mjs` en Windows.

## Estilo

- TypeScript estricto.
- Componentes React funcionales y stores de Zustand.
- Sin dependencias nuevas para cosas que se resuelven en pocas líneas.
- Nombres de dominio en español en la UI y en los datos del proyecto; código e identificadores internos en inglés.
- Los scripts generados por IA deben seguir el formato de `docs/SCRIPTING.md`.

## Áreas de contribución

- Motor: física, colisiones, cámara, partículas, animaciones.
- Editor: tilemaps, animaciones, depurador, atajos, accesibilidad.
- IA: nuevas acciones, herramientas, proveedores, evaluación de prompts.
- Distribución: export web, instalador firmado, actualizaciones.
- Documentación y ejemplos jugables.

## Commits

Usa mensajes claros en presente, por ejemplo:

```text
Añade plataformas de un solo sentido al runtime
Corrige la extracción del bloque de acciones
Documenta la API de scripting
```

## Seguridad

No incluyas claves API, archivos de usuario ni builds en los commits. El `.gitignore` ya excluye `release/`, `node_modules/`, `.test-user-data/` y las capturas de pruebas.

Los scripts de los juegos se ejecutan localmente. Cualquier cambio en el sandbox de scripts debe explicar su impacto de seguridad.

## Licencia

Al contribuir aceptas que tu aporte se publique bajo la licencia MIT del proyecto.
