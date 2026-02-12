import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)
import type { Preset } from 'unocss'
import Uni from '@uni-helper/plugin-uni'
import UniComponents from '@uni-helper/vite-plugin-uni-components'
// @see https://uni-helper.js.org/vite-plugin-uni-layouts
import UniLayouts from '@uni-helper/vite-plugin-uni-layouts'
// @see https://github.com/uni-helper/vite-plugin-uni-manifest
import UniManifest from '@uni-helper/vite-plugin-uni-manifest'
// @see https://uni-helper.js.org/vite-plugin-uni-pages
import UniPages from '@uni-helper/vite-plugin-uni-pages'
// @see https://github.com/uni-helper/vite-plugin-uni-platform
// 需要与 @uni-helper/vite-plugin-uni-pages 插件一起使用
import UniPlatform from '@uni-helper/vite-plugin-uni-platform'
/**
 * 分包优化、模块异步跨包调用、组件异步跨包引用
 * @see https://github.com/uni-ku/bundle-optimizer
 */
import UniOptimization from '@uni-ku/bundle-optimizer'
// https://github.com/uni-ku/root
import UniKuRoot from '@uni-ku/root'
import { presetUni } from '@uni-helper/unocss-preset-uni'
import { presetLegacyCompat } from '@unocss/preset-legacy-compat'
import {
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import dayjs from 'dayjs'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig, loadEnv } from 'vite'
import ViteRestart from 'vite-plugin-restart'
import openDevTools from './scripts/open-dev-tools'
import { createCopyNativeResourcesPlugin } from './vite-plugins/copy-native-resources'
import { markedUnicodeShim } from './vite-plugins/marked-unicode-shim'
import syncManifestPlugin from './vite-plugins/sync-manifest-plugins'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // @see https://unocss.dev/
  // const UnoCSS = (await import('unocss/vite')).default
  // console.log(mode === process.env.NODE_ENV) // true

  // mode: 区分生产环境还是开发环境
  console.log('command, mode -> ', command, mode)
  // pnpm dev:h5 时得到 => serve development
  // pnpm build:h5 时得到 => build production
  // pnpm dev:mp-weixin 时得到 => build development (注意区别，command为build)
  // pnpm build:mp-weixin 时得到 => build production
  // pnpm dev:app 时得到 => build development (注意区别，command为build)
  // pnpm build:app 时得到 => build production
  // dev 和 build 命令可以分别使用 .env.development 和 .env.production 的环境变量

  const { UNI_PLATFORM } = process.env
  console.log('UNI_PLATFORM -> ', UNI_PLATFORM) // 得到 mp-weixin, h5, app 等

  const env = loadEnv(mode, path.resolve(process.cwd(), 'env'))
  const {
    VITE_APP_PORT,
    VITE_SERVER_BASEURL,
    VITE_APP_TITLE,
    VITE_DELETE_CONSOLE,
    VITE_APP_PUBLIC_BASE,
    VITE_APP_PROXY_ENABLE,
    VITE_APP_PROXY_PREFIX,
    VITE_COPY_NATIVE_RES_ENABLE,
    VITE_SUPABASE_URL,
  } = env
  console.log('环境变量 env -> ', env)

  return defineConfig({
    envDir: './env', // 自定义env目录
    base: VITE_APP_PUBLIC_BASE,
    plugins: [
      // marked Unicode 正则替换：UniApp App (JSC) 不支持 \p{L}\p{N} 等
      markedUnicodeShim(),
      // UniXXX 需要在 Uni 之前引入
      UniLayouts(),
      UniPlatform(),
      UniManifest(),
      UniComponents({
        extensions: ['vue'],
        deep: true, // 是否递归扫描子目录，
        directoryAsNamespace: false, // 是否把目录名作为命名空间前缀，true 时组件名为 目录名+组件名，
        dts: 'src/types/components.d.ts', // 自动生成的组件类型声明文件路径（用于 TypeScript 支持）
      }),
      UniPages({
        exclude: ['**/components/**/**.*', '**/sections/**/**.*'],
        // pages 目录为 src/pages，分包目录不能配置在pages目录下！！
        // 是个数组，可以配置多个，但是不能为pages里面的目录！！
        subPackages: [],
        dts: 'src/types/uni-pages.d.ts',
      }),
      // UniOptimization 插件需要 page.json 文件，故应在 UniPages 插件之后执行
      UniOptimization({
        enable: {
          'optimization': true,
          'async-import': true,
          'async-component': true,
        },
        dts: {
          base: 'src/types',
        },
        logger: false,
      }),
      // 若存在改变 pages.json 的插件，请将 UniKuRoot 放置其后
      UniKuRoot({
        excludePages: ['**/components/**/**.*', '**/sections/**/**.*'],
      }),
      Uni(),
      {
        // 临时解决 dcloudio 官方的 @dcloudio/uni-mp-compiler 出现的编译 BUG
        // 参考 github issue: https://github.com/dcloudio/uni-app/issues/4952
        // 自定义插件禁用 vite:vue 插件的 devToolsEnabled，强制编译 vue 模板时 inline 为 true
        name: 'fix-vite-plugin-vue',
        configResolved(config) {
          const plugin = config.plugins.find(p => p.name === 'vite:vue')
          if (plugin && plugin.api && plugin.api.options) {
            plugin.api.options.devToolsEnabled = false
          }
        },
      },
      // 内联 UnoCSS 配置，避免 Windows 下 unconfig 加载 uno.config.ts 时触发 ERR_UNSUPPORTED_ESM_URL_SCHEME
      UnoCSS({
        presets: [
          presetUni({ attributify: false }),
          presetIcons({
            scale: 1.2,
            warn: true,
            extraProperties: {
              display: 'inline-block',
              'vertical-align': 'middle',
            },
          }),
          presetLegacyCompat({
            commaStyleColorFunction: true,
            legacyColorSpace: true,
          }) as Preset,
        ],
        transformers: [transformerDirectives(), transformerVariantGroup()],
        shortcuts: [{ center: 'flex justify-center items-center' }],
        safelist: [
          'i-carbon-code',
          'i-carbon-home',
          'i-carbon-user',
          'i-carbon-document',
          ' i-carbon-ibm-watson-language-translator',
        ],
        rules: [
          [
            'p-safe',
            {
              padding:
                'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
            },
          ],
          ['pt-safe', { 'padding-top': 'env(safe-area-inset-top)' }],
          ['pb-safe', { 'padding-bottom': 'env(safe-area-inset-bottom)' }],
        ],
        theme: {
          colors: {
            primary: 'var(--wot-color-theme,#0957DE)',
            pink: {
              50: '#fdf2f8',
              100: '#fce7f3',
              200: '#fbcfe8',
              300: '#f9a8d4',
              400: '#f472b6',
              500: '#ec4899',
              600: '#db2777',
              700: '#be185d',
              800: '#9d174d',
              900: '#831843',
            },
            purple: {
              50: '#faf5ff',
              100: '#f3e8ff',
              200: '#e9d5ff',
              400: '#c084fc',
              600: '#9333ea',
              700: '#7e22ce',
            },
          },
          fontSize: {
            '2xs': ['20rpx', '28rpx'],
            '3xs': ['18rpx', '26rpx'],
          },
        },
      }),
      AutoImport({
        imports: ['vue', 'uni-app'],
        dts: 'src/types/auto-import.d.ts',
        dirs: ['src/hooks'], // 自动导入 hooks
        vueTemplate: true, // default false
      }),
      ViteRestart({
        // 通过这个插件，在修改vite.config.js文件则不需要重新运行也生效配置
        restart: ['vite.config.js'],
      }),
      // h5环境增加 BUILD_TIME 和 BUILD_BRANCH
      UNI_PLATFORM === 'h5' && {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace('%BUILD_TIME%', dayjs().format('YYYY-MM-DD HH:mm:ss')).replace('%VITE_APP_TITLE%', VITE_APP_TITLE)
        },
      },
      // 打包分析插件，h5 + 生产环境才弹出
      UNI_PLATFORM === 'h5'
      && mode === 'production'
      && visualizer({
        filename: './node_modules/.cache/visualizer/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
      // 原生插件资源复制插件 - 仅在 app 平台且启用时生效
      createCopyNativeResourcesPlugin(
        UNI_PLATFORM === 'app' && VITE_COPY_NATIVE_RES_ENABLE === 'true',
        {
          verbose: mode === 'development', // 开发模式显示详细日志
        },
      ),
      syncManifestPlugin(),
      // 自动打开开发者工具插件 (必须修改 .env 文件中的 VITE_WX_APPID)
      openDevTools({ mode }),
    ],
    define: {
      __VITE_APP_PROXY__: JSON.stringify(VITE_APP_PROXY_ENABLE),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        VITE_SUPABASE_URL || 'https://eufhccrelpucppognlym.supabase.co',
      ),
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin'],
        },
      },
      postcss: {
        plugins: [
          // autoprefixer({
          //   // 指定目标浏览器
          //   overrideBrowserslist: ['> 1%', 'last 2 versions'],
          // }),
        ],
      },
    },

    optimizeDeps: {
      // pnpm monorepo 下 Alova 子包解析问题，排除预构建由 Vite 正常解析
      exclude: ['alova', '@alova/adapter-uniapp', 'alova/vue'],
    },
    resolve: {
      alias: {
        '@': path.join(process.cwd(), './src'),
        // @intlify/shared 补丁：message-compiler 期望 join，但 shared 9.1.9 未导出
        '@intlify/shared': path.resolve(process.cwd(), './src/lib/intlify-shared-shim.ts'),
        'intlify-shared-internal': (() => {
          try {
            const pkgDir = path.dirname(require.resolve('@intlify/shared/package.json'))
            return path.join(pkgDir, 'dist/shared.esm-bundler.js')
          }
          catch {
            return path.join(process.cwd(), 'node_modules/@intlify/shared/dist/shared.esm-bundler.js')
          }
        })(),
        '@img': path.join(process.cwd(), './src/static/images'),
        '@fashion-rec/shared/i18n': path.resolve(process.cwd(), '../shared/src/i18n/index.ts'),
        '@fashion-rec/shared/api/client': path.resolve(process.cwd(), '../shared/src/api/client.ts'),
        '@fashion-rec/shared/api/config': path.resolve(process.cwd(), '../shared/src/api/config.ts'),
        '@fashion-rec/shared': path.resolve(process.cwd(), '../shared/src/index.ts'),
      },
    },
    server: {
      host: '0.0.0.0',
      hmr: true,
      port: Number.parseInt(VITE_APP_PORT, 10),
      fs: { allow: [path.resolve(process.cwd(), '..')] },
      // 仅 H5 端生效，其他端不生效（其他端走build，不走devServer)
      proxy: JSON.parse(VITE_APP_PROXY_ENABLE)
        ? {
            [VITE_APP_PROXY_PREFIX]: {
              target: VITE_SERVER_BASEURL,
              changeOrigin: true,
              // 后端有/api前缀则不做处理，没有则需要去掉
              rewrite: path => path.replace(new RegExp(`^${VITE_APP_PROXY_PREFIX}`), ''),
            },
          }
        : undefined,
    },
    esbuild: {
      drop: VITE_DELETE_CONSOLE === 'true' ? ['console', 'debugger'] : [],
    },
    build: {
      sourcemap: false,
      // 方便非h5端调试
      // sourcemap: VITE_SHOW_SOURCEMAP === 'true', // 默认是false
      target: 'es6',
      // 开发环境不用压缩
      minify: mode === 'development' ? false : 'esbuild',
      // App 端使用 IIFE，与 code-splitting 不兼容，强制内联动态 import
      ...(UNI_PLATFORM === 'app'
        ? {
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
              },
            },
          }
        : {}),
    },
  })
})
