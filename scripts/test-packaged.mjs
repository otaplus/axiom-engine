import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = 9335
const userData = resolve('.test-user-data-packaged')
rmSync(userData, { recursive: true, force: true })
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
env.AXIOM_USER_DATA = userData
env.AXIOM_NO_SANDBOX = '1'
env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

const exe = resolve('release/win-unpacked/Axiom Engine.exe')
const child = spawn(exe, ['--no-sandbox', `--remote-debugging-port=${PORT}`], { env, stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let browser
try {
  let ready = false
  for (let i = 0; i < 50; i += 1) {
    try {
      const result = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (result.ok) {
        ready = true
        break
      }
    } catch {
      // wait
    }
    await sleep(300)
  }
  if (!ready) throw new Error('El ejecutable empaquetado no arrancó')
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
  const page = browser.contexts().flatMap((context) => context.pages())[0]
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.waitForTimeout(2200)
  console.log('TITLE:', await page.title())
  console.log('BRIDGE:', await page.evaluate(() => Boolean(window.axiom && window.__AXIOM__)))
  console.log('PROJECT:', await page.evaluate(() => window.__AXIOM__.editor.getState().project.name))
  await page.screenshot({ path: 'screenshots/packaged.png' })
  await page.locator('.run-button').click()
  await page.waitForTimeout(1500)
  console.log('PLAYING:', await page.locator('.game-canvas').count(), await page.evaluate(() => window.__AXIOM_GAME__?.state))
  await page.screenshot({ path: 'screenshots/packaged-game.png' })
  console.log('ERRORS:', errors.length ? errors : 'none')
  if (errors.length) process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  child.kill()
}
