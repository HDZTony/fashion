// vite.config.ts
import { createRequire } from "node:module";
import path4 from "node:path";
import process4 from "node:process";
import Uni from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-helper+plugin-uni@0.1._41cf6d50972d2f1d973ee9088c55d957/node_modules/@uni-helper/plugin-uni/src/index.js";
import UniComponents from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-helper+vite-plugin-uni-components@0.2.3_rollup@4.57.1/node_modules/@uni-helper/vite-plugin-uni-components/dist/index.mjs";
import UniLayouts from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-helper+vite-plugin-uni-layouts@0.1.11_rollup@4.57.1/node_modules/@uni-helper/vite-plugin-uni-layouts/dist/index.mjs";
import UniManifest from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-helper+vite-plugin-uni_d40bd43a136736b4bf2eaa45303de2b6/node_modules/@uni-helper/vite-plugin-uni-manifest/dist/index.mjs";
import UniPages from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-helper+vite-plugin-uni_c0aef1acaef1c0cd11fad6c07d7ee246/node_modules/@uni-helper/vite-plugin-uni-pages/dist/index.mjs";
import UniPlatform from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-helper+vite-plugin-uni-platform@0.0.5/node_modules/@uni-helper/vite-plugin-uni-platform/dist/index.mjs";
import UniOptimization from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-ku+bundle-optimizer@1._19841ea55f64409d1189b7253eb70ce6/node_modules/@uni-ku/bundle-optimizer/dist/index.mjs";
import UniKuRoot from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-ku+root@1.4.1_vite@5.2_df10ee7f0ea52068055a188133a16ba0/node_modules/@uni-ku/root/dist/index.mjs";
import { presetUni } from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@uni-helper+unocss-preset-u_8c09bbe0546249ff35220ceebeb0f4af/node_modules/@uni-helper/unocss-preset-uni/dist/index.mjs";
import { presetLegacyCompat } from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/@unocss+preset-legacy-compat@66.0.0/node_modules/@unocss/preset-legacy-compat/dist/index.mjs";
import {
  presetIcons,
  transformerDirectives,
  transformerVariantGroup
} from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/unocss@66.0.0_postcss@8.5.6_8199ea732c17a1754bd4ea6eaa5ec43c/node_modules/unocss/dist/index.mjs";
import dayjs from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/dayjs@1.11.10/node_modules/dayjs/dayjs.min.js";
import { visualizer } from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/rollup-plugin-visualizer@6.0.5_rollup@4.57.1/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import UnoCSS from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/unocss@66.0.0_postcss@8.5.6_8199ea732c17a1754bd4ea6eaa5ec43c/node_modules/unocss/dist/vite.mjs";
import AutoImport from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/unplugin-auto-import@20.3.0_8a2fb7158efb95341206a77dd242f6dd/node_modules/unplugin-auto-import/dist/vite.mjs";
import { defineConfig, loadEnv } from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/vite@5.2.8_@types+node@20.1_2389e89317d77ce8aaed64d54bc447c3/node_modules/vite/dist/node/index.js";
import ViteRestart from "file:///D:/source_code/fashion/fashion_rec/node_modules/.pnpm/vite-plugin-restart@1.0.0_v_8b32b962a0a312f18e7c27e69b42fe20/node_modules/vite-plugin-restart/dist/index.js";

// scripts/open-dev-tools.js
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
function _openDevTools(env = "dev") {
  const platform = process.platform;
  const { UNI_PLATFORM } = process.env;
  const uniPlatformText = UNI_PLATFORM === "mp-weixin" ? "\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F" : UNI_PLATFORM === "mp-alipay" ? "\u652F\u4ED8\u5B9D\u5C0F\u7A0B\u5E8F" : "\u5C0F\u7A0B\u5E8F";
  const outputDir = env === "build" ? `dist/build/${UNI_PLATFORM}` : `dist/dev/${UNI_PLATFORM}`;
  const projectPath = path.resolve(process.cwd(), outputDir);
  if (!fs.existsSync(projectPath)) {
    console.log(`\u274C ${uniPlatformText}\u6784\u5EFA\u76EE\u5F55\u4E0D\u5B58\u5728:`, projectPath);
    return;
  }
  console.log(`\u{1F680} \u6B63\u5728\u6253\u5F00${uniPlatformText}\u5F00\u53D1\u8005\u5DE5\u5177...`);
  let command = "";
  if (platform === "darwin") {
    if (UNI_PLATFORM === "mp-weixin") {
      command = `/Applications/wechatwebdevtools.app/Contents/MacOS/cli -o "${projectPath}"`;
    } else if (UNI_PLATFORM === "mp-alipay") {
      command = `/Applications/\u5C0F\u7A0B\u5E8F\u5F00\u53D1\u8005\u5DE5\u5177.app/Contents/MacOS/\u5C0F\u7A0B\u5E8F\u5F00\u53D1\u8005\u5DE5\u5177 --p "${projectPath}"`;
    }
  } else if (platform === "win32" || platform === "win64") {
    if (UNI_PLATFORM === "mp-weixin") {
      command = `"C:\\Program Files (x86)\\Tencent\\\u5FAE\u4FE1web\u5F00\u53D1\u8005\u5DE5\u5177\\cli.bat" -o "${projectPath}"`;
    }
  } else {
    console.log("\u274C \u5F53\u524D\u7CFB\u7EDF\u4E0D\u652F\u6301\u81EA\u52A8\u6253\u5F00\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177");
    return;
  }
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`\u274C \u6253\u5F00${uniPlatformText}\u5F00\u53D1\u8005\u5DE5\u5177\u5931\u8D25:`, error.message);
      console.log(`\u{1F4A1} \u8BF7\u786E\u4FDD${uniPlatformText}\u5F00\u53D1\u8005\u5DE5\u5177\u670D\u52A1\u7AEF\u53E3\u5DF2\u542F\u7528`);
      console.log(`\u{1F4A1} \u53EF\u4EE5\u624B\u52A8\u6253\u5F00${uniPlatformText}\u5F00\u53D1\u8005\u5DE5\u5177\u5E76\u5BFC\u5165\u9879\u76EE:`, projectPath);
      return;
    }
    if (stderr) {
      console.log("\u26A0\uFE0F \u8B66\u544A:", stderr);
    }
    console.log(`\u2705 ${uniPlatformText}\u5F00\u53D1\u8005\u5DE5\u5177\u5DF2\u6253\u5F00`);
    if (stdout) {
      console.log(stdout);
    }
  });
}
function openDevTools(options = {}) {
  const { mode = "development" } = options;
  const env = mode === "production" ? "build" : "dev";
  let isFirstBuild = true;
  return {
    name: "uni-devtools",
    writeBundle() {
      if (isFirstBuild && process.env.UNI_PLATFORM?.includes("mp")) {
        isFirstBuild = false;
        _openDevTools(env);
      }
    }
  };
}

// vite-plugins/copy-native-resources.ts
import fs2 from "node:fs";
import path2 from "node:path";
import process2 from "node:process";
var DEFAULT_OPTIONS = {
  enable: true,
  sourceDir: "nativeplugins",
  targetDirName: "nativeplugins",
  verbose: true,
  logPrefix: "[copy-native-resources]"
};
function copyNativeResources(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  if (!config.enable) {
    return {
      name: "copy-native-resources-disabled",
      apply: "build",
      writeBundle() {
      }
    };
  }
  return {
    name: "copy-native-resources",
    apply: "build",
    // 只在构建时应用
    enforce: "post",
    // 在其他插件执行完毕后执行
    async writeBundle() {
      const { sourceDir, targetDirName, verbose, logPrefix } = config;
      try {
        const projectRoot = process2.cwd();
        const sourcePath = path2.resolve(projectRoot, sourceDir);
        const buildMode = process2.env.NODE_ENV === "production" ? "build" : "dev";
        const platform = process2.env.UNI_PLATFORM || "app";
        const targetPath = path2.resolve(
          projectRoot,
          "dist",
          buildMode,
          platform,
          targetDirName
        );
        const sourceExists = fs2.existsSync(sourcePath);
        if (!sourceExists) {
          if (verbose) {
            console.warn(`${logPrefix} \u6E90\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u8DF3\u8FC7\u590D\u5236\u64CD\u4F5C`);
            console.warn(`${logPrefix} \u6E90\u76EE\u5F55\u8DEF\u5F84: ${sourcePath}`);
            console.warn(`${logPrefix} \u5982\u9700\u4F7F\u7528\u672C\u5730\u539F\u751F\u63D2\u4EF6\uFF0C\u8BF7\u5728\u9879\u76EE\u6839\u76EE\u5F55\u521B\u5EFA nativeplugins \u76EE\u5F55`);
            console.warn(`${logPrefix} \u5E76\u6309\u7167\u5B98\u65B9\u6587\u6863\u653E\u5165\u539F\u751F\u63D2\u4EF6\u6587\u4EF6`);
            console.warn(`${logPrefix} \u53C2\u8003: https://uniapp.dcloud.net.cn/plugin/native-plugin.html`);
          }
          return;
        }
        const sourceFiles = fs2.readdirSync(sourcePath);
        if (sourceFiles.length === 0) {
          if (verbose) {
            console.warn(`${logPrefix} \u6E90\u76EE\u5F55\u4E3A\u7A7A\uFF0C\u8DF3\u8FC7\u590D\u5236\u64CD\u4F5C`);
            console.warn(`${logPrefix} \u6E90\u76EE\u5F55\u8DEF\u5F84: ${sourcePath}`);
            console.warn(`${logPrefix} \u8BF7\u5728 nativeplugins \u76EE\u5F55\u4E2D\u653E\u5165\u539F\u751F\u63D2\u4EF6\u6587\u4EF6`);
          }
          return;
        }
        fs2.mkdirSync(targetPath, { recursive: true });
        if (verbose) {
          console.log(`${logPrefix} \u5F00\u59CB\u590D\u5236 UniApp \u672C\u5730\u539F\u751F\u63D2\u4EF6...`);
          console.log(`${logPrefix} \u6E90\u76EE\u5F55: ${sourcePath}`);
          console.log(`${logPrefix} \u76EE\u6807\u76EE\u5F55: ${targetPath}`);
          console.log(`${logPrefix} \u6784\u5EFA\u6A21\u5F0F: ${buildMode}`);
          console.log(`${logPrefix} \u76EE\u6807\u5E73\u53F0: ${platform}`);
          console.log(`${logPrefix} \u53D1\u73B0 ${sourceFiles.length} \u4E2A\u539F\u751F\u63D2\u4EF6\u6587\u4EF6/\u76EE\u5F55`);
        }
        const copyDir = (src, dest) => {
          const st = fs2.statSync(src);
          if (st.isDirectory()) {
            fs2.mkdirSync(dest, { recursive: true });
            for (const name of fs2.readdirSync(src)) {
              copyDir(path2.join(src, name), path2.join(dest, name));
            }
          } else {
            fs2.copyFileSync(src, dest);
          }
        };
        copyDir(sourcePath, targetPath);
        if (verbose) {
          console.log(`${logPrefix} \u2705 UniApp \u672C\u5730\u539F\u751F\u63D2\u4EF6\u590D\u5236\u5B8C\u6210`);
          console.log(`${logPrefix} \u5DF2\u6210\u529F\u590D\u5236 ${sourceFiles.length} \u4E2A\u6587\u4EF6/\u76EE\u5F55\u5230\u6784\u5EFA\u76EE\u5F55`);
          console.log(`${logPrefix} \u539F\u751F\u63D2\u4EF6\u73B0\u5728\u53EF\u4EE5\u5728 App \u4E2D\u6B63\u5E38\u4F7F\u7528`);
        }
      } catch (error) {
        console.error(`${config.logPrefix} \u274C \u590D\u5236 UniApp \u672C\u5730\u539F\u751F\u63D2\u4EF6\u5931\u8D25:`, error);
        console.error(`${config.logPrefix} \u9519\u8BEF\u8BE6\u60C5:`, error instanceof Error ? error.message : String(error));
        console.error(`${config.logPrefix} \u8BF7\u68C0\u67E5\u6E90\u76EE\u5F55\u6743\u9650\u548C\u78C1\u76D8\u7A7A\u95F4`);
      }
    }
  };
}
function createCopyNativeResourcesPlugin(enable = true, options = {}) {
  return copyNativeResources({ enable, ...options });
}

// vite-plugins/marked-unicode-shim.ts
var P = "\\u2000-\\u206F\\u3000-\\u303F!\"#\\$%&'()*+,\\-./:;<=>?@\\[\\]^_`{|}~";
function replaceUnicodeRegex(code) {
  let result = code;
  result = result.replace(/\/\[\\p\{L\}\\p\{N\}\]\/u/g, "/[0-9A-Za-z\\u0080-\\uFFFF]/");
  result = result.replace(/\/\[\\p\{P\}\\p\{S\}\]\/u/g, `/[${P}]/`);
  result = result.replace(/\/\[\\s\\p\{P\}\\p\{S\}\]\/u/g, `/[\\s${P}]/`);
  result = result.replace(/\/\[\^\\s\\p\{P\}\\p\{S\}\]\/u/g, `/[^\\s${P}]/`);
  result = result.replace(/\/\(?!~\)\[\\p\{P\}\\p\{S\}\]\/u/g, `/(?!~)[${P}]/`);
  result = result.replace(/\/\(?!~\)\[\\s\\p\{P\}\\p\{S\}\]\/u/g, `/(?!~)[\\s${P}]/`);
  result = result.replace(/\/\(?:\[\^\\s\\p\{P\}\\p\{S\}\]\|~\)\/u/g, `/(?:[^\\s${P}]|~)/`);
  result = result.replace(/\\p\{P\}\\p\{S\}/g, P);
  result = result.replace(/\\p\{L\}\\p\{N\}/g, "0-9A-Za-z\\u0080-\\uFFFF");
  return result;
}
function markedUnicodeShim() {
  return {
    name: "marked-unicode-shim",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("node_modules") || !id.includes("marked"))
        return null;
      const newCode = replaceUnicodeRegex(code);
      if (newCode !== code)
        return { code: newCode, map: null };
      return null;
    }
  };
}

