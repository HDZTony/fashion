// 基础配置文件生成脚本
// 此脚本用于生成 src/manifest.json 和 src/pages.json 基础文件
// 由于这两个配置文件会被添加到 .gitignore 中，因此需要通过此脚本确保项目能正常运行
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 获取当前文件的目录路径（替代 CommonJS 中的 __dirname）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 最简可运行配置（需包含 globalStyle.pages 等，否则 uni-cli validatePages 报错）
const manifest = { }
const pages = {
  globalStyle: {
    navigationStyle: 'default',
    navigationBarTitleText: 'Fashion Rec',
    navigationBarBackgroundColor: '#f8f8f8',
    navigationBarTextStyle: 'black',
    backgroundColor: '#fdf2f8',
  },
  pages: [
    { path: 'pages/index/index', type: 'home', style: { navigationBarTitleText: '首页' } },
    { path: 'pages/blog-list/blog-list', type: 'page', style: { navigationBarTitleText: '博客' } },
    { path: 'pages/login/login', type: 'page', style: { navigationBarTitleText: '登录' } },
    { path: 'pages/me/me', type: 'page', style: { navigationBarTitleText: '我的' } },
    { path: 'pages/studio/studio', type: 'page', style: { navigationBarTitleText: '工作室' } },
    { path: 'pages/wardrobe/wardrobe', type: 'page', style: { navigationBarTitleText: '衣橱' } },
    { path: 'pages/profile/profile', type: 'page', style: { navigationBarTitleText: '个人' } },
    { path: 'pages/favorites/favorites', type: 'page', style: { navigationBarTitleText: '收藏' } },
    { path: 'pages/callback/callback', type: 'page', style: { navigationBarTitleText: '' } },
    { path: 'pages/blog-create/blog-create', type: 'page', style: { navigationBarTitleText: '创建' } },
    { path: 'pages/blog-detail/blog-detail', type: 'page', style: { navigationBarTitleText: '详情' } },
    { path: 'pages/my-blog/my-blog', type: 'page', style: { navigationBarTitleText: '我的博客' } },
    { path: 'pages/multi-angle/multi-angle', type: 'page', style: { navigationBarTitleText: '多角度' } },
    { path: 'pages/multiangle-history/multiangle-history', type: 'page', style: { navigationBarTitleText: '历史' } },
    { path: 'pages/tryon-history/tryon-history', type: 'page', style: { navigationBarTitleText: '试穿历史' } },
  ],
  subPackages: [],
  tabBar: {
    color: '#999999',
    selectedColor: '#018d71',
    backgroundColor: '#F8F8F8',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/blog-list/blog-list', text: '博客' },
    ],
  },
}

// 使用修复后的 __dirname 来解析文件路径
const manifestPath = path.resolve(__dirname, '../src/manifest.json')
const pagesPath = path.resolve(__dirname, '../src/pages.json')

// 确保 src 目录存在
const srcDir = path.resolve(__dirname, '../src')
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true })
}

const MIN_SIZE = 10 // 过小则视为无效

function needRegeneratePagesJson() {
  if (!fs.existsSync(pagesPath)) return true
  const size = fs.statSync(pagesPath).size
  if (size <= MIN_SIZE) return true
  try {
    const content = JSON.parse(fs.readFileSync(pagesPath, 'utf-8'))
    if (!content || !Array.isArray(content.pages) || content.pages.length === 0) return true
    // 缺少 globalStyle 时 uni-cli validatePages 可能报错，需重新生成
    if (!content.globalStyle) return true
    return false
  } catch {
    return true
  }
}

// 如果 src/manifest.json 不存在，就创建它
if (!fs.existsSync(manifestPath) || fs.statSync(manifestPath).size <= MIN_SIZE) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}

// 如果 src/pages.json 不存在或无效（无 pages 数组），则重新生成
if (needRegeneratePagesJson()) {
  fs.writeFileSync(pagesPath, JSON.stringify(pages, null, 2))
  console.log('[init-baseFiles] Regenerated pages.json')
}
