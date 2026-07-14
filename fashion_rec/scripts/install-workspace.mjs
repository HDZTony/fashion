/** exFAT 不支持 symlink；pnpm 11 可能在链接 workspace 包时失败，安装后需复制 shared */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

try {
  execSync('pnpm install', { stdio: 'inherit', cwd: root })
}
catch {
  console.warn('\n⚠️  pnpm install 在 workspace 链接阶段失败（exFAT 常见），继续复制 shared...\n')
}

execSync('node scripts/copy-shared.mjs', { stdio: 'inherit', cwd: root })