// vite-plugins/sync-manifest-plugins.ts
import fs3 from "node:fs";
import path3 from "node:path";
import process3 from "node:process";
function syncManifestPlugin() {
  return {
    name: "sync-manifest",
    apply: "build",
    enforce: "post",
    writeBundle: {
      order: "post",
      handler() {
        const srcManifestPath = path3.resolve(process3.cwd(), "./src/manifest.json");
        const distAppPath = path3.resolve(process3.cwd(), "./dist/dev/app/manifest.json");
        try {
          const srcManifest = JSON.parse(fs3.readFileSync(srcManifestPath, "utf8"));
          const distAppDir = path3.dirname(distAppPath);
          if (!fs3.existsSync(distAppDir)) {
            fs3.mkdirSync(distAppDir, { recursive: true });
          }
          let distManifest = {};
          if (fs3.existsSync(distAppPath)) {
            distManifest = JSON.parse(fs3.readFileSync(distAppPath, "utf8"));
          }
          if (srcManifest["app-plus"]?.distribute?.plugins) {
            if (!distManifest.plus)
              distManifest.plus = {};
            if (!distManifest.plus.distribute)
              distManifest.plus.distribute = {};
            distManifest.plus.distribute.plugins = srcManifest["app-plus"].distribute.plugins;
            fs3.writeFileSync(distAppPath, JSON.stringify(distManifest, null, 2));
            console.log("\u2705 Manifest plugins \u540C\u6B65\u6210\u529F");
          }
        } catch (error) {
          console.error("\u274C \u540C\u6B65 manifest plugins \u5931\u8D25:", error);
        }
      }
    }
  };
}

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///D:/source_code/fashion/fashion_rec/uniapp-v2/vite.config.ts";
var require2 = createRequire(__vite_injected_original_import_meta_url);
var vite_config_default = defineConfig(({ command, mode }) => {
  console.log("command, mode -> ", command, mode);
  const { UNI_PLATFORM } = process4.env;
  console.log("UNI_PLATFORM -> ", UNI_PLATFORM);
  const env = loadEnv(mode, path4.resolve(process4.cwd(), "env"));
  const {
    VITE_APP_PORT,
    VITE_SERVER_BASEURL,
    VITE_APP_TITLE,
    VITE_DELETE_CONSOLE,
    VITE_APP_PUBLIC_BASE,
    VITE_APP_PROXY_ENABLE,
    VITE_APP_PROXY_PREFIX,
    VITE_COPY_NATIVE_RES_ENABLE
  } = env;
  console.log("\u73AF\u5883\u53D8\u91CF env -> ", env);
  return defineConfig({
    envDir: "./env",
    // 自定义env目录
    base: VITE_APP_PUBLIC_BASE,
    plugins: [
      // marked Unicode 正则替换：UniApp App (JSC) 不支持 \p{L}\p{N} 等
      markedUnicodeShim(),
      // UniXXX 需要在 Uni 之前引入
      UniLayouts(),
      UniPlatform(),
      UniManifest(),
      UniComponents({
        extensions: ["vue"],
        deep: true,
        // 是否递归扫描子目录，
        directoryAsNamespace: false,
        // 是否把目录名作为命名空间前缀，true 时组件名为 目录名+组件名，
        dts: "src/types/components.d.ts"
        // 自动生成的组件类型声明文件路径（用于 TypeScript 支持）
      }),
      UniPages({
        exclude: ["**/components/**/**.*", "**/sections/**/**.*"],
        // pages 目录为 src/pages，分包目录不能配置在pages目录下！！
        // 是个数组，可以配置多个，但是不能为pages里面的目录！！
        subPackages: [],
        dts: "src/types/uni-pages.d.ts"
      }),
      // UniOptimization 插件需要 page.json 文件，故应在 UniPages 插件之后执行
      UniOptimization({
        enable: {
          "optimization": true,
          "async-import": true,
          "async-component": true
        },
        dts: {
          base: "src/types"
        },
        logger: false
      }),
      // 若存在改变 pages.json 的插件，请将 UniKuRoot 放置其后
      UniKuRoot({
        excludePages: ["**/components/**/**.*", "**/sections/**/**.*"]
      }),
      Uni(),
      {
        // 临时解决 dcloudio 官方的 @dcloudio/uni-mp-compiler 出现的编译 BUG
        // 参考 github issue: https://github.com/dcloudio/uni-app/issues/4952
        // 自定义插件禁用 vite:vue 插件的 devToolsEnabled，强制编译 vue 模板时 inline 为 true
        name: "fix-vite-plugin-vue",
        configResolved(config) {
          const plugin = config.plugins.find((p) => p.name === "vite:vue");
          if (plugin && plugin.api && plugin.api.options) {
            plugin.api.options.devToolsEnabled = false;
          }
        }
      },
      // 内联 UnoCSS 配置，避免 Windows 下 unconfig 加载 uno.config.ts 时触发 ERR_UNSUPPORTED_ESM_URL_SCHEME
      UnoCSS({
        presets: [
          presetUni({ attributify: false }),
          presetIcons({
            scale: 1.2,
            warn: true,
            extraProperties: {
              display: "inline-block",
              "vertical-align": "middle"
            }
          }),
          presetLegacyCompat({
            commaStyleColorFunction: true,
            legacyColorSpace: true
          })
        ],
        transformers: [transformerDirectives(), transformerVariantGroup()],
        shortcuts: [{ center: "flex justify-center items-center" }],
        safelist: [
          "i-carbon-code",
          "i-carbon-home",
          "i-carbon-user",
          "i-carbon-document",
          " i-carbon-ibm-watson-language-translator"
        ],
        rules: [
          [
            "p-safe",
            {
              padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"
            }
          ],
          ["pt-safe", { "padding-top": "env(safe-area-inset-top)" }],
          ["pb-safe", { "padding-bottom": "env(safe-area-inset-bottom)" }]
        ],
        theme: {
          colors: {
            primary: "var(--wot-color-theme,#0957DE)",
            pink: {
              50: "#fdf2f8",
              100: "#fce7f3",
              200: "#fbcfe8",
              300: "#f9a8d4",
              400: "#f472b6",
              500: "#ec4899",
              600: "#db2777",
              700: "#be185d",
              800: "#9d174d",
              900: "#831843"
            },
            purple: {
              50: "#faf5ff",
              100: "#f3e8ff",
              200: "#e9d5ff",
              400: "#c084fc",
              600: "#9333ea",
              700: "#7e22ce"
            }
          },
          fontSize: {
            "2xs": ["20rpx", "28rpx"],
            "3xs": ["18rpx", "26rpx"]
          }
        }
      }),
      AutoImport({
        imports: ["vue", "uni-app"],
        dts: "src/types/auto-import.d.ts",
        dirs: ["src/hooks"],
        // 自动导入 hooks
        vueTemplate: true
        // default false
      }),
      ViteRestart({
        // 通过这个插件，在修改vite.config.js文件则不需要重新运行也生效配置
        restart: ["vite.config.js"]
      }),
      // h5环境增加 BUILD_TIME 和 BUILD_BRANCH
      UNI_PLATFORM === "h5" && {
        name: "html-transform",
        transformIndexHtml(html) {
          return html.replace("%BUILD_TIME%", dayjs().format("YYYY-MM-DD HH:mm:ss")).replace("%VITE_APP_TITLE%", VITE_APP_TITLE);
        }
      },
      // 打包分析插件，h5 + 生产环境才弹出
      UNI_PLATFORM === "h5" && mode === "production" && visualizer({
        filename: "./node_modules/.cache/visualizer/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true
      }),
      // 原生插件资源复制插件 - 仅在 app 平台且启用时生效
      createCopyNativeResourcesPlugin(
        UNI_PLATFORM === "app" && VITE_COPY_NATIVE_RES_ENABLE === "true",
        {
          verbose: mode === "development"
          // 开发模式显示详细日志
        }
      ),
      syncManifestPlugin(),
      // 自动打开开发者工具插件 (必须修改 .env 文件中的 VITE_WX_APPID)
      openDevTools({ mode })
    ],
    define: {
      __VITE_APP_PROXY__: JSON.stringify(VITE_APP_PROXY_ENABLE)
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["legacy-js-api", "import", "global-builtin"]
        }
      },
      postcss: {
        plugins: [
          // autoprefixer({
          //   // 指定目标浏览器
          //   overrideBrowserslist: ['> 1%', 'last 2 versions'],
          // }),
        ]
      }
    },
    optimizeDeps: {
      // pnpm monorepo 下 Supabase/Alova 子包解析问题，排除预构建由 Vite 正常解析
      exclude: ["@supabase/supabase-js", "alova", "@alova/adapter-uniapp", "alova/vue"]
    },
    resolve: {
      alias: {
        "@": path4.join(process4.cwd(), "./src"),
        // @intlify/shared 补丁：message-compiler 期望 join，但 shared 9.1.9 未导出
        "@intlify/shared": path4.resolve(process4.cwd(), "./src/lib/intlify-shared-shim.ts"),
        "intlify-shared-internal": (() => {
          try {
            const pkgDir = path4.dirname(require2.resolve("@intlify/shared/package.json"));
            return path4.join(pkgDir, "dist/shared.esm-bundler.js");
          } catch {
            return path4.join(process4.cwd(), "node_modules/@intlify/shared/dist/shared.esm-bundler.js");
          }
        })(),
        // pnpm 下 supabase-js 子包解析：显式映射到实际路径
        ...(() => {
          const aliases = {};
          for (const name of ["functions-js", "postgrest-js", "realtime-js", "storage-js", "auth-js"]) {
            try {
              aliases[`@supabase/${name}`] = path4.dirname(require2.resolve(`@supabase/${name}/package.json`));
            } catch {
            }
          }
          return aliases;
        })(),
        "@img": path4.join(process4.cwd(), "./src/static/images"),
        "@fashion-rec/shared/i18n": path4.resolve(process4.cwd(), "../shared/src/i18n/index.ts"),
        "@fashion-rec/shared/api/client": path4.resolve(process4.cwd(), "../shared/src/api/client.ts"),
        "@fashion-rec/shared/api/config": path4.resolve(process4.cwd(), "../shared/src/api/config.ts"),
        "@fashion-rec/shared": path4.resolve(process4.cwd(), "../shared/src/index.ts")
      }
    },
    server: {
      host: "0.0.0.0",
      hmr: true,
      port: Number.parseInt(VITE_APP_PORT, 10),
      fs: { allow: [path4.resolve(process4.cwd(), "..")] },
      // 仅 H5 端生效，其他端不生效（其他端走build，不走devServer)
      proxy: JSON.parse(VITE_APP_PROXY_ENABLE) ? {
        [VITE_APP_PROXY_PREFIX]: {
          target: VITE_SERVER_BASEURL,
          changeOrigin: true,
          // 后端有/api前缀则不做处理，没有则需要去掉
          rewrite: (path5) => path5.replace(new RegExp(`^${VITE_APP_PROXY_PREFIX}`), "")
        }
      } : void 0
    },
    esbuild: {
      drop: VITE_DELETE_CONSOLE === "true" ? ["console", "debugger"] : []
    },
    build: {
      sourcemap: false,
      // 方便非h5端调试
      // sourcemap: VITE_SHOW_SOURCEMAP === 'true', // 默认是false
      target: "es6",
      // 开发环境不用压缩
      minify: mode === "development" ? false : "esbuild"
    }
  });
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic2NyaXB0cy9vcGVuLWRldi10b29scy5qcyIsICJ2aXRlLXBsdWdpbnMvY29weS1uYXRpdmUtcmVzb3VyY2VzLnRzIiwgInZpdGUtcGx1Z2lucy9tYXJrZWQtdW5pY29kZS1zaGltLnRzIiwgInZpdGUtcGx1Z2lucy9zeW5jLW1hbmlmZXN0LXBsdWdpbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzb3VyY2VfY29kZVxcXFxmYXNoaW9uXFxcXGZhc2hpb25fcmVjXFxcXHVuaWFwcC12MlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcc291cmNlX2NvZGVcXFxcZmFzaGlvblxcXFxmYXNoaW9uX3JlY1xcXFx1bmlhcHAtdjJcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L3NvdXJjZV9jb2RlL2Zhc2hpb24vZmFzaGlvbl9yZWMvdW5pYXBwLXYyL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnXHJcbmltcG9ydCBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcclxuXHJcbmNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybClcclxuaW1wb3J0IHR5cGUgeyBQcmVzZXQgfSBmcm9tICd1bm9jc3MnXHJcbmltcG9ydCBVbmkgZnJvbSAnQHVuaS1oZWxwZXIvcGx1Z2luLXVuaSdcclxuaW1wb3J0IFVuaUNvbXBvbmVudHMgZnJvbSAnQHVuaS1oZWxwZXIvdml0ZS1wbHVnaW4tdW5pLWNvbXBvbmVudHMnXHJcbi8vIEBzZWUgaHR0cHM6Ly91bmktaGVscGVyLmpzLm9yZy92aXRlLXBsdWdpbi11bmktbGF5b3V0c1xyXG5pbXBvcnQgVW5pTGF5b3V0cyBmcm9tICdAdW5pLWhlbHBlci92aXRlLXBsdWdpbi11bmktbGF5b3V0cydcclxuLy8gQHNlZSBodHRwczovL2dpdGh1Yi5jb20vdW5pLWhlbHBlci92aXRlLXBsdWdpbi11bmktbWFuaWZlc3RcclxuaW1wb3J0IFVuaU1hbmlmZXN0IGZyb20gJ0B1bmktaGVscGVyL3ZpdGUtcGx1Z2luLXVuaS1tYW5pZmVzdCdcclxuLy8gQHNlZSBodHRwczovL3VuaS1oZWxwZXIuanMub3JnL3ZpdGUtcGx1Z2luLXVuaS1wYWdlc1xyXG5pbXBvcnQgVW5pUGFnZXMgZnJvbSAnQHVuaS1oZWxwZXIvdml0ZS1wbHVnaW4tdW5pLXBhZ2VzJ1xyXG4vLyBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS91bmktaGVscGVyL3ZpdGUtcGx1Z2luLXVuaS1wbGF0Zm9ybVxyXG4vLyBcdTk3MDBcdTg5ODFcdTRFMEUgQHVuaS1oZWxwZXIvdml0ZS1wbHVnaW4tdW5pLXBhZ2VzIFx1NjNEMlx1NEVGNlx1NEUwMFx1OEQ3N1x1NEY3Rlx1NzUyOFxyXG5pbXBvcnQgVW5pUGxhdGZvcm0gZnJvbSAnQHVuaS1oZWxwZXIvdml0ZS1wbHVnaW4tdW5pLXBsYXRmb3JtJ1xyXG4vKipcclxuICogXHU1MjA2XHU1MzA1XHU0RjE4XHU1MzE2XHUzMDAxXHU2QTIxXHU1NzU3XHU1RjAyXHU2QjY1XHU4REU4XHU1MzA1XHU4QzAzXHU3NTI4XHUzMDAxXHU3RUM0XHU0RUY2XHU1RjAyXHU2QjY1XHU4REU4XHU1MzA1XHU1RjE1XHU3NTI4XHJcbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3VuaS1rdS9idW5kbGUtb3B0aW1pemVyXHJcbiAqL1xyXG5pbXBvcnQgVW5pT3B0aW1pemF0aW9uIGZyb20gJ0B1bmkta3UvYnVuZGxlLW9wdGltaXplcidcclxuLy8gaHR0cHM6Ly9naXRodWIuY29tL3VuaS1rdS9yb290XHJcbmltcG9ydCBVbmlLdVJvb3QgZnJvbSAnQHVuaS1rdS9yb290J1xyXG5pbXBvcnQgeyBwcmVzZXRVbmkgfSBmcm9tICdAdW5pLWhlbHBlci91bm9jc3MtcHJlc2V0LXVuaSdcclxuaW1wb3J0IHsgcHJlc2V0TGVnYWN5Q29tcGF0IH0gZnJvbSAnQHVub2Nzcy9wcmVzZXQtbGVnYWN5LWNvbXBhdCdcclxuaW1wb3J0IHtcclxuICBwcmVzZXRJY29ucyxcclxuICB0cmFuc2Zvcm1lckRpcmVjdGl2ZXMsXHJcbiAgdHJhbnNmb3JtZXJWYXJpYW50R3JvdXAsXHJcbn0gZnJvbSAndW5vY3NzJ1xyXG5pbXBvcnQgZGF5anMgZnJvbSAnZGF5anMnXHJcbmltcG9ydCB7IHZpc3VhbGl6ZXIgfSBmcm9tICdyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXInXHJcbmltcG9ydCBVbm9DU1MgZnJvbSAndW5vY3NzL3ZpdGUnXHJcbmltcG9ydCBBdXRvSW1wb3J0IGZyb20gJ3VucGx1Z2luLWF1dG8taW1wb3J0L3ZpdGUnXHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCBWaXRlUmVzdGFydCBmcm9tICd2aXRlLXBsdWdpbi1yZXN0YXJ0J1xyXG5pbXBvcnQgb3BlbkRldlRvb2xzIGZyb20gJy4vc2NyaXB0cy9vcGVuLWRldi10b29scydcclxuaW1wb3J0IHsgY3JlYXRlQ29weU5hdGl2ZVJlc291cmNlc1BsdWdpbiB9IGZyb20gJy4vdml0ZS1wbHVnaW5zL2NvcHktbmF0aXZlLXJlc291cmNlcydcclxuaW1wb3J0IHsgbWFya2VkVW5pY29kZVNoaW0gfSBmcm9tICcuL3ZpdGUtcGx1Z2lucy9tYXJrZWQtdW5pY29kZS1zaGltJ1xyXG5pbXBvcnQgc3luY01hbmlmZXN0UGx1Z2luIGZyb20gJy4vdml0ZS1wbHVnaW5zL3N5bmMtbWFuaWZlc3QtcGx1Z2lucydcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBjb21tYW5kLCBtb2RlIH0pID0+IHtcclxuICAvLyBAc2VlIGh0dHBzOi8vdW5vY3NzLmRldi9cclxuICAvLyBjb25zdCBVbm9DU1MgPSAoYXdhaXQgaW1wb3J0KCd1bm9jc3Mvdml0ZScpKS5kZWZhdWx0XHJcbiAgLy8gY29uc29sZS5sb2cobW9kZSA9PT0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYpIC8vIHRydWVcclxuXHJcbiAgLy8gbW9kZTogXHU1MzNBXHU1MjA2XHU3NTFGXHU0RUE3XHU3M0FGXHU1ODgzXHU4RkQ4XHU2NjJGXHU1RjAwXHU1M0QxXHU3M0FGXHU1ODgzXHJcbiAgY29uc29sZS5sb2coJ2NvbW1hbmQsIG1vZGUgLT4gJywgY29tbWFuZCwgbW9kZSlcclxuICAvLyBwbnBtIGRldjpoNSBcdTY1RjZcdTVGOTdcdTUyMzAgPT4gc2VydmUgZGV2ZWxvcG1lbnRcclxuICAvLyBwbnBtIGJ1aWxkOmg1IFx1NjVGNlx1NUY5N1x1NTIzMCA9PiBidWlsZCBwcm9kdWN0aW9uXHJcbiAgLy8gcG5wbSBkZXY6bXAtd2VpeGluIFx1NjVGNlx1NUY5N1x1NTIzMCA9PiBidWlsZCBkZXZlbG9wbWVudCAoXHU2Q0U4XHU2MTBGXHU1MzNBXHU1MjJCXHVGRjBDY29tbWFuZFx1NEUzQWJ1aWxkKVxyXG4gIC8vIHBucG0gYnVpbGQ6bXAtd2VpeGluIFx1NjVGNlx1NUY5N1x1NTIzMCA9PiBidWlsZCBwcm9kdWN0aW9uXHJcbiAgLy8gcG5wbSBkZXY6YXBwIFx1NjVGNlx1NUY5N1x1NTIzMCA9PiBidWlsZCBkZXZlbG9wbWVudCAoXHU2Q0U4XHU2MTBGXHU1MzNBXHU1MjJCXHVGRjBDY29tbWFuZFx1NEUzQWJ1aWxkKVxyXG4gIC8vIHBucG0gYnVpbGQ6YXBwIFx1NjVGNlx1NUY5N1x1NTIzMCA9PiBidWlsZCBwcm9kdWN0aW9uXHJcbiAgLy8gZGV2IFx1NTQ4QyBidWlsZCBcdTU0N0RcdTRFRTRcdTUzRUZcdTRFRTVcdTUyMDZcdTUyMkJcdTRGN0ZcdTc1MjggLmVudi5kZXZlbG9wbWVudCBcdTU0OEMgLmVudi5wcm9kdWN0aW9uIFx1NzY4NFx1NzNBRlx1NTg4M1x1NTNEOFx1OTFDRlxyXG5cclxuICBjb25zdCB7IFVOSV9QTEFURk9STSB9ID0gcHJvY2Vzcy5lbnZcclxuICBjb25zb2xlLmxvZygnVU5JX1BMQVRGT1JNIC0+ICcsIFVOSV9QTEFURk9STSkgLy8gXHU1Rjk3XHU1MjMwIG1wLXdlaXhpbiwgaDUsIGFwcCBcdTdCNDlcclxuXHJcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgJ2VudicpKVxyXG4gIGNvbnN0IHtcclxuICAgIFZJVEVfQVBQX1BPUlQsXHJcbiAgICBWSVRFX1NFUlZFUl9CQVNFVVJMLFxyXG4gICAgVklURV9BUFBfVElUTEUsXHJcbiAgICBWSVRFX0RFTEVURV9DT05TT0xFLFxyXG4gICAgVklURV9BUFBfUFVCTElDX0JBU0UsXHJcbiAgICBWSVRFX0FQUF9QUk9YWV9FTkFCTEUsXHJcbiAgICBWSVRFX0FQUF9QUk9YWV9QUkVGSVgsXHJcbiAgICBWSVRFX0NPUFlfTkFUSVZFX1JFU19FTkFCTEUsXHJcbiAgfSA9IGVudlxyXG4gIGNvbnNvbGUubG9nKCdcdTczQUZcdTU4ODNcdTUzRDhcdTkxQ0YgZW52IC0+ICcsIGVudilcclxuXHJcbiAgcmV0dXJuIGRlZmluZUNvbmZpZyh7XHJcbiAgICBlbnZEaXI6ICcuL2VudicsIC8vIFx1ODFFQVx1NUI5QVx1NEU0OWVudlx1NzZFRVx1NUY1NVxyXG4gICAgYmFzZTogVklURV9BUFBfUFVCTElDX0JBU0UsXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgIC8vIG1hcmtlZCBVbmljb2RlIFx1NkI2M1x1NTIxOVx1NjZGRlx1NjM2Mlx1RkYxQVVuaUFwcCBBcHAgKEpTQykgXHU0RTBEXHU2NTJGXHU2MzAxIFxccHtMfVxccHtOfSBcdTdCNDlcclxuICAgICAgbWFya2VkVW5pY29kZVNoaW0oKSxcclxuICAgICAgLy8gVW5pWFhYIFx1OTcwMFx1ODk4MVx1NTcyOCBVbmkgXHU0RTRCXHU1MjREXHU1RjE1XHU1MTY1XHJcbiAgICAgIFVuaUxheW91dHMoKSxcclxuICAgICAgVW5pUGxhdGZvcm0oKSxcclxuICAgICAgVW5pTWFuaWZlc3QoKSxcclxuICAgICAgVW5pQ29tcG9uZW50cyh7XHJcbiAgICAgICAgZXh0ZW5zaW9uczogWyd2dWUnXSxcclxuICAgICAgICBkZWVwOiB0cnVlLCAvLyBcdTY2MkZcdTU0MjZcdTkwMTJcdTVGNTJcdTYyNkJcdTYzQ0ZcdTVCNTBcdTc2RUVcdTVGNTVcdUZGMENcclxuICAgICAgICBkaXJlY3RvcnlBc05hbWVzcGFjZTogZmFsc2UsIC8vIFx1NjYyRlx1NTQyNlx1NjI4QVx1NzZFRVx1NUY1NVx1NTQwRFx1NEY1Q1x1NEUzQVx1NTQ3RFx1NTQwRFx1N0E3QVx1OTVGNFx1NTI0RFx1N0YwMFx1RkYwQ3RydWUgXHU2NUY2XHU3RUM0XHU0RUY2XHU1NDBEXHU0RTNBIFx1NzZFRVx1NUY1NVx1NTQwRCtcdTdFQzRcdTRFRjZcdTU0MERcdUZGMENcclxuICAgICAgICBkdHM6ICdzcmMvdHlwZXMvY29tcG9uZW50cy5kLnRzJywgLy8gXHU4MUVBXHU1MkE4XHU3NTFGXHU2MjEwXHU3Njg0XHU3RUM0XHU0RUY2XHU3QzdCXHU1NzhCXHU1OEYwXHU2NjBFXHU2NTg3XHU0RUY2XHU4REVGXHU1Rjg0XHVGRjA4XHU3NTI4XHU0RThFIFR5cGVTY3JpcHQgXHU2NTJGXHU2MzAxXHVGRjA5XHJcbiAgICAgIH0pLFxyXG4gICAgICBVbmlQYWdlcyh7XHJcbiAgICAgICAgZXhjbHVkZTogWycqKi9jb21wb25lbnRzLyoqLyoqLionLCAnKiovc2VjdGlvbnMvKiovKiouKiddLFxyXG4gICAgICAgIC8vIHBhZ2VzIFx1NzZFRVx1NUY1NVx1NEUzQSBzcmMvcGFnZXNcdUZGMENcdTUyMDZcdTUzMDVcdTc2RUVcdTVGNTVcdTRFMERcdTgwRkRcdTkxNERcdTdGNkVcdTU3MjhwYWdlc1x1NzZFRVx1NUY1NVx1NEUwQlx1RkYwMVx1RkYwMVxyXG4gICAgICAgIC8vIFx1NjYyRlx1NEUyQVx1NjU3MFx1N0VDNFx1RkYwQ1x1NTNFRlx1NEVFNVx1OTE0RFx1N0Y2RVx1NTkxQVx1NEUyQVx1RkYwQ1x1NEY0Nlx1NjYyRlx1NEUwRFx1ODBGRFx1NEUzQXBhZ2VzXHU5MUNDXHU5NzYyXHU3Njg0XHU3NkVFXHU1RjU1XHVGRjAxXHVGRjAxXHJcbiAgICAgICAgc3ViUGFja2FnZXM6IFtdLFxyXG4gICAgICAgIGR0czogJ3NyYy90eXBlcy91bmktcGFnZXMuZC50cycsXHJcbiAgICAgIH0pLFxyXG4gICAgICAvLyBVbmlPcHRpbWl6YXRpb24gXHU2M0QyXHU0RUY2XHU5NzAwXHU4OTgxIHBhZ2UuanNvbiBcdTY1ODdcdTRFRjZcdUZGMENcdTY1NDVcdTVFOTRcdTU3MjggVW5pUGFnZXMgXHU2M0QyXHU0RUY2XHU0RTRCXHU1NDBFXHU2MjY3XHU4ODRDXHJcbiAgICAgIFVuaU9wdGltaXphdGlvbih7XHJcbiAgICAgICAgZW5hYmxlOiB7XHJcbiAgICAgICAgICAnb3B0aW1pemF0aW9uJzogdHJ1ZSxcclxuICAgICAgICAgICdhc3luYy1pbXBvcnQnOiB0cnVlLFxyXG4gICAgICAgICAgJ2FzeW5jLWNvbXBvbmVudCc6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBkdHM6IHtcclxuICAgICAgICAgIGJhc2U6ICdzcmMvdHlwZXMnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbG9nZ2VyOiBmYWxzZSxcclxuICAgICAgfSksXHJcbiAgICAgIC8vIFx1ODJFNVx1NUI1OFx1NTcyOFx1NjUzOVx1NTNEOCBwYWdlcy5qc29uIFx1NzY4NFx1NjNEMlx1NEVGNlx1RkYwQ1x1OEJGN1x1NUMwNiBVbmlLdVJvb3QgXHU2NTNFXHU3RjZFXHU1MTc2XHU1NDBFXHJcbiAgICAgIFVuaUt1Um9vdCh7XHJcbiAgICAgICAgZXhjbHVkZVBhZ2VzOiBbJyoqL2NvbXBvbmVudHMvKiovKiouKicsICcqKi9zZWN0aW9ucy8qKi8qKi4qJ10sXHJcbiAgICAgIH0pLFxyXG4gICAgICBVbmkoKSxcclxuICAgICAge1xyXG4gICAgICAgIC8vIFx1NEUzNFx1NjVGNlx1ODlFM1x1NTFCMyBkY2xvdWRpbyBcdTVCOThcdTY1QjlcdTc2ODQgQGRjbG91ZGlvL3VuaS1tcC1jb21waWxlciBcdTUxRkFcdTczQjBcdTc2ODRcdTdGMTZcdThCRDEgQlVHXHJcbiAgICAgICAgLy8gXHU1M0MyXHU4MDAzIGdpdGh1YiBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL2RjbG91ZGlvL3VuaS1hcHAvaXNzdWVzLzQ5NTJcclxuICAgICAgICAvLyBcdTgxRUFcdTVCOUFcdTRFNDlcdTYzRDJcdTRFRjZcdTc5ODFcdTc1Mjggdml0ZTp2dWUgXHU2M0QyXHU0RUY2XHU3Njg0IGRldlRvb2xzRW5hYmxlZFx1RkYwQ1x1NUYzQVx1NTIzNlx1N0YxNlx1OEJEMSB2dWUgXHU2QTIxXHU2NzdGXHU2NUY2IGlubGluZSBcdTRFM0EgdHJ1ZVxyXG4gICAgICAgIG5hbWU6ICdmaXgtdml0ZS1wbHVnaW4tdnVlJyxcclxuICAgICAgICBjb25maWdSZXNvbHZlZChjb25maWcpIHtcclxuICAgICAgICAgIGNvbnN0IHBsdWdpbiA9IGNvbmZpZy5wbHVnaW5zLmZpbmQocCA9PiBwLm5hbWUgPT09ICd2aXRlOnZ1ZScpXHJcbiAgICAgICAgICBpZiAocGx1Z2luICYmIHBsdWdpbi5hcGkgJiYgcGx1Z2luLmFwaS5vcHRpb25zKSB7XHJcbiAgICAgICAgICAgIHBsdWdpbi5hcGkub3B0aW9ucy5kZXZUb29sc0VuYWJsZWQgPSBmYWxzZVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIFx1NTE4NVx1ODA1NCBVbm9DU1MgXHU5MTREXHU3RjZFXHVGRjBDXHU5MDdGXHU1MTREIFdpbmRvd3MgXHU0RTBCIHVuY29uZmlnIFx1NTJBMFx1OEY3RCB1bm8uY29uZmlnLnRzIFx1NjVGNlx1ODlFNlx1NTNEMSBFUlJfVU5TVVBQT1JURURfRVNNX1VSTF9TQ0hFTUVcclxuICAgICAgVW5vQ1NTKHtcclxuICAgICAgICBwcmVzZXRzOiBbXHJcbiAgICAgICAgICBwcmVzZXRVbmkoeyBhdHRyaWJ1dGlmeTogZmFsc2UgfSksXHJcbiAgICAgICAgICBwcmVzZXRJY29ucyh7XHJcbiAgICAgICAgICAgIHNjYWxlOiAxLjIsXHJcbiAgICAgICAgICAgIHdhcm46IHRydWUsXHJcbiAgICAgICAgICAgIGV4dHJhUHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgIGRpc3BsYXk6ICdpbmxpbmUtYmxvY2snLFxyXG4gICAgICAgICAgICAgICd2ZXJ0aWNhbC1hbGlnbic6ICdtaWRkbGUnLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSksXHJcbiAgICAgICAgICBwcmVzZXRMZWdhY3lDb21wYXQoe1xyXG4gICAgICAgICAgICBjb21tYVN0eWxlQ29sb3JGdW5jdGlvbjogdHJ1ZSxcclxuICAgICAgICAgICAgbGVnYWN5Q29sb3JTcGFjZTogdHJ1ZSxcclxuICAgICAgICAgIH0pIGFzIFByZXNldCxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHRyYW5zZm9ybWVyczogW3RyYW5zZm9ybWVyRGlyZWN0aXZlcygpLCB0cmFuc2Zvcm1lclZhcmlhbnRHcm91cCgpXSxcclxuICAgICAgICBzaG9ydGN1dHM6IFt7IGNlbnRlcjogJ2ZsZXgganVzdGlmeS1jZW50ZXIgaXRlbXMtY2VudGVyJyB9XSxcclxuICAgICAgICBzYWZlbGlzdDogW1xyXG4gICAgICAgICAgJ2ktY2FyYm9uLWNvZGUnLFxyXG4gICAgICAgICAgJ2ktY2FyYm9uLWhvbWUnLFxyXG4gICAgICAgICAgJ2ktY2FyYm9uLXVzZXInLFxyXG4gICAgICAgICAgJ2ktY2FyYm9uLWRvY3VtZW50JyxcclxuICAgICAgICAgICcgaS1jYXJib24taWJtLXdhdHNvbi1sYW5ndWFnZS10cmFuc2xhdG9yJyxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJ1bGVzOiBbXHJcbiAgICAgICAgICBbXHJcbiAgICAgICAgICAgICdwLXNhZmUnLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgcGFkZGluZzpcclxuICAgICAgICAgICAgICAgICdlbnYoc2FmZS1hcmVhLWluc2V0LXRvcCkgZW52KHNhZmUtYXJlYS1pbnNldC1yaWdodCkgZW52KHNhZmUtYXJlYS1pbnNldC1ib3R0b20pIGVudihzYWZlLWFyZWEtaW5zZXQtbGVmdCknLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIFsncHQtc2FmZScsIHsgJ3BhZGRpbmctdG9wJzogJ2VudihzYWZlLWFyZWEtaW5zZXQtdG9wKScgfV0sXHJcbiAgICAgICAgICBbJ3BiLXNhZmUnLCB7ICdwYWRkaW5nLWJvdHRvbSc6ICdlbnYoc2FmZS1hcmVhLWluc2V0LWJvdHRvbSknIH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgdGhlbWU6IHtcclxuICAgICAgICAgIGNvbG9yczoge1xyXG4gICAgICAgICAgICBwcmltYXJ5OiAndmFyKC0td290LWNvbG9yLXRoZW1lLCMwOTU3REUpJyxcclxuICAgICAgICAgICAgcGluazoge1xyXG4gICAgICAgICAgICAgIDUwOiAnI2ZkZjJmOCcsXHJcbiAgICAgICAgICAgICAgMTAwOiAnI2ZjZTdmMycsXHJcbiAgICAgICAgICAgICAgMjAwOiAnI2ZiY2ZlOCcsXHJcbiAgICAgICAgICAgICAgMzAwOiAnI2Y5YThkNCcsXHJcbiAgICAgICAgICAgICAgNDAwOiAnI2Y0NzJiNicsXHJcbiAgICAgICAgICAgICAgNTAwOiAnI2VjNDg5OScsXHJcbiAgICAgICAgICAgICAgNjAwOiAnI2RiMjc3NycsXHJcbiAgICAgICAgICAgICAgNzAwOiAnI2JlMTg1ZCcsXHJcbiAgICAgICAgICAgICAgODAwOiAnIzlkMTc0ZCcsXHJcbiAgICAgICAgICAgICAgOTAwOiAnIzgzMTg0MycsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHB1cnBsZToge1xyXG4gICAgICAgICAgICAgIDUwOiAnI2ZhZjVmZicsXHJcbiAgICAgICAgICAgICAgMTAwOiAnI2YzZThmZicsXHJcbiAgICAgICAgICAgICAgMjAwOiAnI2U5ZDVmZicsXHJcbiAgICAgICAgICAgICAgNDAwOiAnI2MwODRmYycsXHJcbiAgICAgICAgICAgICAgNjAwOiAnIzkzMzNlYScsXHJcbiAgICAgICAgICAgICAgNzAwOiAnIzdlMjJjZScsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgZm9udFNpemU6IHtcclxuICAgICAgICAgICAgJzJ4cyc6IFsnMjBycHgnLCAnMjhycHgnXSxcclxuICAgICAgICAgICAgJzN4cyc6IFsnMThycHgnLCAnMjZycHgnXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSksXHJcbiAgICAgIEF1dG9JbXBvcnQoe1xyXG4gICAgICAgIGltcG9ydHM6IFsndnVlJywgJ3VuaS1hcHAnXSxcclxuICAgICAgICBkdHM6ICdzcmMvdHlwZXMvYXV0by1pbXBvcnQuZC50cycsXHJcbiAgICAgICAgZGlyczogWydzcmMvaG9va3MnXSwgLy8gXHU4MUVBXHU1MkE4XHU1QkZDXHU1MTY1IGhvb2tzXHJcbiAgICAgICAgdnVlVGVtcGxhdGU6IHRydWUsIC8vIGRlZmF1bHQgZmFsc2VcclxuICAgICAgfSksXHJcbiAgICAgIFZpdGVSZXN0YXJ0KHtcclxuICAgICAgICAvLyBcdTkwMUFcdThGQzdcdThGRDlcdTRFMkFcdTYzRDJcdTRFRjZcdUZGMENcdTU3MjhcdTRGRUVcdTY1Mzl2aXRlLmNvbmZpZy5qc1x1NjU4N1x1NEVGNlx1NTIxOVx1NEUwRFx1OTcwMFx1ODk4MVx1OTFDRFx1NjVCMFx1OEZEMFx1ODg0Q1x1NEU1Rlx1NzUxRlx1NjU0OFx1OTE0RFx1N0Y2RVxyXG4gICAgICAgIHJlc3RhcnQ6IFsndml0ZS5jb25maWcuanMnXSxcclxuICAgICAgfSksXHJcbiAgICAgIC8vIGg1XHU3M0FGXHU1ODgzXHU1ODlFXHU1MkEwIEJVSUxEX1RJTUUgXHU1NDhDIEJVSUxEX0JSQU5DSFxyXG4gICAgICBVTklfUExBVEZPUk0gPT09ICdoNScgJiYge1xyXG4gICAgICAgIG5hbWU6ICdodG1sLXRyYW5zZm9ybScsXHJcbiAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sKGh0bWwpIHtcclxuICAgICAgICAgIHJldHVybiBodG1sLnJlcGxhY2UoJyVCVUlMRF9USU1FJScsIGRheWpzKCkuZm9ybWF0KCdZWVlZLU1NLUREIEhIOm1tOnNzJykpLnJlcGxhY2UoJyVWSVRFX0FQUF9USVRMRSUnLCBWSVRFX0FQUF9USVRMRSlcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICAvLyBcdTYyNTNcdTUzMDVcdTUyMDZcdTY3OTBcdTYzRDJcdTRFRjZcdUZGMENoNSArIFx1NzUxRlx1NEVBN1x1NzNBRlx1NTg4M1x1NjI0RFx1NUYzOVx1NTFGQVxyXG4gICAgICBVTklfUExBVEZPUk0gPT09ICdoNSdcclxuICAgICAgJiYgbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nXHJcbiAgICAgICYmIHZpc3VhbGl6ZXIoe1xyXG4gICAgICAgIGZpbGVuYW1lOiAnLi9ub2RlX21vZHVsZXMvLmNhY2hlL3Zpc3VhbGl6ZXIvc3RhdHMuaHRtbCcsXHJcbiAgICAgICAgb3BlbjogdHJ1ZSxcclxuICAgICAgICBnemlwU2l6ZTogdHJ1ZSxcclxuICAgICAgICBicm90bGlTaXplOiB0cnVlLFxyXG4gICAgICB9KSxcclxuICAgICAgLy8gXHU1MzlGXHU3NTFGXHU2M0QyXHU0RUY2XHU4RDQ0XHU2RTkwXHU1OTBEXHU1MjM2XHU2M0QyXHU0RUY2IC0gXHU0RUM1XHU1NzI4IGFwcCBcdTVFNzNcdTUzRjBcdTRFMTRcdTU0MkZcdTc1MjhcdTY1RjZcdTc1MUZcdTY1NDhcclxuICAgICAgY3JlYXRlQ29weU5hdGl2ZVJlc291cmNlc1BsdWdpbihcclxuICAgICAgICBVTklfUExBVEZPUk0gPT09ICdhcHAnICYmIFZJVEVfQ09QWV9OQVRJVkVfUkVTX0VOQUJMRSA9PT0gJ3RydWUnLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIHZlcmJvc2U6IG1vZGUgPT09ICdkZXZlbG9wbWVudCcsIC8vIFx1NUYwMFx1NTNEMVx1NkEyMVx1NUYwRlx1NjYzRVx1NzkzQVx1OEJFNlx1N0VDNlx1NjVFNVx1NUZEN1xyXG4gICAgICAgIH0sXHJcbiAgICAgICksXHJcbiAgICAgIHN5bmNNYW5pZmVzdFBsdWdpbigpLFxyXG4gICAgICAvLyBcdTgxRUFcdTUyQThcdTYyNTNcdTVGMDBcdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcdTYzRDJcdTRFRjYgKFx1NUZDNVx1OTg3Qlx1NEZFRVx1NjUzOSAuZW52IFx1NjU4N1x1NEVGNlx1NEUyRFx1NzY4NCBWSVRFX1dYX0FQUElEKVxyXG4gICAgICBvcGVuRGV2VG9vbHMoeyBtb2RlIH0pLFxyXG4gICAgXSxcclxuICAgIGRlZmluZToge1xyXG4gICAgICBfX1ZJVEVfQVBQX1BST1hZX186IEpTT04uc3RyaW5naWZ5KFZJVEVfQVBQX1BST1hZX0VOQUJMRSksXHJcbiAgICB9LFxyXG4gICAgY3NzOiB7XHJcbiAgICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcclxuICAgICAgICBzY3NzOiB7XHJcbiAgICAgICAgICBzaWxlbmNlRGVwcmVjYXRpb25zOiBbJ2xlZ2FjeS1qcy1hcGknLCAnaW1wb3J0JywgJ2dsb2JhbC1idWlsdGluJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgcG9zdGNzczoge1xyXG4gICAgICAgIHBsdWdpbnM6IFtcclxuICAgICAgICAgIC8vIGF1dG9wcmVmaXhlcih7XHJcbiAgICAgICAgICAvLyAgIC8vIFx1NjMwN1x1NUI5QVx1NzZFRVx1NjgwN1x1NkQ0Rlx1ODlDOFx1NTY2OFxyXG4gICAgICAgICAgLy8gICBvdmVycmlkZUJyb3dzZXJzbGlzdDogWyc+IDElJywgJ2xhc3QgMiB2ZXJzaW9ucyddLFxyXG4gICAgICAgICAgLy8gfSksXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcblxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIC8vIHBucG0gbW9ub3JlcG8gXHU0RTBCIFN1cGFiYXNlL0Fsb3ZhIFx1NUI1MFx1NTMwNVx1ODlFM1x1Njc5MFx1OTVFRVx1OTg5OFx1RkYwQ1x1NjM5Mlx1OTY2NFx1OTg4NFx1Njc4NFx1NUVGQVx1NzUzMSBWaXRlIFx1NkI2M1x1NUUzOFx1ODlFM1x1Njc5MFxyXG4gICAgICBleGNsdWRlOiBbJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcycsICdhbG92YScsICdAYWxvdmEvYWRhcHRlci11bmlhcHAnLCAnYWxvdmEvdnVlJ10sXHJcbiAgICB9LFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgICdAJzogcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICcuL3NyYycpLFxyXG4gICAgICAgIC8vIEBpbnRsaWZ5L3NoYXJlZCBcdTg4NjVcdTRFMDFcdUZGMUFtZXNzYWdlLWNvbXBpbGVyIFx1NjcxRlx1NjcxQiBqb2luXHVGRjBDXHU0RjQ2IHNoYXJlZCA5LjEuOSBcdTY3MkFcdTVCRkNcdTUxRkFcclxuICAgICAgICAnQGludGxpZnkvc2hhcmVkJzogcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICcuL3NyYy9saWIvaW50bGlmeS1zaGFyZWQtc2hpbS50cycpLFxyXG4gICAgICAgICdpbnRsaWZ5LXNoYXJlZC1pbnRlcm5hbCc6ICgoKSA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBwa2dEaXIgPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdAaW50bGlmeS9zaGFyZWQvcGFja2FnZS5qc29uJykpXHJcbiAgICAgICAgICAgIHJldHVybiBwYXRoLmpvaW4ocGtnRGlyLCAnZGlzdC9zaGFyZWQuZXNtLWJ1bmRsZXIuanMnKVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgY2F0Y2gge1xyXG4gICAgICAgICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICdub2RlX21vZHVsZXMvQGludGxpZnkvc2hhcmVkL2Rpc3Qvc2hhcmVkLmVzbS1idW5kbGVyLmpzJylcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KSgpLFxyXG4gICAgICAgIC8vIHBucG0gXHU0RTBCIHN1cGFiYXNlLWpzIFx1NUI1MFx1NTMwNVx1ODlFM1x1Njc5MFx1RkYxQVx1NjYzRVx1NUYwRlx1NjYyMFx1NUMwNFx1NTIzMFx1NUI5RVx1OTY0NVx1OERFRlx1NUY4NFxyXG4gICAgICAgIC4uLigoKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBhbGlhc2VzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cclxuICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBbJ2Z1bmN0aW9ucy1qcycsICdwb3N0Z3Jlc3QtanMnLCAncmVhbHRpbWUtanMnLCAnc3RvcmFnZS1qcycsICdhdXRoLWpzJ10pIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBhbGlhc2VzW2BAc3VwYWJhc2UvJHtuYW1lfWBdID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZShgQHN1cGFiYXNlLyR7bmFtZX0vcGFja2FnZS5qc29uYCkpXHJcbiAgICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAgIC8vIFx1NTMwNVx1NjcyQVx1NUI4OVx1ODhDNVx1NjVGNlx1OERGM1x1OEZDN1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gYWxpYXNlc1xyXG4gICAgICAgIH0pKCksXHJcbiAgICAgICAgJ0BpbWcnOiBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJy4vc3JjL3N0YXRpYy9pbWFnZXMnKSxcclxuICAgICAgICAnQGZhc2hpb24tcmVjL3NoYXJlZC9pMThuJzogcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICcuLi9zaGFyZWQvc3JjL2kxOG4vaW5kZXgudHMnKSxcclxuICAgICAgICAnQGZhc2hpb24tcmVjL3NoYXJlZC9hcGkvY2xpZW50JzogcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICcuLi9zaGFyZWQvc3JjL2FwaS9jbGllbnQudHMnKSxcclxuICAgICAgICAnQGZhc2hpb24tcmVjL3NoYXJlZC9hcGkvY29uZmlnJzogcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICcuLi9zaGFyZWQvc3JjL2FwaS9jb25maWcudHMnKSxcclxuICAgICAgICAnQGZhc2hpb24tcmVjL3NoYXJlZCc6IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAnLi4vc2hhcmVkL3NyYy9pbmRleC50cycpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBob3N0OiAnMC4wLjAuMCcsXHJcbiAgICAgIGhtcjogdHJ1ZSxcclxuICAgICAgcG9ydDogTnVtYmVyLnBhcnNlSW50KFZJVEVfQVBQX1BPUlQsIDEwKSxcclxuICAgICAgZnM6IHsgYWxsb3c6IFtwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgJy4uJyldIH0sXHJcbiAgICAgIC8vIFx1NEVDNSBINSBcdTdBRUZcdTc1MUZcdTY1NDhcdUZGMENcdTUxNzZcdTRFRDZcdTdBRUZcdTRFMERcdTc1MUZcdTY1NDhcdUZGMDhcdTUxNzZcdTRFRDZcdTdBRUZcdThENzBidWlsZFx1RkYwQ1x1NEUwRFx1OEQ3MGRldlNlcnZlcilcclxuICAgICAgcHJveHk6IEpTT04ucGFyc2UoVklURV9BUFBfUFJPWFlfRU5BQkxFKVxyXG4gICAgICAgID8ge1xyXG4gICAgICAgICAgICBbVklURV9BUFBfUFJPWFlfUFJFRklYXToge1xyXG4gICAgICAgICAgICAgIHRhcmdldDogVklURV9TRVJWRVJfQkFTRVVSTCxcclxuICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgLy8gXHU1NDBFXHU3QUVGXHU2NzA5L2FwaVx1NTI0RFx1N0YwMFx1NTIxOVx1NEUwRFx1NTA1QVx1NTkwNFx1NzQwNlx1RkYwQ1x1NkNBMVx1NjcwOVx1NTIxOVx1OTcwMFx1ODk4MVx1NTNCQlx1NjM4OVxyXG4gICAgICAgICAgICAgIHJld3JpdGU6IHBhdGggPT4gcGF0aC5yZXBsYWNlKG5ldyBSZWdFeHAoYF4ke1ZJVEVfQVBQX1BST1hZX1BSRUZJWH1gKSwgJycpLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIDogdW5kZWZpbmVkLFxyXG4gICAgfSxcclxuICAgIGVzYnVpbGQ6IHtcclxuICAgICAgZHJvcDogVklURV9ERUxFVEVfQ09OU09MRSA9PT0gJ3RydWUnID8gWydjb25zb2xlJywgJ2RlYnVnZ2VyJ10gOiBbXSxcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBzb3VyY2VtYXA6IGZhbHNlLFxyXG4gICAgICAvLyBcdTY1QjlcdTRGQkZcdTk3NUVoNVx1N0FFRlx1OEMwM1x1OEJENVxyXG4gICAgICAvLyBzb3VyY2VtYXA6IFZJVEVfU0hPV19TT1VSQ0VNQVAgPT09ICd0cnVlJywgLy8gXHU5RUQ4XHU4QkE0XHU2NjJGZmFsc2VcclxuICAgICAgdGFyZ2V0OiAnZXM2JyxcclxuICAgICAgLy8gXHU1RjAwXHU1M0QxXHU3M0FGXHU1ODgzXHU0RTBEXHU3NTI4XHU1MzhCXHU3RjI5XHJcbiAgICAgIG1pbmlmeTogbW9kZSA9PT0gJ2RldmVsb3BtZW50JyA/IGZhbHNlIDogJ2VzYnVpbGQnLFxyXG4gICAgfSxcclxuICB9KVxyXG59KVxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXHNvdXJjZV9jb2RlXFxcXGZhc2hpb25cXFxcZmFzaGlvbl9yZWNcXFxcdW5pYXBwLXYyXFxcXHNjcmlwdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHNvdXJjZV9jb2RlXFxcXGZhc2hpb25cXFxcZmFzaGlvbl9yZWNcXFxcdW5pYXBwLXYyXFxcXHNjcmlwdHNcXFxcb3Blbi1kZXYtdG9vbHMuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L3NvdXJjZV9jb2RlL2Zhc2hpb24vZmFzaGlvbl9yZWMvdW5pYXBwLXYyL3NjcmlwdHMvb3Blbi1kZXYtdG9vbHMuanNcIjtpbXBvcnQgeyBleGVjIH0gZnJvbSAnbm9kZTpjaGlsZF9wcm9jZXNzJ1xyXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcydcclxuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xyXG5pbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnXHJcblxyXG4vKipcclxuICogXHU2MjUzXHU1RjAwXHU1RjAwXHU1M0QxXHU4MDA1XHU1REU1XHU1MTc3XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbnYgLSBcdTczQUZcdTU4ODNcdUZGMEMnZGV2JyBcdTYyMTYgJ2J1aWxkJ1xyXG4gKi9cclxuZnVuY3Rpb24gX29wZW5EZXZUb29scyhlbnYgPSAnZGV2Jykge1xyXG4gIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybSAvLyBkYXJ3aW4sIHdpbjMyLCBsaW51eFxyXG4gIGNvbnN0IHsgVU5JX1BMQVRGT1JNIH0gPSBwcm9jZXNzLmVudiAvLyAgbXAtd2VpeGluLCBtcC1hbGlwYXlcclxuXHJcbiAgY29uc3QgdW5pUGxhdGZvcm1UZXh0ID0gVU5JX1BMQVRGT1JNID09PSAnbXAtd2VpeGluJyA/ICdcdTVGQUVcdTRGRTFcdTVDMEZcdTdBMEJcdTVFOEYnIDogVU5JX1BMQVRGT1JNID09PSAnbXAtYWxpcGF5JyA/ICdcdTY1MkZcdTRFRDhcdTVCOURcdTVDMEZcdTdBMEJcdTVFOEYnIDogJ1x1NUMwRlx1N0EwQlx1NUU4RidcclxuXHJcbiAgLy8gXHU5ODc5XHU3NkVFXHU4REVGXHU1Rjg0XHVGRjA4XHU2Nzg0XHU1RUZBXHU4RjkzXHU1MUZBXHU3NkVFXHU1RjU1XHVGRjA5XHVGRjBDXHU2ODM5XHU2MzZFXHU3M0FGXHU1ODgzXHU5MDA5XHU2MkU5XHU0RTBEXHU1NDBDXHU3NkVFXHU1RjU1XHJcbiAgY29uc3Qgb3V0cHV0RGlyID0gZW52ID09PSAnYnVpbGQnID8gYGRpc3QvYnVpbGQvJHtVTklfUExBVEZPUk19YCA6IGBkaXN0L2Rldi8ke1VOSV9QTEFURk9STX1gXHJcbiAgY29uc3QgcHJvamVjdFBhdGggPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgb3V0cHV0RGlyKVxyXG5cclxuICAvLyBcdTY4QzBcdTY3RTVcdTY3ODRcdTVFRkFcdThGOTNcdTUxRkFcdTc2RUVcdTVGNTVcdTY2MkZcdTU0MjZcdTVCNThcdTU3MjhcclxuICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdFBhdGgpKSB7XHJcbiAgICBjb25zb2xlLmxvZyhgXHUyNzRDICR7dW5pUGxhdGZvcm1UZXh0fVx1Njc4NFx1NUVGQVx1NzZFRVx1NUY1NVx1NEUwRFx1NUI1OFx1NTcyODpgLCBwcm9qZWN0UGF0aClcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgY29uc29sZS5sb2coYFx1RDgzRFx1REU4MCBcdTZCNjNcdTU3MjhcdTYyNTNcdTVGMDAke3VuaVBsYXRmb3JtVGV4dH1cdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzcuLi5gKVxyXG5cclxuICAvLyBcdTY4MzlcdTYzNkVcdTRFMERcdTU0MENcdTY0Q0RcdTRGNUNcdTdDRkJcdTdFREZcdTYyNjdcdTg4NENcdTRFMERcdTU0MENcdTU0N0RcdTRFRTRcclxuICBsZXQgY29tbWFuZCA9ICcnXHJcblxyXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcclxuICAgIC8vIG1hY09TXHJcbiAgICBpZiAoVU5JX1BMQVRGT1JNID09PSAnbXAtd2VpeGluJykge1xyXG4gICAgICBjb21tYW5kID0gYC9BcHBsaWNhdGlvbnMvd2VjaGF0d2ViZGV2dG9vbHMuYXBwL0NvbnRlbnRzL01hY09TL2NsaSAtbyBcIiR7cHJvamVjdFBhdGh9XCJgXHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChVTklfUExBVEZPUk0gPT09ICdtcC1hbGlwYXknKSB7XHJcbiAgICAgIGNvbW1hbmQgPSBgL0FwcGxpY2F0aW9ucy9cdTVDMEZcdTdBMEJcdTVFOEZcdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzcuYXBwL0NvbnRlbnRzL01hY09TL1x1NUMwRlx1N0EwQlx1NUU4Rlx1NUYwMFx1NTNEMVx1ODAwNVx1NURFNVx1NTE3NyAtLXAgXCIke3Byb2plY3RQYXRofVwiYFxyXG4gICAgfVxyXG4gIH1cclxuICBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJyB8fCBwbGF0Zm9ybSA9PT0gJ3dpbjY0Jykge1xyXG4gICAgLy8gV2luZG93c1xyXG4gICAgaWYgKFVOSV9QTEFURk9STSA9PT0gJ21wLXdlaXhpbicpIHtcclxuICAgICAgY29tbWFuZCA9IGBcIkM6XFxcXFByb2dyYW0gRmlsZXMgKHg4NilcXFxcVGVuY2VudFxcXFxcdTVGQUVcdTRGRTF3ZWJcdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcXFxcY2xpLmJhdFwiIC1vIFwiJHtwcm9qZWN0UGF0aH1cImBcclxuICAgIH1cclxuICB9XHJcbiAgZWxzZSB7XHJcbiAgICAvLyBMaW51eCBcdTYyMTZcdTUxNzZcdTRFRDZcdTdDRkJcdTdFREZcclxuICAgIGNvbnNvbGUubG9nKCdcdTI3NEMgXHU1RjUzXHU1MjREXHU3Q0ZCXHU3RURGXHU0RTBEXHU2NTJGXHU2MzAxXHU4MUVBXHU1MkE4XHU2MjUzXHU1RjAwXHU1RkFFXHU0RkUxXHU1RjAwXHU1M0QxXHU4MDA1XHU1REU1XHU1MTc3JylcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XHJcbiAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5sb2coYFx1Mjc0QyBcdTYyNTNcdTVGMDAke3VuaVBsYXRmb3JtVGV4dH1cdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcdTU5MzFcdThEMjU6YCwgZXJyb3IubWVzc2FnZSlcclxuICAgICAgY29uc29sZS5sb2coYFx1RDgzRFx1RENBMSBcdThCRjdcdTc4NkVcdTRGREQke3VuaVBsYXRmb3JtVGV4dH1cdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcdTY3MERcdTUyQTFcdTdBRUZcdTUzRTNcdTVERjJcdTU0MkZcdTc1MjhgKVxyXG4gICAgICBjb25zb2xlLmxvZyhgXHVEODNEXHVEQ0ExIFx1NTNFRlx1NEVFNVx1NjI0Qlx1NTJBOFx1NjI1M1x1NUYwMCR7dW5pUGxhdGZvcm1UZXh0fVx1NUYwMFx1NTNEMVx1ODAwNVx1NURFNVx1NTE3N1x1NUU3Nlx1NUJGQ1x1NTE2NVx1OTg3OVx1NzZFRTpgLCBwcm9qZWN0UGF0aClcclxuICAgICAgcmV0dXJuXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHN0ZGVycikge1xyXG4gICAgICBjb25zb2xlLmxvZygnXHUyNkEwXHVGRTBGIFx1OEI2Nlx1NTQ0QTonLCBzdGRlcnIpXHJcbiAgICB9XHJcblxyXG4gICAgY29uc29sZS5sb2coYFx1MjcwNSAke3VuaVBsYXRmb3JtVGV4dH1cdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcdTVERjJcdTYyNTNcdTVGMDBgKVxyXG5cclxuICAgIGlmIChzdGRvdXQpIHtcclxuICAgICAgY29uc29sZS5sb2coc3Rkb3V0KVxyXG4gICAgfVxyXG4gIH0pXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBcdTUyMUJcdTVFRkEgVml0ZSBcdTYzRDJcdTRFRjZcdUZGMENcdTc1MjhcdTRFOEVcdTgxRUFcdTUyQThcdTYyNTNcdTVGMDBcdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcclxuICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBcdTkxNERcdTdGNkVcdTkwMDlcdTk4NzlcclxuICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMubW9kZSAtIFx1Njc4NFx1NUVGQVx1NkEyMVx1NUYwRlx1RkYwQydkZXZlbG9wbWVudCcgXHU2MjE2ICdwcm9kdWN0aW9uJ1xyXG4gKi9cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gb3BlbkRldlRvb2xzKG9wdGlvbnMgPSB7fSkge1xyXG4gIGNvbnN0IHsgbW9kZSA9ICdkZXZlbG9wbWVudCcgfSA9IG9wdGlvbnNcclxuICAvLyBcdTY4MzlcdTYzNkUgbW9kZSBcdTc4NkVcdTVCOUFcdTczQUZcdTU4ODNcdUZGMUFkZXZlbG9wbWVudCAtPiBkZXYsIHByb2R1Y3Rpb24gLT4gYnVpbGRcclxuICBjb25zdCBlbnYgPSBtb2RlID09PSAncHJvZHVjdGlvbicgPyAnYnVpbGQnIDogJ2RldidcclxuXHJcbiAgLy8gXHU5OTk2XHU2QjIxXHU2Nzg0XHU1RUZBXHU2ODA3XHU4QkIwXHJcbiAgbGV0IGlzRmlyc3RCdWlsZCA9IHRydWVcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6ICd1bmktZGV2dG9vbHMnLFxyXG4gICAgd3JpdGVCdW5kbGUoKSB7XHJcbiAgICAgIGlmIChpc0ZpcnN0QnVpbGQgJiYgcHJvY2Vzcy5lbnYuVU5JX1BMQVRGT1JNPy5pbmNsdWRlcygnbXAnKSkge1xyXG4gICAgICAgIGlzRmlyc3RCdWlsZCA9IGZhbHNlXHJcbiAgICAgICAgX29wZW5EZXZUb29scyhlbnYpXHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgfVxyXG59XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcc291cmNlX2NvZGVcXFxcZmFzaGlvblxcXFxmYXNoaW9uX3JlY1xcXFx1bmlhcHAtdjJcXFxcdml0ZS1wbHVnaW5zXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxzb3VyY2VfY29kZVxcXFxmYXNoaW9uXFxcXGZhc2hpb25fcmVjXFxcXHVuaWFwcC12MlxcXFx2aXRlLXBsdWdpbnNcXFxcY29weS1uYXRpdmUtcmVzb3VyY2VzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9zb3VyY2VfY29kZS9mYXNoaW9uL2Zhc2hpb25fcmVjL3VuaWFwcC12Mi92aXRlLXBsdWdpbnMvY29weS1uYXRpdmUtcmVzb3VyY2VzLnRzXCI7aW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcydcclxuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xyXG5pbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnXHJcblxyXG4vKipcclxuICogXHU1MzlGXHU3NTFGXHU2M0QyXHU0RUY2XHU4RDQ0XHU2RTkwXHU1OTBEXHU1MjM2XHU5MTREXHU3RjZFXHU2M0E1XHU1M0UzXHJcbiAqXHJcbiAqIFx1NjgzOVx1NjM2RSBVbmlBcHAgXHU1Qjk4XHU2NUI5XHU2NTg3XHU2ODYzXHVGRjFBaHR0cHM6Ly91bmlhcHAuZGNsb3VkLm5ldC5jbi9wbHVnaW4vbmF0aXZlLXBsdWdpbi5odG1sIyVFNiU5QyVBQyVFNSU5QyVCMCVFNiU4RiU5MiVFNCVCQiVCNi0lRTklOUQlOUUlRTUlODYlODUlRTclQkQlQUUlRTUlOEUlOUYlRTclOTQlOUYlRTYlOEYlOTIlRTQlQkIlQjZcclxuICogXHU2NzJDXHU1NzMwXHU2M0QyXHU0RUY2XHU1RTk0XHU4QkU1XHU1QjU4XHU1MEE4XHU1NzI4XHU5ODc5XHU3NkVFXHU2ODM5XHU3NkVFXHU1RjU1XHU3Njg0IG5hdGl2ZXBsdWdpbnMgXHU3NkVFXHU1RjU1XHU0RTBCXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIENvcHlOYXRpdmVSZXNvdXJjZXNPcHRpb25zIHtcclxuICAvKiogXHU2NjJGXHU1NDI2XHU1NDJGXHU3NTI4XHU2M0QyXHU0RUY2ICovXHJcbiAgZW5hYmxlPzogYm9vbGVhblxyXG4gIC8qKlxyXG4gICAqIFx1NkU5MFx1NzZFRVx1NUY1NVx1OERFRlx1NUY4NFx1RkYwQ1x1NzZGOFx1NUJGOVx1NEU4RVx1OTg3OVx1NzZFRVx1NjgzOVx1NzZFRVx1NUY1NVxyXG4gICAqIFx1OUVEOFx1OEJBNFx1NEUzQSAnbmF0aXZlcGx1Z2lucydcdUZGMENcdTdCMjZcdTU0MDggVW5pQXBwIFx1NUI5OFx1NjVCOVx1ODlDNFx1ODMwM1xyXG4gICAqIEBzZWUgaHR0cHM6Ly91bmlhcHAuZGNsb3VkLm5ldC5jbi9wbHVnaW4vbmF0aXZlLXBsdWdpbi5odG1sIyVFNiU5QyVBQyVFNSU5QyVCMCVFNiU4RiU5MiVFNCVCQiVCNi0lRTklOUQlOUUlRTUlODYlODUlRTclQkQlQUUlRTUlOEUlOUYlRTclOTQlOUYlRTYlOEYlOTIlRTQlQkIlQjZcclxuICAgKi9cclxuICBzb3VyY2VEaXI/OiBzdHJpbmdcclxuICAvKipcclxuICAgKiBcdTc2RUVcdTY4MDdcdTc2RUVcdTVGNTVcdTU0MERcdTc5RjBcdUZGMENcdTY3ODRcdTVFRkFcdTU0MEVcdTU3MjggZGlzdCBcdTc2RUVcdTVGNTVcdTRFMkRcdTc2ODRcdTY1ODdcdTRFRjZcdTU5MzlcdTU0MERcclxuICAgKiBcdTlFRDhcdThCQTRcdTRFM0EgJ25hdGl2ZXBsdWdpbnMnXHVGRjBDXHU0RTBFXHU2RTkwXHU3NkVFXHU1RjU1XHU0RkREXHU2MzAxXHU0RTAwXHU4MUY0XHJcbiAgICovXHJcbiAgdGFyZ2V0RGlyTmFtZT86IHN0cmluZ1xyXG4gIC8qKiBcdTY2MkZcdTU0MjZcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdUZGMENcdTRGQkZcdTRFOEVcdThDMDNcdThCRDVcdTU0OENcdTc2RDFcdTYzQTdcdTU5MERcdTUyMzZcdThGQzdcdTdBMEIgKi9cclxuICB2ZXJib3NlPzogYm9vbGVhblxyXG4gIC8qKiBcdTgxRUFcdTVCOUFcdTRFNDlcdTY1RTVcdTVGRDdcdTUyNERcdTdGMDBcdUZGMENcdTc1MjhcdTRFOEVcdTUzM0FcdTUyMDZcdTRFMERcdTU0MENcdTYzRDJcdTRFRjZcdTc2ODRcdTY1RTVcdTVGRDdcdThGOTNcdTUxRkEgKi9cclxuICBsb2dQcmVmaXg/OiBzdHJpbmdcclxufVxyXG5cclxuLyoqXHJcbiAqIFx1OUVEOFx1OEJBNFx1OTE0RFx1N0Y2RVxyXG4gKlxyXG4gKiBcdTY4MzlcdTYzNkUgVW5pQXBwIFx1NUI5OFx1NjVCOVx1NjU4N1x1Njg2M1x1ODlDNFx1ODMwM1x1OEJCRVx1N0Y2RVx1OUVEOFx1OEJBNFx1NTAzQ1x1RkYxQVxyXG4gKiAtIHNvdXJjZURpcjogJ25hdGl2ZXBsdWdpbnMnIC0gXHU3QjI2XHU1NDA4XHU1Qjk4XHU2NUI5XHU2NzJDXHU1NzMwXHU2M0QyXHU0RUY2XHU1QjU4XHU1MEE4XHU4OUM0XHU4MzAzXHJcbiAqIC0gdGFyZ2V0RGlyTmFtZTogJ25hdGl2ZXBsdWdpbnMnIC0gXHU2Nzg0XHU1RUZBXHU1NDBFXHU0RkREXHU2MzAxXHU3NkY4XHU1NDBDXHU3Njg0XHU3NkVFXHU1RjU1XHU3RUQzXHU2Nzg0XHJcbiAqL1xyXG5jb25zdCBERUZBVUxUX09QVElPTlM6IFJlcXVpcmVkPENvcHlOYXRpdmVSZXNvdXJjZXNPcHRpb25zPiA9IHtcclxuICBlbmFibGU6IHRydWUsXHJcbiAgc291cmNlRGlyOiAnbmF0aXZlcGx1Z2lucycsXHJcbiAgdGFyZ2V0RGlyTmFtZTogJ25hdGl2ZXBsdWdpbnMnLFxyXG4gIHZlcmJvc2U6IHRydWUsXHJcbiAgbG9nUHJlZml4OiAnW2NvcHktbmF0aXZlLXJlc291cmNlc10nLFxyXG59XHJcblxyXG4vKipcclxuICogVW5pQXBwIFx1NTM5Rlx1NzUxRlx1NjNEMlx1NEVGNlx1OEQ0NFx1NkU5MFx1NTkwRFx1NTIzNlx1NjNEMlx1NEVGNlxyXG4gKlxyXG4gKiBcdTUyOUZcdTgwRkRcdThCRjRcdTY2MEVcdUZGMUFcclxuICogMS4gXHU4OUUzXHU1MUIzIFVuaUFwcCBcdTRGN0ZcdTc1MjhcdTY3MkNcdTU3MzBcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdTY1RjZcdUZGMENcdTYyNTNcdTUzMDVcdTU0MEVcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdThENDRcdTZFOTBcdTYyN0VcdTRFMERcdTUyMzBcdTc2ODRcdTk1RUVcdTk4OThcclxuICogMi4gXHU1QzA2XHU5ODc5XHU3NkVFXHU2ODM5XHU3NkVFXHU1RjU1XHU0RTBCXHU3Njg0IG5hdGl2ZXBsdWdpbnMgXHU3NkVFXHU1RjU1XHU1OTBEXHU1MjM2XHU1MjMwXHU2Nzg0XHU1RUZBXHU4RjkzXHU1MUZBXHU3NkVFXHU1RjU1XHU0RTJEXHJcbiAqIDMuIFx1NjUyRlx1NjMwMSBBbmRyb2lkIFx1NTQ4QyBpT1MgXHU1RTczXHU1M0YwXHU3Njg0XHU1MzlGXHU3NTFGXHU2M0QyXHU0RUY2XHU4RDQ0XHU2RTkwXHU1OTBEXHU1MjM2XHJcbiAqIDQuIFx1NEVDNVx1NTcyOCBhcHAgXHU1RTczXHU1M0YwXHU2Nzg0XHU1RUZBXHU2NUY2XHU3NTFGXHU2NTQ4XHVGRjBDXHU1MTc2XHU0RUQ2XHU1RTczXHU1M0YwXHVGRjA4SDVcdTMwMDFcdTVDMEZcdTdBMEJcdTVFOEZcdUZGMDlcdTRFMERcdTYyNjdcdTg4NENcclxuICpcclxuICogXHU0RjdGXHU3NTI4XHU1NzNBXHU2NjZGXHVGRjFBXHJcbiAqIC0gXHU0RjdGXHU3NTI4XHU0RTg2IFVuaUFwcCBcdTY3MkNcdTU3MzBcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdUZGMDhcdTk3NUVcdTRFOTFcdTdBRUZcdTYzRDJcdTRFRjZcdUZGMDlcclxuICogLSBcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdTUzMDVcdTU0MkJcdTk4OURcdTU5MTZcdTc2ODRcdThENDRcdTZFOTBcdTY1ODdcdTRFRjZcdUZGMDhcdTU5ODIgLnNvIFx1NUU5M1x1NjU4N1x1NEVGNlx1MzAwMVx1OTE0RFx1N0Y2RVx1NjU4N1x1NEVGNlx1N0I0OVx1RkYwOVxyXG4gKiAtIFx1OTcwMFx1ODk4MVx1NTcyOFx1NjI1M1x1NTMwNVx1NTQwRVx1NEZERFx1NjMwMVx1NTM5Rlx1NzUxRlx1NjNEMlx1NEVGNlx1NzY4NFx1NUI4Q1x1NjU3NFx1NzZFRVx1NUY1NVx1N0VEM1x1Njc4NFxyXG4gKlxyXG4gKiBcdTVCOThcdTY1QjlcdTY1ODdcdTY4NjNcdTUzQzJcdTgwMDNcdUZGMUFcclxuICogQHNlZSBodHRwczovL3VuaWFwcC5kY2xvdWQubmV0LmNuL3BsdWdpbi9uYXRpdmUtcGx1Z2luLmh0bWwjJUU2JTlDJUFDJUU1JTlDJUIwJUU2JThGJTkyJUU0JUJCJUI2LSVFOSU5RCU5RSVFNSU4NiU4NSVFNyVCRCVBRSVFNSU4RSU5RiVFNyU5NCU5RiVFNiU4RiU5MiVFNCVCQiVCNlxyXG4gKiBAc2VlIGh0dHBzOi8vdW5pYXBwLmRjbG91ZC5uZXQuY24vdHV0b3JpYWwvbnZ1ZS1hcGkuaHRtbCNkb21cclxuICpcclxuICogQHBhcmFtIG9wdGlvbnMgXHU2M0QyXHU0RUY2XHU5MTREXHU3RjZFXHU5MDA5XHU5ODc5XHJcbiAqIEByZXR1cm5zIFZpdGUgXHU2M0QyXHU0RUY2XHU1QkY5XHU4QzYxXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29weU5hdGl2ZVJlc291cmNlcyhvcHRpb25zOiBDb3B5TmF0aXZlUmVzb3VyY2VzT3B0aW9ucyA9IHt9KTogUGx1Z2luIHtcclxuICBjb25zdCBjb25maWcgPSB7IC4uLkRFRkFVTFRfT1BUSU9OUywgLi4ub3B0aW9ucyB9XHJcblxyXG4gIC8vIFx1NTk4Mlx1Njc5Q1x1NjNEMlx1NEVGNlx1ODhBQlx1Nzk4MVx1NzUyOFx1RkYwQ1x1OEZENFx1NTZERVx1NEUwMFx1NEUyQVx1N0E3QVx1NjNEMlx1NEVGNlxyXG4gIGlmICghY29uZmlnLmVuYWJsZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgbmFtZTogJ2NvcHktbmF0aXZlLXJlc291cmNlcy1kaXNhYmxlZCcsXHJcbiAgICAgIGFwcGx5OiAnYnVpbGQnLFxyXG4gICAgICB3cml0ZUJ1bmRsZSgpIHtcclxuICAgICAgICAvLyBcdTYzRDJcdTRFRjZcdTVERjJcdTc5ODFcdTc1MjhcdUZGMENcdTRFMERcdTYyNjdcdTg4NENcdTRFRkJcdTRGNTVcdTY0Q0RcdTRGNUNcclxuICAgICAgfSxcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAnY29weS1uYXRpdmUtcmVzb3VyY2VzJyxcclxuICAgIGFwcGx5OiAnYnVpbGQnLCAvLyBcdTUzRUFcdTU3MjhcdTY3ODRcdTVFRkFcdTY1RjZcdTVFOTRcdTc1MjhcclxuICAgIGVuZm9yY2U6ICdwb3N0JywgLy8gXHU1NzI4XHU1MTc2XHU0RUQ2XHU2M0QyXHU0RUY2XHU2MjY3XHU4ODRDXHU1QjhDXHU2QkQ1XHU1NDBFXHU2MjY3XHU4ODRDXHJcblxyXG4gICAgYXN5bmMgd3JpdGVCdW5kbGUoKSB7XHJcbiAgICAgIGNvbnN0IHsgc291cmNlRGlyLCB0YXJnZXREaXJOYW1lLCB2ZXJib3NlLCBsb2dQcmVmaXggfSA9IGNvbmZpZ1xyXG5cclxuICAgICAgdHJ5IHtcclxuICAgICAgICAvLyBcdTgzQjdcdTUzRDZcdTk4NzlcdTc2RUVcdTY4MzlcdTc2RUVcdTVGNTVcdThERUZcdTVGODRcclxuICAgICAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHByb2Nlc3MuY3dkKClcclxuXHJcbiAgICAgICAgLy8gXHU2Nzg0XHU1RUZBXHU2RTkwXHU3NkVFXHU1RjU1XHU3RUREXHU1QkY5XHU4REVGXHU1Rjg0XHVGRjA4XHU5ODc5XHU3NkVFXHU2ODM5XHU3NkVFXHU1RjU1XHU0RTBCXHU3Njg0IG5hdGl2ZXBsdWdpbnMgXHU3NkVFXHU1RjU1XHVGRjA5XHJcbiAgICAgICAgY29uc3Qgc291cmNlUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0Um9vdCwgc291cmNlRGlyKVxyXG5cclxuICAgICAgICAvLyBcdTY3ODRcdTVFRkFcdTc2RUVcdTY4MDdcdThERUZcdTVGODRcdUZGMUFkaXN0L1tidWlsZHxkZXZdL1twbGF0Zm9ybV0vbmF0aXZlcGx1Z2luc1xyXG4gICAgICAgIC8vIGJ1aWxkTW9kZTogJ2J1aWxkJyAoXHU3NTFGXHU0RUE3XHU3M0FGXHU1ODgzKSBcdTYyMTYgJ2RldicgKFx1NUYwMFx1NTNEMVx1NzNBRlx1NTg4MylcclxuICAgICAgICAvLyBwbGF0Zm9ybTogJ2FwcCcgKEFwcFx1NUU3M1x1NTNGMCkgXHU2MjE2XHU1MTc2XHU0RUQ2XHU1RTczXHU1M0YwXHU2ODA3XHU4QkM2XHJcbiAgICAgICAgY29uc3QgYnVpbGRNb2RlID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJyA/ICdidWlsZCcgOiAnZGV2J1xyXG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5lbnYuVU5JX1BMQVRGT1JNIHx8ICdhcHAnXHJcbiAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHBhdGgucmVzb2x2ZShcclxuICAgICAgICAgIHByb2plY3RSb290LFxyXG4gICAgICAgICAgJ2Rpc3QnLFxyXG4gICAgICAgICAgYnVpbGRNb2RlLFxyXG4gICAgICAgICAgcGxhdGZvcm0sXHJcbiAgICAgICAgICB0YXJnZXREaXJOYW1lLFxyXG4gICAgICAgIClcclxuXHJcbiAgICAgICAgLy8gXHU2OEMwXHU2N0U1XHU2RTkwXHU3NkVFXHU1RjU1XHU2NjJGXHU1NDI2XHU1QjU4XHU1NzI4XHJcbiAgICAgICAgLy8gXHU1OTgyXHU2NzlDXHU0RTBEXHU1QjU4XHU1NzI4IG5hdGl2ZXBsdWdpbnMgXHU3NkVFXHU1RjU1XHVGRjBDXHU4QkY0XHU2NjBFXHU5ODc5XHU3NkVFXHU2Q0ExXHU2NzA5XHU0RjdGXHU3NTI4XHU2NzJDXHU1NzMwXHU1MzlGXHU3NTFGXHU2M0QyXHU0RUY2XHJcbiAgICAgICAgY29uc3Qgc291cmNlRXhpc3RzID0gZnMuZXhpc3RzU3luYyhzb3VyY2VQYXRoKVxyXG4gICAgICAgIGlmICghc291cmNlRXhpc3RzKSB7XHJcbiAgICAgICAgICBpZiAodmVyYm9zZSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdTZFOTBcdTc2RUVcdTVGNTVcdTRFMERcdTVCNThcdTU3MjhcdUZGMENcdThERjNcdThGQzdcdTU5MERcdTUyMzZcdTY0Q0RcdTRGNUNgKVxyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdTZFOTBcdTc2RUVcdTVGNTVcdThERUZcdTVGODQ6ICR7c291cmNlUGF0aH1gKVxyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdTU5ODJcdTk3MDBcdTRGN0ZcdTc1MjhcdTY3MkNcdTU3MzBcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdUZGMENcdThCRjdcdTU3MjhcdTk4NzlcdTc2RUVcdTY4MzlcdTc2RUVcdTVGNTVcdTUyMUJcdTVFRkEgbmF0aXZlcGx1Z2lucyBcdTc2RUVcdTVGNTVgKVxyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdTVFNzZcdTYzMDlcdTcxNjdcdTVCOThcdTY1QjlcdTY1ODdcdTY4NjNcdTY1M0VcdTUxNjVcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdTY1ODdcdTRFRjZgKVxyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdTUzQzJcdTgwMDM6IGh0dHBzOi8vdW5pYXBwLmRjbG91ZC5uZXQuY24vcGx1Z2luL25hdGl2ZS1wbHVnaW4uaHRtbGApXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm5cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFx1NjhDMFx1NjdFNVx1NkU5MFx1NzZFRVx1NUY1NVx1NjYyRlx1NTQyNlx1NEUzQVx1N0E3QVxyXG4gICAgICAgIC8vIFx1NTk4Mlx1Njc5Q1x1NzZFRVx1NUY1NVx1NUI1OFx1NTcyOFx1NEY0Nlx1NEUzQVx1N0E3QVx1RkYwQ1x1NEU1Rlx1OERGM1x1OEZDN1x1NTkwRFx1NTIzNlx1NjRDRFx1NEY1Q1xyXG4gICAgICAgIGNvbnN0IHNvdXJjZUZpbGVzID0gZnMucmVhZGRpclN5bmMoc291cmNlUGF0aClcclxuICAgICAgICBpZiAoc291cmNlRmlsZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICBpZiAodmVyYm9zZSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdTZFOTBcdTc2RUVcdTVGNTVcdTRFM0FcdTdBN0FcdUZGMENcdThERjNcdThGQzdcdTU5MERcdTUyMzZcdTY0Q0RcdTRGNUNgKVxyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdTZFOTBcdTc2RUVcdTVGNTVcdThERUZcdTVGODQ6ICR7c291cmNlUGF0aH1gKVxyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7bG9nUHJlZml4fSBcdThCRjdcdTU3MjggbmF0aXZlcGx1Z2lucyBcdTc2RUVcdTVGNTVcdTRFMkRcdTY1M0VcdTUxNjVcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdTY1ODdcdTRFRjZgKVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBcdTc4NkVcdTRGRERcdTc2RUVcdTY4MDdcdTc2RUVcdTVGNTVcdTUzQ0FcdTUxNzZcdTcyMzZcdTc2RUVcdTVGNTVcdTVCNThcdTU3MjhcclxuICAgICAgICBmcy5ta2RpclN5bmModGFyZ2V0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSlcclxuXHJcbiAgICAgICAgaWYgKHZlcmJvc2UpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGAke2xvZ1ByZWZpeH0gXHU1RjAwXHU1OUNCXHU1OTBEXHU1MjM2IFVuaUFwcCBcdTY3MkNcdTU3MzBcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjYuLi5gKVxyXG4gICAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBcdTZFOTBcdTc2RUVcdTVGNTU6ICR7c291cmNlUGF0aH1gKVxyXG4gICAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBcdTc2RUVcdTY4MDdcdTc2RUVcdTVGNTU6ICR7dGFyZ2V0UGF0aH1gKVxyXG4gICAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBcdTY3ODRcdTVFRkFcdTZBMjFcdTVGMEY6ICR7YnVpbGRNb2RlfWApXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IFx1NzZFRVx1NjgwN1x1NUU3M1x1NTNGMDogJHtwbGF0Zm9ybX1gKVxyXG4gICAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBcdTUzRDFcdTczQjAgJHtzb3VyY2VGaWxlcy5sZW5ndGh9IFx1NEUyQVx1NTM5Rlx1NzUxRlx1NjNEMlx1NEVGNlx1NjU4N1x1NEVGNi9cdTc2RUVcdTVGNTVgKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gXHU2MjY3XHU4ODRDXHU2NTg3XHU0RUY2XHU1OTBEXHU1MjM2XHU2NENEXHU0RjVDXHJcbiAgICAgICAgLy8gXHU1QzA2XHU2NTc0XHU0RTJBIG5hdGl2ZXBsdWdpbnMgXHU3NkVFXHU1RjU1XHU1OTBEXHU1MjM2XHU1MjMwXHU2Nzg0XHU1RUZBXHU4RjkzXHU1MUZBXHU3NkVFXHU1RjU1XHJcbiAgICAgICAgY29uc3QgY29weURpciA9IChzcmM6IHN0cmluZywgZGVzdDogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBzdCA9IGZzLnN0YXRTeW5jKHNyYylcclxuICAgICAgICAgIGlmIChzdC5pc0RpcmVjdG9yeSgpKSB7XHJcbiAgICAgICAgICAgIGZzLm1rZGlyU3luYyhkZXN0LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgZnMucmVhZGRpclN5bmMoc3JjKSkge1xyXG4gICAgICAgICAgICAgIGNvcHlEaXIocGF0aC5qb2luKHNyYywgbmFtZSksIHBhdGguam9pbihkZXN0LCBuYW1lKSlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKHNyYywgZGVzdClcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgY29weURpcihzb3VyY2VQYXRoLCB0YXJnZXRQYXRoKVxyXG5cclxuICAgICAgICBpZiAodmVyYm9zZSkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYCR7bG9nUHJlZml4fSBcdTI3MDUgVW5pQXBwIFx1NjcyQ1x1NTczMFx1NTM5Rlx1NzUxRlx1NjNEMlx1NEVGNlx1NTkwRFx1NTIzNlx1NUI4Q1x1NjIxMGApXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IFx1NURGMlx1NjIxMFx1NTI5Rlx1NTkwRFx1NTIzNiAke3NvdXJjZUZpbGVzLmxlbmd0aH0gXHU0RTJBXHU2NTg3XHU0RUY2L1x1NzZFRVx1NUY1NVx1NTIzMFx1Njc4NFx1NUVGQVx1NzZFRVx1NUY1NWApXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgJHtsb2dQcmVmaXh9IFx1NTM5Rlx1NzUxRlx1NjNEMlx1NEVGNlx1NzNCMFx1NTcyOFx1NTNFRlx1NEVFNVx1NTcyOCBBcHAgXHU0RTJEXHU2QjYzXHU1RTM4XHU0RjdGXHU3NTI4YClcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgJHtjb25maWcubG9nUHJlZml4fSBcdTI3NEMgXHU1OTBEXHU1MjM2IFVuaUFwcCBcdTY3MkNcdTU3MzBcdTUzOUZcdTc1MUZcdTYzRDJcdTRFRjZcdTU5MzFcdThEMjU6YCwgZXJyb3IpXHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgJHtjb25maWcubG9nUHJlZml4fSBcdTk1MTlcdThCRUZcdThCRTZcdTYwQzU6YCwgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpKVxyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYCR7Y29uZmlnLmxvZ1ByZWZpeH0gXHU4QkY3XHU2OEMwXHU2N0U1XHU2RTkwXHU3NkVFXHU1RjU1XHU2NzQzXHU5NjUwXHU1NDhDXHU3OEMxXHU3NkQ4XHU3QTdBXHU5NUY0YClcclxuICAgICAgICAvLyBcdTRFMERcdTYyOUJcdTUxRkFcdTk1MTlcdThCRUZcdUZGMENcdTkwN0ZcdTUxNERcdTVGNzFcdTU0Q0RcdTY1NzRcdTRFMkFcdTY3ODRcdTVFRkFcdThGQzdcdTdBMEJcdUZGMENcdTRGNDZcdTRGMUFcdThCQjBcdTVGNTVcdThCRTZcdTdFQzZcdTc2ODRcdTk1MTlcdThCRUZcdTRGRTFcdTYwNkZcclxuICAgICAgfVxyXG4gICAgfSxcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBcdTUyMUJcdTVFRkEgVW5pQXBwIFx1NjcyQ1x1NTczMFx1NTM5Rlx1NzUxRlx1NjNEMlx1NEVGNlx1OEQ0NFx1NkU5MFx1NTkwRFx1NTIzNlx1NjNEMlx1NEVGNlx1NzY4NFx1NEZCRlx1NjM3N1x1NTFGRFx1NjU3MFxyXG4gKlxyXG4gKiBcdThGRDlcdTY2MkZcdTRFMDBcdTRFMkFcdTRGQkZcdTYzNzdcdTc2ODRcdTVERTVcdTUzODJcdTUxRkRcdTY1NzBcdUZGMENcdTc1MjhcdTRFOEVcdTVGRUJcdTkwMUZcdTUyMUJcdTVFRkFcdTYzRDJcdTRFRjZcdTVCOUVcdTRGOEJcclxuICogXHU3Mjc5XHU1MjJCXHU5MDAyXHU3NTI4XHU0RThFXHU1NzI4IHZpdGUuY29uZmlnLnRzIFx1NEUyRFx1OEZEQlx1ODg0Q1x1Njc2MVx1NEVGNlx1NjAyN1x1NjNEMlx1NEVGNlx1OTE0RFx1N0Y2RVxyXG4gKlxyXG4gKiBcdTRGN0ZcdTc1MjhcdTc5M0FcdTRGOEJcdUZGMUFcclxuICogYGBgdHlwZXNjcmlwdFxyXG4gKiAvLyBcdTU3Mjggdml0ZS5jb25maWcudHMgXHU0RTJEXHJcbiAqIHBsdWdpbnM6IFtcclxuICogICAvLyBcdTRFQzVcdTU3MjggYXBwIFx1NUU3M1x1NTNGMFx1NEUxNFx1NTQyRlx1NzUyOFx1NjVGNlx1NzUxRlx1NjU0OFxyXG4gKiAgIFVOSV9QTEFURk9STSA9PT0gJ2FwcCdcclxuICogICAgID8gY3JlYXRlQ29weU5hdGl2ZVJlc291cmNlc1BsdWdpbihcclxuICogICAgICAgICBWSVRFX0NPUFlfTkFUSVZFX1JFU19FTkFCTEUgPT09ICd0cnVlJyxcclxuICogICAgICAgICB7IHZlcmJvc2U6IG1vZGUgPT09ICdkZXZlbG9wbWVudCcgfVxyXG4gKiAgICAgICApXHJcbiAqICAgICA6IG51bGwsXHJcbiAqIF1cclxuICogYGBgXHJcbiAqXHJcbiAqIEBwYXJhbSBlbmFibGUgXHU2NjJGXHU1NDI2XHU1NDJGXHU3NTI4XHU2M0QyXHU0RUY2XHVGRjBDXHU5MDFBXHU1RTM4XHU5MDFBXHU4RkM3XHU3M0FGXHU1ODgzXHU1M0Q4XHU5MUNGXHU2M0E3XHU1MjM2XHJcbiAqIEBwYXJhbSBvcHRpb25zIFx1NTE3Nlx1NEVENlx1OTE0RFx1N0Y2RVx1OTAwOVx1OTg3OVx1RkYwQ1x1NEUwRFx1NTMwNVx1NTQyQiBlbmFibGUgXHU1QzVFXHU2MDI3XHJcbiAqIEByZXR1cm5zIFZpdGUgXHU2M0QyXHU0RUY2XHU1QkY5XHU4QzYxXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29weU5hdGl2ZVJlc291cmNlc1BsdWdpbihcclxuICBlbmFibGU6IGJvb2xlYW4gPSB0cnVlLFxyXG4gIG9wdGlvbnM6IE9taXQ8Q29weU5hdGl2ZVJlc291cmNlc09wdGlvbnMsICdlbmFibGUnPiA9IHt9LFxyXG4pOiBQbHVnaW4ge1xyXG4gIHJldHVybiBjb3B5TmF0aXZlUmVzb3VyY2VzKHsgZW5hYmxlLCAuLi5vcHRpb25zIH0pXHJcbn1cclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzb3VyY2VfY29kZVxcXFxmYXNoaW9uXFxcXGZhc2hpb25fcmVjXFxcXHVuaWFwcC12MlxcXFx2aXRlLXBsdWdpbnNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHNvdXJjZV9jb2RlXFxcXGZhc2hpb25cXFxcZmFzaGlvbl9yZWNcXFxcdW5pYXBwLXYyXFxcXHZpdGUtcGx1Z2luc1xcXFxtYXJrZWQtdW5pY29kZS1zaGltLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9zb3VyY2VfY29kZS9mYXNoaW9uL2Zhc2hpb25fcmVjL3VuaWFwcC12Mi92aXRlLXBsdWdpbnMvbWFya2VkLXVuaWNvZGUtc2hpbS50c1wiOy8qKlxyXG4gKiBVbmlBcHAgQXBwIChpT1MvQW5kcm9pZCkgXHU3Njg0IEphdmFTY3JpcHRDb3JlIFx1NEUwRFx1NjUyRlx1NjMwMVx1NkI2M1x1NTIxOVx1NEUyRFx1NzY4NCBVbmljb2RlIFx1NUM1RVx1NjAyN1x1OEY2Q1x1NEU0OSAoXFxwe0x9LCBcXHB7Tn0sIFxccHtQfSwgXFxwe1N9KVx1MzAwMlxyXG4gKiBtYXJrZWQgMTcueCBcdTRGN0ZcdTc1MjhcdThGRDlcdTRFOUIgRVMyMDE4IFx1NzI3OVx1NjAyN1x1RkYwQ1x1NUJGQ1x1ODFGNFx1OEZEMFx1ODg0Q1x1NjVGNiBTeW50YXhFcnJvclx1MzAwMlxyXG4gKiBcdTY3MkNcdTYzRDJcdTRFRjZcdTU3MjhcdTY3ODRcdTVFRkFcdTY1RjZcdTY2RkZcdTYzNjIgbWFya2VkIFx1NkU5MFx1NzgwMVx1NEUyRFx1NzY4NCBVbmljb2RlIFx1NkI2M1x1NTIxOVx1NEUzQVx1NTE3Q1x1NUJCOVx1NTE5OVx1NkNENVx1MzAwMlxyXG4gKi9cclxuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICd2aXRlJ1xyXG5cclxuLyoqIFx1NjgwN1x1NzBCOS9cdTdCMjZcdTUzRjdcdTc2ODRcdTUxN0NcdTVCQjlcdTVCNTdcdTdCMjZcdTdDN0JcdUZGMDhcdTY2RkZcdTRFRTMgXFxwe1B9XFxwe1N9XHVGRjA5ICovXHJcbmNvbnN0IFAgPSAnXFxcXHUyMDAwLVxcXFx1MjA2RlxcXFx1MzAwMC1cXFxcdTMwM0YhXCIjXFxcXCQlJlxcJygpKissXFxcXC0uXFwvOjs8PT4/QFxcXFxbXFxcXF1eX2B7fH1+J1xyXG5cclxuLyoqXHJcbiAqIFx1NjZGRlx1NjM2MiBtYXJrZWQgXHU2RTkwXHU3ODAxXHU0RTJEXHU3Njg0IFVuaWNvZGUgXHU2QjYzXHU1MjE5XHU1QjU3XHU5NzYyXHU5MUNGXHUzMDAyXHJcbiAqL1xyXG5mdW5jdGlvbiByZXBsYWNlVW5pY29kZVJlZ2V4KGNvZGU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgbGV0IHJlc3VsdCA9IGNvZGVcclxuICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvXFwvXFxbXFxcXHBcXHtMXFx9XFxcXHBcXHtOXFx9XFxdXFwvdS9nLCAnL1swLTlBLVphLXpcXFxcdTAwODAtXFxcXHVGRkZGXS8nKVxyXG4gIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC9cXC9cXFtcXFxccFxce1BcXH1cXFxccFxce1NcXH1cXF1cXC91L2csIGAvWyR7UH1dL2ApXHJcbiAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoL1xcL1xcW1xcXFxzXFxcXHBcXHtQXFx9XFxcXHBcXHtTXFx9XFxdXFwvdS9nLCBgL1tcXFxccyR7UH1dL2ApXHJcbiAgLy8gW15cXHNcXHB7UH1cXHB7U31dIC0gXHU2Q0U4XHU2MTBGIF4gXHU2NUUwXHU1M0NEXHU2NTlDXHU2NzYwXHJcbiAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoL1xcL1xcW1xcXlxcXFxzXFxcXHBcXHtQXFx9XFxcXHBcXHtTXFx9XFxdXFwvdS9nLCBgL1teXFxcXHMke1B9XS9gKVxyXG4gIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC9cXC9cXCg/IX5cXClcXFtcXFxccFxce1BcXH1cXFxccFxce1NcXH1cXF1cXC91L2csIGAvKD8hfilbJHtQfV0vYClcclxuICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvXFwvXFwoPyF+XFwpXFxbXFxcXHNcXFxccFxce1BcXH1cXFxccFxce1NcXH1cXF1cXC91L2csIGAvKD8hfilbXFxcXHMke1B9XS9gKVxyXG4gIC8vICg/OlteXFxzXFxwe1B9XFxwe1N9XXx+KVxyXG4gIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC9cXC9cXCg/OlxcW1xcXlxcXFxzXFxcXHBcXHtQXFx9XFxcXHBcXHtTXFx9XFxdXFx8flxcKVxcL3UvZywgYC8oPzpbXlxcXFxzJHtQfV18fikvYClcclxuICAvLyBcdTUxNUNcdTVFOTVcdUZGMUFcdTY2RkZcdTYzNjJcdTYyNDBcdTY3MDlcdTUyNjlcdTRGNTlcdTc2ODQgXFxwe1B9XFxwe1N9IFx1NTQ4QyBcXHB7TH1cXHB7Tn1cdUZGMDhcdTUzRUZcdTgwRkRcdTY4M0NcdTVGMEZcdTc1NjVcdTY3MDlcdTRFMERcdTU0MENcdUZGMDlcclxuICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvXFxcXHBcXHtQXFx9XFxcXHBcXHtTXFx9L2csIFApXHJcbiAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoL1xcXFxwXFx7TFxcfVxcXFxwXFx7TlxcfS9nLCAnMC05QS1aYS16XFxcXHUwMDgwLVxcXFx1RkZGRicpXHJcbiAgcmV0dXJuIHJlc3VsdFxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWFya2VkVW5pY29kZVNoaW0oKTogUGx1Z2luIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogJ21hcmtlZC11bmljb2RlLXNoaW0nLFxyXG4gICAgZW5mb3JjZTogJ3ByZScsXHJcbiAgICB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcclxuICAgICAgaWYgKCFpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykgfHwgIWlkLmluY2x1ZGVzKCdtYXJrZWQnKSlcclxuICAgICAgICByZXR1cm4gbnVsbFxyXG5cclxuICAgICAgY29uc3QgbmV3Q29kZSA9IHJlcGxhY2VVbmljb2RlUmVnZXgoY29kZSlcclxuICAgICAgaWYgKG5ld0NvZGUgIT09IGNvZGUpXHJcbiAgICAgICAgcmV0dXJuIHsgY29kZTogbmV3Q29kZSwgbWFwOiBudWxsIH1cclxuICAgICAgcmV0dXJuIG51bGxcclxuICAgIH0sXHJcbiAgfVxyXG59XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcc291cmNlX2NvZGVcXFxcZmFzaGlvblxcXFxmYXNoaW9uX3JlY1xcXFx1bmlhcHAtdjJcXFxcdml0ZS1wbHVnaW5zXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxzb3VyY2VfY29kZVxcXFxmYXNoaW9uXFxcXGZhc2hpb25fcmVjXFxcXHVuaWFwcC12MlxcXFx2aXRlLXBsdWdpbnNcXFxcc3luYy1tYW5pZmVzdC1wbHVnaW5zLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9zb3VyY2VfY29kZS9mYXNoaW9uL2Zhc2hpb25fcmVjL3VuaWFwcC12Mi92aXRlLXBsdWdpbnMvc3luYy1tYW5pZmVzdC1wbHVnaW5zLnRzXCI7aW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcydcclxuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xyXG5pbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnXHJcblxyXG5pbnRlcmZhY2UgTWFuaWZlc3RUeXBlIHtcclxuICAncGx1cyc/OiB7XHJcbiAgICBkaXN0cmlidXRlPzoge1xyXG4gICAgICBwbHVnaW5zPzogUmVjb3JkPHN0cmluZywgYW55PlxyXG4gICAgfVxyXG4gIH1cclxuICAnYXBwLXBsdXMnPzoge1xyXG4gICAgZGlzdHJpYnV0ZT86IHtcclxuICAgICAgcGx1Z2lucz86IFJlY29yZDxzdHJpbmcsIGFueT5cclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN5bmNNYW5pZmVzdFBsdWdpbigpOiBQbHVnaW4ge1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAnc3luYy1tYW5pZmVzdCcsXHJcbiAgICBhcHBseTogJ2J1aWxkJyxcclxuICAgIGVuZm9yY2U6ICdwb3N0JyxcclxuICAgIHdyaXRlQnVuZGxlOiB7XHJcbiAgICAgIG9yZGVyOiAncG9zdCcsXHJcbiAgICAgIGhhbmRsZXIoKSB7XHJcbiAgICAgICAgY29uc3Qgc3JjTWFuaWZlc3RQYXRoID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICcuL3NyYy9tYW5pZmVzdC5qc29uJylcclxuICAgICAgICBjb25zdCBkaXN0QXBwUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAnLi9kaXN0L2Rldi9hcHAvbWFuaWZlc3QuanNvbicpXHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAvLyBcdThCRkJcdTUzRDZcdTZFOTBcdTY1ODdcdTRFRjZcclxuICAgICAgICAgIGNvbnN0IHNyY01hbmlmZXN0ID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc3JjTWFuaWZlc3RQYXRoLCAndXRmOCcpKSBhcyBNYW5pZmVzdFR5cGVcclxuXHJcbiAgICAgICAgICAvLyBcdTc4NkVcdTRGRERcdTc2RUVcdTY4MDdcdTc2RUVcdTVGNTVcdTVCNThcdTU3MjhcclxuICAgICAgICAgIGNvbnN0IGRpc3RBcHBEaXIgPSBwYXRoLmRpcm5hbWUoZGlzdEFwcFBhdGgpXHJcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlzdEFwcERpcikpIHtcclxuICAgICAgICAgICAgZnMubWtkaXJTeW5jKGRpc3RBcHBEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pXHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gXHU4QkZCXHU1M0Q2XHU3NkVFXHU2ODA3XHU2NTg3XHU0RUY2XHVGRjA4XHU1OTgyXHU2NzlDXHU1QjU4XHU1NzI4XHVGRjA5XHJcbiAgICAgICAgICBsZXQgZGlzdE1hbmlmZXN0OiBNYW5pZmVzdFR5cGUgPSB7fVxyXG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZGlzdEFwcFBhdGgpKSB7XHJcbiAgICAgICAgICAgIGRpc3RNYW5pZmVzdCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGRpc3RBcHBQYXRoLCAndXRmOCcpKVxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFx1NTk4Mlx1Njc5Q1x1NkU5MFx1NjU4N1x1NEVGNlx1NUI1OFx1NTcyOCBwbHVnaW5zXHJcbiAgICAgICAgICBpZiAoc3JjTWFuaWZlc3RbJ2FwcC1wbHVzJ10/LmRpc3RyaWJ1dGU/LnBsdWdpbnMpIHtcclxuICAgICAgICAgICAgLy8gXHU3ODZFXHU0RkREXHU3NkVFXHU2ODA3XHU2NTg3XHU0RUY2XHU0RTJEXHU2NzA5XHU1RkM1XHU4OTgxXHU3Njg0XHU1QkY5XHU4QzYxXHU3RUQzXHU2Nzg0XHJcbiAgICAgICAgICAgIGlmICghZGlzdE1hbmlmZXN0LnBsdXMpXHJcbiAgICAgICAgICAgICAgZGlzdE1hbmlmZXN0LnBsdXMgPSB7fVxyXG4gICAgICAgICAgICBpZiAoIWRpc3RNYW5pZmVzdC5wbHVzLmRpc3RyaWJ1dGUpXHJcbiAgICAgICAgICAgICAgZGlzdE1hbmlmZXN0LnBsdXMuZGlzdHJpYnV0ZSA9IHt9XHJcblxyXG4gICAgICAgICAgICAvLyBcdTU5MERcdTUyMzYgcGx1Z2lucyBcdTUxODVcdTVCQjlcclxuICAgICAgICAgICAgZGlzdE1hbmlmZXN0LnBsdXMuZGlzdHJpYnV0ZS5wbHVnaW5zID0gc3JjTWFuaWZlc3RbJ2FwcC1wbHVzJ10uZGlzdHJpYnV0ZS5wbHVnaW5zXHJcblxyXG4gICAgICAgICAgICAvLyBcdTUxOTlcdTUxNjVcdTY2RjRcdTY1QjBcdTU0MEVcdTc2ODRcdTUxODVcdTVCQjlcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhkaXN0QXBwUGF0aCwgSlNPTi5zdHJpbmdpZnkoZGlzdE1hbmlmZXN0LCBudWxsLCAyKSlcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1x1MjcwNSBNYW5pZmVzdCBwbHVnaW5zIFx1NTQwQ1x1NkI2NVx1NjIxMFx1NTI5RicpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignXHUyNzRDIFx1NTQwQ1x1NkI2NSBtYW5pZmVzdCBwbHVnaW5zIFx1NTkzMVx1OEQyNTonLCBlcnJvcilcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH1cclxufVxyXG4iXSwKICAi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QUFBO0FBQUEsTUFFakQsT0FBTyxLQUFLLE1BQU0scUJBQXFCLElBQ25DO0FBQUEsUUFDRSxDQUFDLHFCQUFxQixHQUFHO0FBQUEsVUFDdkIsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBO0FBQUEsVUFFZCxTQUFTLENBQUFDLFVBQVFBLE1BQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7QUFBQSxRQUMzRTtBQUFBLE1BQ0YsSUFDQTtBQUFBLElBQ047QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE1BQU0sd0JBQXdCLFNBQVMsQ0FBQyxXQUFXLFVBQVUsSUFBSSxDQUFDO0FBQUEsSUFDcEU7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFdBQVc7QUFBQTtBQUFBO0FBQUEsTUFHWCxRQUFRO0FBQUE7QUFBQSxNQUVSLFFBQVEsU0FBUyxnQkFBZ0IsUUFBUTtBQUFBLElBQzNDO0FBQUEsRUFDRixDQUFDO0FBQ0gsQ0FBQzsiLAogICJuYW1lcyI6IFsicGF0aCIsICJwcm9jZXNzIiwgImZzIiwgInBhdGgiLCAicHJvY2VzcyIsICJwcm9jZXNzIiwgInBhdGgiLCAiZnMiLCAiZnMiLCAicGF0aCIsICJwcm9jZXNzIiwgInBhdGgiLCAicHJvY2VzcyIsICJmcyIsICJyZXF1aXJlIiwgInByb2Nlc3MiLCAicGF0aCJdCn0K
