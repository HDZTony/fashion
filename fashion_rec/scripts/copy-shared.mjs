/** exFAT 不支持 symlink，pnpm install 后需复制 workspace 包 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shared = join(root, 'shared')
const targets = [
  join(root, 'frontend/node_modules/@fashion-rec/shared'),
  join(root, 'uniapp-v2/node_modules/@fashion-rec/shared'),
]

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true })
  if (existsSync(target))
    rmSync(target, { recursive: true, force: true })
  cpSync(shared, target, { recursive: true })
}

console.log('Copied @fashion-rec/shared to frontend and uniapp-v2')
