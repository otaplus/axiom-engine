import { app, BrowserWindow, shell } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import type { UpdateState } from '../shared/update'

const OWNER = 'otaplus'
const REPO = 'axiom-engine'
const DEFAULT_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
const AUTO_CHECK_DELAY = 7000

interface GithubAsset {
  name: string
  browser_download_url: string
  size: number
}

interface GithubRelease {
  tag_name: string
  name: string
  body: string
  html_url: string
  prerelease: boolean
  assets: GithubAsset[]
}

let release: GithubRelease | null = null
let selectedAsset: GithubAsset | null = null
let checksumAsset: GithubAsset | null = null
let downloadedPath: string | null = null
let autoCheckTimer: NodeJS.Timeout | null = null

let state: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  platform: process.platform
}

function setState(patch: Partial<UpdateState>): UpdateState {
  state = { ...state, ...patch, currentVersion: app.getVersion(), platform: process.platform }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update:status', state)
  }
  return state
}

export function getUpdateState(): UpdateState {
  return state
}

function updateEndpoint(): string {
  return process.env.AXIOM_UPDATE_API?.trim() || DEFAULT_API
}

function updateHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Axiom-Engine-Updater',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  }
}

function normalizeVersion(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part.replace(/\D/g, ''), 10) || 0)
}

export function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a)
  const right = normalizeVersion(b)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function selectAssets(releaseInfo: GithubRelease): { asset: GithubAsset | null; checksum: GithubAsset | null } {
  const assets = Array.isArray(releaseInfo.assets) ? releaseInfo.assets : []
  let asset: GithubAsset | undefined
  if (process.platform === 'win32') {
    asset =
      assets.find((candidate) => /Setup\.exe$/i.test(candidate.name) && candidate.name.includes(releaseInfo.tag_name.replace(/^v/, ''))) ??
      assets.find((candidate) => /Setup\.exe$/i.test(candidate.name))
  } else if (process.platform === 'linux') {
    asset =
      assets.find((candidate) => /\.AppImage$/i.test(candidate.name)) ??
      assets.find((candidate) => /\.tar\.gz$/i.test(candidate.name))
  } else {
    asset = assets.find((candidate) => /\.dmg$/i.test(candidate.name))
  }
  const checksum = asset ? assets.find((candidate) => candidate.name === `${asset!.name}.sha256`) ?? null : null
  return { asset: asset ?? null, checksum }
}

