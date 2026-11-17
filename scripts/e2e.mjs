import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = 9334
const MOCK_PORT = 9999
const root = resolve('.')
const electronPath = resolve('node_modules/electron/dist/electron.exe')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_ENABLE_LOGGING
env.AXIOM_USER_DATA = resolve('.test-user-data')
env.AXIOM_NO_SANDBOX = '1'
env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
mkdirSync(resolve('screenshots'), { recursive: true })

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

// ---------------------------------------------------------------------------
// Mock OpenAI-compatible server used to exercise the full AI pipeline.
// ---------------------------------------------------------------------------
const aiActions = [
  {
    type: 'create_asset',
    asset: { name: 'Reliquia IA', kind: 'emoji', glyph: '💠', background: '#172554' }
  },
  {
    type: 'add_node',
    scene: 'Bosque',
    parent: 'Bosque',
    node: {
      name: 'Moneda IA',
      type: 'Area2D',
      x: 20,
      y: -110,
      props: { width: 38, height: 38, group: 'coin' },
      script:
        '_physics_process() {\n  if (this.overlaps("player").length > 0) {\n    Game.add_score(25)\n    this.play_sound("coin")\n    this.queue_free()\n  }\n}',
      children: [
        {
          name: 'Icono',
          type: 'Sprite2D',
          props: { assetId: 'coin', width: 36, height: 36, glow: 14, glowColor: '#fbbf24' }
        }
      ]
    }
  },
  {
    type: 'add_node',
    scene: 'Bosque',
    parent: 'Bosque',
    node: {
      name: 'Reliquia IA',
      type: 'Area2D',
      x: 150,
      y: -90,
      props: { width: 40, height: 40, group: 'relic' },
      children: [
        {
          name: 'Icono',
          type: 'Sprite2D',
          props: { assetId: 'reliquia_ia', width: 40, height: 40, glow: 18, glowColor: '#818cf8' }
        }
      ]
    }
  },
  {
    type: 'update_node',
    scene: 'Bosque',
    target: 'Titulo',
    patch: { props: { text: 'BOSQUE MEJORADO', color: '#facc15' } }
  }
]
const mockReply = `He añadido una **moneda especial** que vale 25 chispas, una reliquia brillante y he actualizado el título del HUD.\n\n<acciones>${JSON.stringify({ actions: aiActions })}</acciones>`

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url?.startsWith('/v1/models')) {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-deepseek' }, { id: 'mock-reasoner' }] }))
    return
  }
  if (request.method === 'GET' && request.url?.startsWith('/anthropic/v1/models')) {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ data: [{ id: 'mock-claude' }, { id: 'mock-claude-sonnet' }] }))
    return
  }
  if (request.method === 'POST' && request.url?.startsWith('/anthropic/v1/messages')) {
    let body = ''
    request.on('data', (chunk) => (body += chunk))
    request.on('end', async () => {
      let parsed = {}
      try {
        parsed = JSON.parse(body)
      } catch {
        // ignore
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      response.write(
        `event: message_start\ndata: ${JSON.stringify({
          type: 'message_start',
          message: { id: 'msg_mock', usage: { input_tokens: 120, output_tokens: 1 } }
        })}\n\n`
      )
      response.write(
        `event: content_block_start\ndata: ${JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' }
        })}\n\n`
      )
      const text = `Soy Claude simulado. Recibí ${parsed.messages?.length ?? 0} mensajes y un system prompt de ${String(parsed.system ?? '').length} caracteres.`
      for (let index = 0; index < text.length; index += 25) {
        response.write(
          `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: text.slice(index, index + 25) }
          })}\n\n`
        )
        await sleep(12)
      }
      response.write(
        `event: message_delta\ndata: ${JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: 30 }
        })}\n\n`
      )
      response.write('event: message_stop\ndata: {"type":"message_stop"}\n\n')
      response.end()
    })
    return
  }
  if (request.method === 'POST' && request.url?.startsWith('/v1/chat/completions')) {
    let body = ''
    request.on('data', (chunk) => (body += chunk))
    request.on('end', async () => {
      let parsed = {}
      try {
        parsed = JSON.parse(body)
      } catch {
        // ignore
      }
      if (parsed.stream === false) {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(
          JSON.stringify({
            id: 'mock',
            object: 'chat.completion',
            choices: [{ index: 0, message: { role: 'assistant', content: 'conexión correcta' }, finish_reason: 'stop' }]
          })
        )
        return
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      const chunks = []
      for (let index = 0; index < mockReply.length; index += 30) chunks.push(mockReply.slice(index, index + 30))
      for (const chunk of chunks) {
        response.write(
          `data: ${JSON.stringify({
            id: 'mock',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }]
          })}\n\n`
        )
        await sleep(18)
      }
      response.write(
        `data: ${JSON.stringify({
          id: 'mock',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 }
        })}\n\n`
      )
      response.write('data: [DONE]\n\n')
      response.end()
    })
    return
  }
  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ error: { message: 'Not found' } }))
})

