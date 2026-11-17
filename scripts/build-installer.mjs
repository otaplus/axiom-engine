import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve('.')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const sourceDir = join(root, 'release', 'win-unpacked')
const outputDir = join(root, 'release')

if (!existsSync(join(sourceDir, 'Axiom Engine.exe'))) {
  console.error('Falta release/win-unpacked. Ejecuta primero: npm run package:win')
  process.exit(1)
}

const candidates = [
  process.env.ISCC_PATH,
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe'),
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Inno Setup 6', 'ISCC.exe'),
  join(homedir(), 'AppData', 'Local', 'Programs', 'Inno Setup 6', 'ISCC.exe')
].filter(Boolean)

const iscc = candidates.find((candidate) => existsSync(candidate))
if (!iscc) {
  console.error('No se encontró ISCC.exe de Inno Setup 6.')
  console.error('Instala Inno Setup 6 o define la variable ISCC_PATH.')
  process.exit(1)
}

console.log(`Compilando instalador con ${iscc}`)
execFileSync(
  iscc,
  [
    `/DMyAppVersion=${version}`,
    `/DMyProjectDir=${root}`,
    `/DMySourceDir=${sourceDir}`,
    `/DMyOutputDir=${outputDir}`,
    join(root, 'build', 'installer.iss')
  ],
  { cwd: root, stdio: 'inherit' }
)

const installerPath = join(outputDir, `Axiom-Engine-${version}-Setup.exe`)
if (!existsSync(installerPath)) {
  console.error('Inno Setup terminó sin generar el instalador esperado.')
  process.exit(1)
}

function sha256(path) {
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

const installerHash = sha256(installerPath)
writeFileSync(`${installerPath}.sha256`, `${installerHash}  ${installerPath.split(/[\\/]/).pop()}\n`, 'utf8')

const zipPath = join(outputDir, `Axiom-Engine-${version}-x64.zip`)
if (existsSync(zipPath)) {
  const zipHash = sha256(zipPath)
  writeFileSync(`${zipPath}.sha256`, `${zipHash}  ${zipPath.split(/[\\/]/).pop()}\n`, 'utf8')
}

console.log(`Instalador: ${installerPath}`)
console.log(`SHA-256: ${installerHash}`)