export async function checkForUpdates(manual = true): Promise<UpdateState> {
  if (!app.isPackaged && !process.env.AXIOM_UPDATE_API) {
    return setState({
      status: 'unsupported',
      message: 'Las actualizaciones automáticas están disponibles en la aplicación instalada.'
    })
  }
  if (state.status === 'downloading') return state
  setState({ status: 'checking', message: 'Buscando actualizaciones…', progress: 0 })

  try {
    const response = await fetch(updateEndpoint(), {
      headers: updateHeaders(),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) {
      const suffix = response.status === 404 ? 'Todavía no hay una release estable publicada.' : `GitHub respondió ${response.status}.`
      return setState({ status: 'error', message: `No se pudo comprobar la actualización. ${suffix}` })
    }
    const info = (await response.json()) as GithubRelease
    release = info
    const latestVersion = String(info.tag_name ?? '').replace(/^v/i, '')
    if (!latestVersion) {
      return setState({ status: 'error', message: 'La release de GitHub no tiene una versión válida.' })
    }

    if (compareVersions(latestVersion, app.getVersion()) <= 0) {
      return setState({
        status: 'up-to-date',
        latestVersion,
        releaseUrl: info.html_url,
        releaseNotes: info.body ?? '',
        message: `Ya tienes la última versión (${app.getVersion()}).`
      })
    }

    const selected = selectAssets(info)
    selectedAsset = selected.asset
    checksumAsset = selected.checksum
    downloadedPath = null
    return setState({
      status: 'available',
      latestVersion,
      releaseUrl: info.html_url,
      releaseNotes: info.body ?? '',
      assetName: selected.asset?.name,
      canInstall: process.platform === 'win32' && Boolean(selected.asset),
      message: selected.asset
        ? `La versión ${latestVersion} está disponible.`
        : `La versión ${latestVersion} está disponible, pero no hay un instalador para esta plataforma. Abre la release para descargarla.`
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'TimeoutError'
          ? 'GitHub tardó demasiado en responder.'
          : error.message
        : String(error)
    return setState({ status: 'error', message: `No se pudo comprobar la actualización: ${message}` })
  }
}

function safeFileName(name: string): string {
  return basename(name).replace(/[^a-zA-Z0-9._-]/g, '-')
}

async function writeChunk(stream: ReturnType<typeof createWriteStream>, chunk: Uint8Array): Promise<void> {
  if (stream.write(Buffer.from(chunk))) return
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      stream.off('error', onError)
      resolve()
    }
    const onError = (error: Error) => {
      stream.off('drain', onDrain)
      reject(error)
    }
    stream.once('drain', onDrain)
    stream.once('error', onError)
  })
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (state.status === 'downloading') return state
  if (!selectedAsset) {
    return setState({ status: 'error', message: 'No hay un archivo de actualización disponible para esta plataforma.' })
  }
  if (!/^https?:\/\//i.test(selectedAsset.browser_download_url)) {
    return setState({ status: 'error', message: 'La URL del instalador no es válida.' })
  }
  if (!process.env.AXIOM_UPDATE_API && !selectedAsset.browser_download_url.startsWith('https://github.com/')) {
    return setState({ status: 'error', message: 'La URL del instalador no pertenece al repositorio oficial.' })
  }

  const directory = join(app.getPath('userData'), 'updates')
  await fs.mkdir(directory, { recursive: true })
  const target = join(directory, safeFileName(selectedAsset.name))
  downloadedPath = null
  setState({ status: 'downloading', progress: 0, message: `Descargando ${state.latestVersion ?? 'la actualización'}…` })

  try {
    const response = await fetch(selectedAsset.browser_download_url, {
      headers: { 'User-Agent': 'Axiom-Engine-Updater' },
      signal: AbortSignal.timeout(10 * 60 * 1000)
    })
    if (!response.ok || !response.body) {
      throw new Error(`La descarga falló con HTTP ${response.status}.`)
    }
    const total = Number(response.headers.get('content-length') ?? selectedAsset.size ?? 0)
    const stream = createWriteStream(target)
    const reader = response.body.getReader()
    let received = 0
    let lastBroadcast = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        await writeChunk(stream, value)
        received += value.byteLength
        const now = Date.now()
        if (now - lastBroadcast > 180) {
          lastBroadcast = now
          setState({
            status: 'downloading',
            progress: total > 0 ? Math.min(99, Math.round((received / total) * 100)) : undefined
          })
        }
      }
    }
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve())
      stream.once('error', reject)
    })

    if (checksumAsset) {
      const checksumResponse = await fetch(checksumAsset.browser_download_url, {
        headers: { 'User-Agent': 'Axiom-Engine-Updater' },
        signal: AbortSignal.timeout(20000)
      })
      if (checksumResponse.ok) {
        const expected = (await checksumResponse.text()).trim().split(/\s+/)[0]?.toLowerCase()
        if (expected && /^[a-f0-9]{64}$/.test(expected)) {
          const hash = createHash('sha256')
          hash.update(await fs.readFile(target))
          const actual = hash.digest('hex')
          if (actual !== expected) {
            await fs.rm(target, { force: true })
            return setState({ status: 'error', message: 'El checksum del instalador no coincide. Descarga cancelada por seguridad.' })
          }
        }
      }
    }

    downloadedPath = target
    return setState({
      status: 'ready',
      progress: 100,
      canInstall: process.platform === 'win32',
      message:
        process.platform === 'win32'
          ? 'Actualización descargada y verificada. Lista para instalar.'
          : 'Descarga completada. En Linux puedes abrir la carpeta y usar el nuevo paquete.'
    })
  } catch (error) {
    return setState({
      status: 'error',
      message: `No se pudo descargar la actualización: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}

export function installUpdate(): UpdateState {
  if (state.status !== 'ready' || !downloadedPath || !existsSync(downloadedPath)) {
    return setState({ status: 'error', message: 'La actualización todavía no está lista para instalarse.' })
  }
  if (process.platform !== 'win32') {
    shell.showItemInFolder(downloadedPath)
    return setState({
      ...state,
      message: 'El paquete está en la carpeta de actualizaciones. En Linux las actualizaciones se instalan manualmente.'
    })
  }

  try {
    const installer = downloadedPath
    const child = spawn(
      installer,
      ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CLOSEAPPLICATIONS', '/SP-'],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()
    setState({ status: 'ready', message: 'Cerrando Axiom para instalar la actualización…' })
    setTimeout(() => app.quit(), 450)
    return state
  } catch (error) {
    return setState({
      status: 'error',
      message: `No se pudo iniciar el instalador: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}

export async function openReleasePage(): Promise<void> {
  const url = state.releaseUrl || `https://github.com/${OWNER}/${REPO}/releases/latest`
  if (/^https:\/\//i.test(url)) await shell.openExternal(url)
}

export function startAutoUpdater(): void {
  if (autoCheckTimer) clearTimeout(autoCheckTimer)
  if (process.env.AXIOM_DISABLE_AUTO_UPDATE === '1') return
  if (!app.isPackaged && !process.env.AXIOM_UPDATE_API) return
  autoCheckTimer = setTimeout(() => {
    void checkForUpdates(false)
  }, AUTO_CHECK_DELAY)
}