await new Promise((resolvePromise) => server.listen(MOCK_PORT, '127.0.0.1', resolvePromise))
rmSync(resolve('.test-user-data'), { recursive: true, force: true })

const child = spawn(electronPath, ['.', '--no-sandbox', `--remote-debugging-port=${PORT}`], {
  cwd: root,
  env,
  stdio: 'ignore',
  detached: false
})

async function waitForCdp() {
  for (let index = 0; index < 60; index += 1) {
    try {
      const result = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (result.ok) return true
    } catch {
      // keep polling
    }
    await sleep(300)
  }
  return false
}

const errors = []
let browser
let page
try {
  if (!(await waitForCdp())) throw new Error('CDP no arrancó')
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
  page = browser.contexts().flatMap((context) => context.pages())[0]
  if (!page) throw new Error('No hay ventana de Electron')
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.reload()
  await page.waitForTimeout(2200)
  await page.evaluate(() => {
    window.__AXIOM__.editor.getState().newProject('platformer')
    window.__AXIOM__.ai.getState().clearConversation()
  })
  await page.waitForTimeout(900)

  await page.screenshot({ path: 'screenshots/01-editor.png' })

  // Zoom and node drag sanity checks in the editor viewport.
  const zoomBefore = await page.evaluate(() => window.__AXIOM__.editor.getState().camera.zoom)
  await page.mouse.move(700, 380)
  await page.mouse.wheel(0, -180)
  await page.waitForTimeout(250)
  const zoomAfter = await page.evaluate(() => window.__AXIOM__.editor.getState().camera.zoom)
  await page.locator('.viewport-toolbar .icon-btn[title="Centrar y ajustar escena"]').click()
  await page.waitForTimeout(250)
  console.log('ZOOM:', zoomBefore, '->', zoomAfter)

  // Settings modal (before connecting, shows the DeepSeek onboarding).
  await page.locator('.title-actions .icon-btn[title="Ajustes de IA"]').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'screenshots/02-settings.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // New project modal.
  await page.keyboard.press('Control+n')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'screenshots/03-templates.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Select the player, open the script editor.
  await page.locator('.tree-row', { hasText: 'Jugador' }).first().click()
  await page.waitForTimeout(250)

  // Drag the selected player sprite with the mouse and undo it.
  const dragInfo = await page.evaluate(() => {
    const state = window.__AXIOM__.editor.getState()
    const scene = state.project.scenes.find((item) => item.id === state.activeSceneId)
    const player = scene.root.children.find((node) => node.name === 'Jugador')
    const canvas = document.querySelector('.editor-canvas')
    const rect = canvas.getBoundingClientRect()
    const screenX = rect.left + rect.width / 2 + (player.x - state.camera.x) * state.camera.zoom
    const screenY = rect.top + rect.height / 2 + (player.y - state.camera.y) * state.camera.zoom
    return { screenX, screenY, playerX: player.x, playerY: player.y }
  })
  await page.mouse.move(dragInfo.screenX, dragInfo.screenY)
  await page.mouse.down()
  await page.mouse.move(dragInfo.screenX + 56, dragInfo.screenY + 24, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const afterDrag = await page.evaluate(() => {
    const state = window.__AXIOM__.editor.getState()
    const scene = state.project.scenes.find((item) => item.id === state.activeSceneId)
    const player = scene.root.children.find((node) => node.name === 'Jugador')
    return { playerX: player.x, playerY: player.y, past: state.past.length }
  })
  console.log('DRAG:', dragInfo.playerX, '->', afterDrag.playerX, 'history:', afterDrag.past)
  await page.evaluate(() => window.__AXIOM__.editor.getState().undo())
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: /Editar script/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'screenshots/04-script.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Play the platformer.
  await page.evaluate(() => {
    const el = document.querySelector('.inspector-scroll')
    if (el) el.scrollTop = 0
  })
  await page.locator('.run-button').click()
  await page.waitForTimeout(1800)
  const runtimeState = await page.evaluate(() => {
    const runtime = window.__AXIOM_GAME__
    return {
      state: runtime?.state,
      nodes: runtime?.nodes.length,
      camera: runtime?.getCamera(),
      player: runtime?.nodes.find((node) => node.name === 'Jugador')?.y
    }
  })
  console.log('RUNTIME:', runtimeState)
  await page.screenshot({ path: 'screenshots/05-game.png' })

  // Collect a coin by teleporting the player onto it.
  const coinResult = await page.evaluate(async () => {
    const runtime = window.__AXIOM_GAME__
    const player = runtime.nodes.find((node) => node.name === 'Jugador')
    const coin = runtime.nodes.find((node) => node.name === 'Chispa 1')
    if (!player || !coin) return { error: 'no player/coin' }
    player.x = coin.x
    player.y = coin.y
    player.velocity.y = 0
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 350))
    return { score: runtime.vars.score, coinAlive: !coin.deleted }
  })
  console.log('COIN:', coinResult)

  // Touch a hazard and then the goal to verify win/lose flow.
  const hazardResult = await page.evaluate(async () => {
    const runtime = window.__AXIOM_GAME__
    const player = runtime.nodes.find((node) => node.name === 'Jugador')
    const spike = runtime.nodes.find((node) => node.name === 'Pinchos')
    player.x = spike.x
    player.y = spike.y
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 350))
    return { lives: runtime.vars.lives, state: runtime.state }
  })
  console.log('HAZARD:', hazardResult)

  await page.evaluate(() => {
    const runtime = window.__AXIOM_GAME__
    const player = runtime.nodes.find((node) => node.name === 'Jugador')
    const goal = runtime.nodes.find((node) => node.name === 'Meta')
    player.x = goal.x
    player.y = goal.y
    player.velocity.y = 0
  })
  await page.waitForTimeout(450)
  const winState = await page.evaluate(() => window.__AXIOM_GAME__.state)
  console.log('WIN:', winState)
  await page.screenshot({ path: 'screenshots/06-win.png' })
  await page.keyboard.press('r')
  await page.waitForTimeout(500)
  console.log('RESTART:', await page.evaluate(() => window.__AXIOM_GAME__.state))
  await page.locator('.stop-btn').click()
  await page.waitForTimeout(400)

  // Shooter template.
  await page.evaluate(() => window.__AXIOM__.editor.getState().newProject('shooter'))
  await page.waitForTimeout(500)
  await page.locator('.run-button').click()
  await page.waitForTimeout(2400)
  const shooter = await page.evaluate(() => {
    const runtime = window.__AXIOM_GAME__
    return {
      state: runtime?.state,
      enemies: runtime?.nodes.filter((node) => node.name === 'Enemigo' && !node.deleted).length,
      bullets: runtime?.nodes.filter((node) => node.name === 'Bala' && !node.deleted).length,
      score: runtime?.vars.score
    }
  })
  console.log('SHOOTER:', shooter)
  await page.screenshot({ path: 'screenshots/07-shooter.png' })
  await page.locator('.stop-btn').click()
  await page.waitForTimeout(400)

  // Connect the mock provider and test the complete Copilot loop.
  await page.evaluate(() => window.__AXIOM__.editor.getState().newProject('platformer'))
  await page.waitForTimeout(400)
  await page.evaluate(async () => {
    await window.axiom.settings.save({
      provider: 'deepseek',
      baseUrl: 'http://127.0.0.1:9999/v1',
      model: 'deepseek-chat',
      temperature: 0.5,
      apiKey: 'sk-mock-test'
    })
    await window.__AXIOM__.settings.getState().load()
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__AXIOM__.ai.getState().clearConversation())
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'screenshots/09-copilot-welcome.png' })
  const composer = page.locator('.composer-box textarea')
  await composer.fill('Mejora el nivel con una moneda nueva y una reliquia.')
  await composer.press('Enter')
  await page.waitForFunction(
    () => {
      const state = window.__AXIOM__.ai.getState()
      return !state.isStreaming && state.messages.some((message) => message.role === 'assistant' && message.actions)
    },
    { timeout: 25000 }
  )
  await page.waitForTimeout(800)
  const aiResult = await page.evaluate(() => {
    const ai = window.__AXIOM__.ai.getState()
    const editor = window.__AXIOM__.editor.getState()
    const message = [...ai.messages].reverse().find((item) => item.role === 'assistant')
    return {
      applied: message?.applied,
      descriptions: message?.actionDescriptions,
      errors: message?.actionErrors,
      hasCoin: Boolean(editor.project.scenes[0].root.children.find((node) => node.name === 'Moneda IA')),
      hasRelicAsset: editor.project.assets.some((asset) => asset.id === 'reliquia_ia'),
      title: (() => {
        const visit = (node) => {
          if (node.name === 'Titulo') return node.props.text
          for (const child of node.children) {
            const found = visit(child)
            if (found) return found
          }
          return null
        }
        return visit(editor.project.scenes[0].root)
      })()
    }
  })
  console.log('AI RESULT:', aiResult)
  await page.screenshot({ path: 'screenshots/08-copilot.png' })

  // Undo the AI batch and verify it is reverted.
  const undoTarget = page.locator('.action-card').getByRole('button', { name: /Deshacer/ }).last()
  if (await undoTarget.count()) {
    await undoTarget.click()
    await page.waitForTimeout(500)
    const afterUndo = await page.evaluate(() => {
      const editor = window.__AXIOM__.editor.getState()
      return Boolean(editor.project.scenes[0].root.children.find((node) => node.name === 'Moneda IA'))
    })
    console.log('UNDO REMOVED COIN:', afterUndo === false)
  }

  // Verify project serialization and the save IPC path.
  const exportPath = resolve('screenshots/e2e-project.axiom')
  const projectContent = await page.evaluate(() => JSON.stringify(window.__AXIOM__.editor.getState().project))
  const saved = await page.evaluate(
    async ({ content, path }) => window.axiom.project.save({ content, path, suggestedName: 'e2e' }),
    { content: projectContent, path: exportPath }
  )
  console.log('SAVE RESULT:', saved, 'FILE EXISTS:', existsSync(exportPath))

  // Anthropic native adapter (different endpoint, auth and SSE events).
  await page.evaluate(async () => {
    await window.axiom.settings.save({
      provider: 'anthropic',
      baseUrl: 'http://127.0.0.1:9999/anthropic/v1',
      model: 'mock-claude',
      temperature: 0.4,
      apiKey: 'sk-ant-mock'
    })
    await window.__AXIOM__.settings.getState().load()
    window.__AXIOM__.ai.getState().clearConversation()
  })
  await page.waitForTimeout(500)
  const anthropicComposer = page.locator('.composer-box textarea')
  await anthropicComposer.fill('Preséntate como Claude de prueba.')
  await anthropicComposer.press('Enter')
  await page.waitForFunction(
    () => {
      const state = window.__AXIOM__.ai.getState()
      const last = [...state.messages].reverse().find((message) => message.role === 'assistant')
      return !state.isStreaming && Boolean(last?.content?.includes('Claude simulado'))
    },
    { timeout: 25000 }
  )
  const anthropicResult = await page.evaluate(() => {
    const state = window.__AXIOM__.ai.getState()
    const last = [...state.messages].reverse().find((message) => message.role === 'assistant')
    return { content: last?.content, provider: window.__AXIOM__.settings.getState().settings?.provider }
  })
  console.log('ANTHROPIC:', anthropicResult)
  await page.screenshot({ path: 'screenshots/10-anthropic.png' })
  await page.locator('.title-actions .icon-btn[title="Ajustes de IA"]').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'screenshots/11-providers.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Local providers must work without an API key.
  const localCheck = await page.evaluate(async () => {
    await window.axiom.settings.save({
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:9999/v1',
      model: 'mock-deepseek',
      temperature: 0.4,
      apiKey: null
    })
    await window.__AXIOM__.settings.getState().load()
    const settings = window.__AXIOM__.settings.getState().settings
    const result = await window.axiom.settings.test()
    return { ok: result.ok, message: result.message, requiresApiKey: settings?.requiresApiKey }
  })
  console.log('LOCAL NO KEY:', localCheck)

  // Generate ready-to-open example projects.
  mkdirSync(resolve('examples'), { recursive: true })
  for (const [template, filename] of [
    ['platformer', 'bosque-de-chispas.axiom'],
    ['shooter', 'cazador-estelar.axiom'],
    ['empty', 'proyecto-vacio.axiom']
  ]) {
    await page.evaluate((id) => window.__AXIOM__.editor.getState().newProject(id), template)
    await page.waitForTimeout(250)
    const content = await page.evaluate(() => JSON.stringify(window.__AXIOM__.editor.getState().project, null, 2))
    writeFileSync(resolve('examples', filename), content, 'utf8')
  }
  console.log('EXAMPLES:', ['bosque-de-chispas.axiom', 'cazador-estelar.axiom', 'proyecto-vacio.axiom'].map((name) => `${name}=${existsSync(resolve('examples', name))}`).join(', '))

  console.log('ERRORS:', errors.length ? errors : 'none')
  writeFileSync('screenshots/e2e-console.log', errors.join('\n'), 'utf8')
  if (errors.length) process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  child.kill()
  await new Promise((resolvePromise) => server.close(resolvePromise))
}
