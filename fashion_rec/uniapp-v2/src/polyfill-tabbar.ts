/**
 * uni-app H5 在 pages.json 无 tabBar 时会崩溃（useShowTabBar 访问 tabBar.height）。
 * 运行时注入最小 tabBar 配置，避免报错。
 */
export {}
const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : ({} as object))
const cfg = (g as { __uniConfig?: { tabBar?: unknown } }).__uniConfig
if (cfg && !cfg.tabBar) {
  (cfg as { tabBar: object }).tabBar = {
    list: [
      { pagePath: 'pages/index/index', text: 'Home' },
      { pagePath: 'pages/blog-list/blog-list', text: 'Blog' },
    ],
    height: 50,
    shown: true,
  }
}
