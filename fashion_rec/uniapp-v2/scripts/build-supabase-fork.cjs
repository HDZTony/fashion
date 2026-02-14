/**
 * postinstall 脚本：为从 GitHub 安装的 @supabase/* fork 包构建 dist/
 *
 * 背景：fork 仓库的 .gitignore 排除了 dist/，从 GitHub 安装时只有源码。
 * 此脚本用 esbuild 从 src/index.ts 编译出 dist/ 下的 ESM 和 CJS 产物，
 * 使 Vite/Rollup 能正常解析包入口。
 *
 * 若包已有 dist/（例如从 npm 安装的正式版），则跳过。
 */
const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')

// 构建顺序：子包优先，supabase-js 最后（它依赖其他子包）
const PACKAGES = [
  '@supabase/auth-js',
  '@supabase/functions-js',
  '@supabase/postgrest-js',
  '@supabase/realtime-js',
  '@supabase/storage-js',
  '@supabase/supabase-js',
]

/**
 * 用 esbuild 为单个包构建 dist/
 * - 读取 package.json 的 main/module 字段确定输出路径
 * - 标记所有 dependencies 为 external（不打包进来）
 * - 分别输出 ESM 和 CJS 两种格式
 */
async function buildPackage(pkgName) {
  let pkgJsonPath
  try {
    pkgJsonPath = require.resolve(`${pkgName}/package.json`)
  } catch {
    console.log(`  [skip] ${pkgName}: not installed`)
    return
  }

  const pkgDir = path.dirname(pkgJsonPath)
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))

  // 已有 dist/ 则跳过（正式 npm 版本或已构建过）
  if (fs.existsSync(path.join(pkgDir, 'dist'))) {
    console.log(`  [skip] ${pkgName}: dist/ already exists`)
    return
  }

  const srcEntry = path.join(pkgDir, 'src', 'index.ts')
  if (!fs.existsSync(srcEntry)) {
    console.log(`  [skip] ${pkgName}: src/index.ts not found`)
    return
  }

  // 所有 dependencies 标记为 external，不打入 bundle
  const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]

  // 从 package.json 确定输出路径
  const esmOutput = pkg.module
    ? path.join(pkgDir, pkg.module)
    : null
  const cjsOutput = pkg.main
    ? path.join(pkgDir, pkg.main)
    : null

  const commonOptions = {
    entryPoints: [srcEntry],
    bundle: true,
    external,
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    logLevel: 'warning',
  }

  // 构建 ESM
  if (esmOutput) {
    fs.mkdirSync(path.dirname(esmOutput), { recursive: true })
    await esbuild.build({
      ...commonOptions,
      outfile: esmOutput,
      format: 'esm',
    })
  }

  // 构建 CJS
  if (cjsOutput) {
    fs.mkdirSync(path.dirname(cjsOutput), { recursive: true })
    await esbuild.build({
      ...commonOptions,
      outfile: cjsOutput,
      format: 'cjs',
    })
  }

  console.log(`  [done] ${pkgName}`)
}

async function main() {
  console.log('[build-supabase-fork] Building @supabase/* fork packages from source...')

  for (const pkg of PACKAGES) {
    await buildPackage(pkg)
  }

  console.log('[build-supabase-fork] Complete.')
}

main().catch((err) => {
  console.error('[build-supabase-fork] Failed:', err)
  process.exit(1)
})
