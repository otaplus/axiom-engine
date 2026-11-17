import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const CDP_PORT = 9336
const UPDATE_PORT = 9998
const root = resolve('.')
const electronPath = resolve('node_modules/electron/dist/electron.exe')
const userData = resolve('.test-update-user-data')
const payload = Buffer.alloc(256 * 1024, 0x41)
const payloadHash = createHash('sha256').update(payload).digest('hex')

mkdirSync(resolve('screenshots'), { recursive: true })
rmSync(userData, { recursive: true, force: true })

const server = createServer((request, response) => {
  if (request.url?.startsWith('/latest')) {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify({
        tag_name: 'v9.9.9',
        name: 'Axiom Engine 9.9.9 de prueba',
        body: '## Actualización de prueba\n\n- Nuevo actualizador automático\n- Mejoras de prueba',
        html_url: 'https://github.com/otaplus/axiom-engine/releases/tag/v9.9.9',
        prerelease: false,
        assets: [
          {
            name: 'Axiom-Engine-9.9.9-Setup.exe',
            browser_download_url: `http://127.0.0.1:${UPDATE_PORT}/Axiom-Engine-9.9.9-Setup.exe`,
            size: payload.length
          },
          {
            name: 'Axiom-Engine-9.9.9-Setup.exe.sha256',
            browser_download_url: `http://127.0.0.1:${UPDATE_PORT}/Axiom-Engine-9.9.9-Setup.exe.sha256`,
            size: 96
          }
        ]
      })
    )
    return
  }
  if (request.url?.startsWith('/Axiom-Engine-9.9.9-Setup.exe.sha256')) {
    response.writeHead(200, { 'Content-Type': 'text/plain' })
    response.end(`${payloadHash}  Axiom-Engine-9.9.9-Setup.exe\n`)
    return
  }
  if (request.url?.startsWith('/Axiom-Engine-9.9.9-Setup.exe')) {
    response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': payload.length })
    response.end(payload)
    return
  }
  response.writeHead(404)
  response.end('not found')
})

await new Promise((resolvePromise) => server.listen(UPDATE_PORT, '127.0.0.1', resolvePromise))

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_ENABLE_LOGGING
env.AXIOM_USER_DATA = userData
env.AXIOM_NO_SANDBOX = '1'
env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
env.AXIOM_UPDATE_API = `http://127.0.0.1:${UPDATE_PORT}/latest`
env.AXIOM_DISABLE_AUTO_UPDATE = '1'

const child = spawn(electronPath, ['.', '--no-sandbox', `--remote-debugging-port=${CDP_PORT}`], {
  cwd: root,
  env,
  stdio: 'ignore',
  detached: false
})

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
let browser
try {
  let ready = false
  for (let index = 0; index < 60; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      if (response.ok) {
        ready = true
        break
      }
    } catch {
      // keep waiting
    }
    await sleep(300)
  }
  if (!ready) throw new Error('CDP no arrancó')
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`)
  const page = browser.contexts().flatMap((context) => context.pages())[0]
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.reload()
  await page.waitForTimeout(1800)

  const available = await page.evaluate(async () => {
    const state = await window.axiom.update.check()
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
    return { state, store: window.__AXIOM__.update.getState().status }
  })
  console.log('AVAILABLE:', available)
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'screenshots/update-banner.png' })

  const downloaded = await page.evaluate(async () => {
    const state = await window.axiom.update.download()
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400))
    return { state, store: window.__AXIOM__.update.getState().status }
  })
  console.log('DOWNLOADED:', downloaded)
  await page.evaluate(() => window.__AXIOM__.editor.getState().setModal('updates'))
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'screenshots/update-modal.png' })

  console.log('ERRORS:', errors.length ? errors : 'none')
  if (errors.length) process.exitCode = 1
  if (available.state?.status !== 'available') process.exitCode = 1
  if (downloaded.state?.status !== 'ready') process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  child.kill()
  await new Promise((resolvePromise) => server.close(resolvePromise))
}
