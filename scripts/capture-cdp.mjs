import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = 9333
const root = resolve('.')
const electronPath = resolve('node_modules/electron/dist/electron.exe')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_ENABLE_LOGGING
env.AXIOM_USER_DATA = resolve('.test-user-data')
env.AXIOM_NO_SANDBOX = '1'
env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

mkdirSync(resolve('screenshots'), { recursive: true })
const child = spawn(electronPath, ['.', '--no-sandbox', `--remote-debugging-port=${PORT}`], {
  cwd: root,
  env,
  stdio: 'ignore',
  detached: false
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitForCdp() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (response.ok) return true
    } catch {
      // keep polling
    }
    await sleep(300)
  }
  return false
}

let browser
try {
  if (!(await waitForCdp())) throw new Error('CDP endpoint did not start')
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
  const contexts = browser.contexts()
  const pages = contexts.flatMap((context) => context.pages())
  if (!pages.length) throw new Error('No renderer page found')
  const page = pages[0]
  const consoleMessages = []
  page.on('console', (message) => consoleMessages.push(`[${message.type()}] ${message.text()}`))
  page.on('pageerror', (error) => consoleMessages.push(`[pageerror] ${error.message}`))
  await page.reload()
  await page.waitForTimeout(2200)
  await page.screenshot({ path: 'screenshots/editor.png' })

  const playerRow = page.locator('.tree-row', { hasText: 'Jugador' }).first()
  if (await playerRow.count()) {
    await playerRow.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'screenshots/editor-player.png' })
  }

  await page.locator('.run-button').click()
  await page.waitForTimeout(1800)
  console.log('GAME CANVAS:', await page.evaluate(() => {
    const canvas = document.querySelector('.game-canvas')
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const wrap = document.querySelector('.game-canvas-wrap')?.getBoundingClientRect()
    const stage = document.querySelector('.game-stage')?.getBoundingClientRect()
    const context = canvas.getContext('2d')
    const samples = {}
    for (const [name, x, y] of [['topLeft', 10, 10], ['topRight', 940, 10], ['centerLeft', 200, 270], ['centerRight', 800, 270], ['bottomRight', 940, 520]]) {
      try {
        samples[name] = Array.from(context.getImageData(x, y, 1, 1).data)
      } catch (error) {
        samples[name] = String(error)
      }
    }
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      wrap: wrap ? { x: wrap.x, y: wrap.y, width: wrap.width, height: wrap.height } : null,
      stage: stage ? { x: stage.x, y: stage.y, width: stage.width, height: stage.height } : null,
      width: canvas.width,
      height: canvas.height,
      samples
    }
  }))
  console.log('RUNTIME:', await page.evaluate(() => {
    const runtime = window.__AXIOM_GAME__
    if (!runtime) return null
    const player = runtime.nodes.find((n) => n.name === 'Jugador')
    return {
      camera: runtime.getCamera(),
      player: player ? { x: player.x, y: player.y, vx: player.velocity.x, vy: player.velocity.y, onFloor: player.onFloor } : null,
      state: runtime.state,
      vars: runtime.vars
    }
  }))
  await page.screenshot({ path: 'screenshots/game.png' })
  const gameCanvas = page.locator('.game-canvas')
  if (await gameCanvas.count()) {
    await gameCanvas.screenshot({ path: 'screenshots/game-canvas-only.png' })
    await gameCanvas.click({ position: { x: 300, y: 240 } })
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(650)
    await page.keyboard.press('Space')
    await page.waitForTimeout(400)
    await page.keyboard.up('ArrowRight')
    await page.screenshot({ path: 'screenshots/game-action.png' })
    console.log('AFTER INPUT:', await page.evaluate(() => {
      const runtime = window.__AXIOM_GAME__
      const player = runtime?.nodes.find((n) => n.name === 'Jugador')
      return player ? { x: player.x, y: player.y, vx: player.velocity.x, vy: player.velocity.y, onFloor: player.onFloor } : null
    }))
  }
  console.log('CONSOLE:\n' + consoleMessages.slice(-100).join('\n'))
  writeFileSync('screenshots/console.log', consoleMessages.join('\n'), 'utf8')
} finally {
  if (browser) await browser.close().catch(() => {})
  child.kill()
}
