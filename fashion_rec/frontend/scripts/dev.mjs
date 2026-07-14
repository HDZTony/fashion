/**
 * Vite dev launcher: ensures the process tree exits when the console window closes.
 * On Windows, closing the terminal often orphans node/vite; stdin close + SIGBREAK + taskkill /T fix that.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import readline from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')
const viteArgs = [...process.argv.slice(2)]
if (!viteArgs.some(arg => arg === '--port' || arg.startsWith('--port=')))
  viteArgs.push('--port', '5173')
if (!viteArgs.includes('--strictPort'))
  viteArgs.push('--strictPort')

let child
let shuttingDown = false

function shutdown() {
  if (shuttingDown)
    return
  shuttingDown = true

  if (!child?.pid) {
    process.exit(0)
    return
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      .on('error', () => child.kill('SIGTERM'))
      .on('exit', () => process.exit(0))
    return
  }

  child.kill('SIGTERM')
  setTimeout(() => process.exit(0), 1000).unref()
}

child = spawn(process.execPath, [viteBin, ...viteArgs], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  windowsHide: false,
})

child.on('exit', (code, signal) => {
  if (!shuttingDown)
    process.exit(code ?? (signal ? 1 : 0))
})

for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK'])
  process.on(sig, shutdown)

// pnpm often pipes stdin (isTTY=false); closing the console closes that pipe.
process.stdin.resume()
process.stdin.on('close', shutdown)

if (process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.on('close', shutdown)
}
