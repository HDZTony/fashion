# anfun-Supabass 插件 vs 当前 Supabase 用法对比

## 1. 插件概览（anfun-Supabass）

- **类型**：uni-app 的 **uni_modules 插件**（DCloud 插件市场风格），本质是 **Supabase JS 客户端的 uni-app 适配版**。
- **形态**：对 Supabase 官方 JS 客户端的 **fork/改造**，在包内用自定义实现替换了依赖浏览器/Node 环境的 API，从而在 **H5、小程序、App** 下都能跑。
- **入口**：`createClient(supabaseUrl, supabaseKey [, options])`，和官方 API 一致，可直接替换使用。

---

## 2. 和你当前用法的核心区别

| 维度 | 你当前项目（uniapp-v2） | anfun-Supabass 插件 |
|------|-------------------------|----------------------|
| **依赖** | 官方 `@supabase/supabase-js` | 自维护的 fork，打包在插件里 |
| **URL 处理** | 依赖全局 `new URL()`；App 端无/残缺 URL 会报 **"Invalid supabaseUrl: Provided URL is malformed"** | 使用自实现的 **AURL**（纯字符串解析），**不依赖** 全局 `URL`，故 App/小程序不会因 URL 报错 |
| **请求** | 自己封的 `createUniFetch()`（uni.request → fetch 形态）传给 `createClient` 的 `global.fetch` | 内置 **uni-request-adapter**（uniFetch），在库内统一用 uni.request 发请求 |
| **Headers** | 用环境自带的或你提供的 Headers | 在无 `Headers` 的环境用自实现的 **UniHeaders** |
| **存储** | 自己做的 `uniStorage`（uni.getStorageSync 等）传给 `auth.storage` | 使用库内默认/配置的 storage，可与 uni 存储对接 |
| **集成方式** | 在 `src/lib/supabase.ts` 里写死/环境变量配置 URL+Key，并做 Polyfill（如 react-native-url-polyfill） | 以 **uni_modules** 引入，页面里 `import { createClient } from '@/uni_modules/anfun-supabase'` 即可 |

总结：**anfun 版在源码里就避开了对全局 `URL`/`fetch`/`Headers` 的依赖，所以同样的 `https://xxx.supabase.co` 在 App 端不会出现 “Provided URL is malformed”；你当前用官方包 + 各种 Polyfill 仍可能在某些 App 环境下被官方包内部的 URL 校验拦住。**

---

## 3. 插件内部关键实现（摘要）

- **`dist/lib/AURL.js`**  
  - 自实现 URL 解析（正则等），提供 `href/origin/hostname/pathname/search` 等，**完全不调用 `new URL()`**。  
  - 用于构建 `authUrl`、`realtimeUrl`、`storageUrl`、`functionsUrl` 等，因此不依赖运行环境是否有 URL。

- **`dist/lib/uni-request-adapter.js`**  
  - 实现 `uniFetch`：把 `uni.request` 封装成 fetch 风格，供 Supabase 的 auth/rest/storage/functions 使用。  
  - 实现 `UniHeaders`，在无 `Headers` 的环境下使用。

- **`dist/SupabaseClient.js`**  
  - 仅校验 `supabaseUrl` / `supabaseKey` 是否存在（truthy），**没有**对 URL 做 `new URL(...)` 或类似“格式校验”。  
  - 用 `ensureTrailingSlash(supabaseUrl)` 后直接 `new AURL('auth/v1', baseUrl)` 等，所以不会触发 “Provided URL is malformed”。

- **Auth / Realtime / Storage**  
  - 与官方 JS 客户端同源逻辑，只是请求、URL、部分头/存储等改为上述适配实现。

---

## 4. 和“官方 SDK”的关系

- **anfun-Supabass**：仍是 **JavaScript/TypeScript 客户端**，只是为 uni-app 多端做了适配（URL/fetch/Headers 等），**不是** iOS 原生 Swift SDK。
- 你之前说的「改用官方 SDK 实现」若指 **iOS 原生 Supabase Swift SDK**，那是另一条路：用原生做登录，再通过桥把 token 给 JS；和是否用 anfun 插件是两件事。
- 若指「在 uniapp 里用官方推荐的 Supabase 客户端」：**在 App/小程序场景下，anfun 版可以视为官方 JS 的“可用的 uni-app 官方风格实现”**，因为 API 一致，只是内部换了环境兼容实现。

---

## 5. 使用建议（和你当前项目的取舍）

- **若目标是在 App（含 iOS）上尽快跑通登录、且不想折腾 Polyfill 或原生桥**：  
  - 可以尝试 **直接采用 anfun-Supabass 插件**：  
    - 把插件放到 `uni_modules`（或你们约定的插件目录），  
    - 用 `createClient(supabaseUrl, supabaseKey)` 创建客户端（可选传入 storage 等），  
    - 登录页改为使用该 client 的 `signInWithPassword` 等，  
  - 这样在 App 端不会再有 “Invalid supabaseUrl: Provided URL is malformed” 的根源问题（因为不再用全局 URL）。

- **若坚持用官方 @supabase/supabase-js**：  
  - 需要保证在 **所有** 调用 Supabase 的代码执行前，全局 `URL`/`URLSearchParams` 已由 Polyfill 或原生注入提供，且行为与标准一致；  
  - 你当前已在 `src/lib/supabase.ts` 里做了 Polyfill 和 `applyNativeSession`，若仍报错，多半是 Polyfill 未在官方包**内部**校验 URL 之前生效，或官方包在某分支里用了未覆盖到的 API。  
  - 再往下就是看官方包源码里 “malformed” 的抛出点，或考虑换 anfun 一劳永逸。

- **若同时要做 iOS 原生登录（Swift SDK）+ JS 用 token**：  
  - 仍可按你现有的 **原生桥方案**（如 `native-supabase` + `applyNativeSession`）设计；  
  - 区别只在于：**JS 侧** 用 anfun 的 `createClient` 还是官方 `createClient`；用 anfun 时 App 端 URL 问题消失，原生桥只负责“谁提供 token”（原生登录 vs JS 登录）。

---

## 6. 小结

| 对比项 | 当前（官方 @supabase/supabase-js） | anfun-Supabass |
|--------|-----------------------------------|----------------|
| App 端 “Invalid supabaseUrl” | 容易出现（依赖全局 URL） | 从根源避免（用 AURL） |
| 请求/Headers | 自己适配 uni.request + storage | 插件内已适配 |
| API 形态 | 标准 createClient + auth/rest 等 | 与官方一致，可无缝替换 |
| 维护方 | Supabase 官方 | 第三方（DCloud 插件） |
| 适用场景 | H5 更稳；App/小程序需大量 Polyfill 或原生桥 | 多端统一用一套 JS 客户端，App/小程序开箱可用 |

**结论**：anfun-Supabass 和当前使用 Supabase 的**最大区别**是：**在 uniapp 的 App/小程序环境里，用自实现的 AURL/uniFetch/UniHeaders 替代对全局 URL/fetch/Headers 的依赖，从而避免 “Provided URL is malformed” 等环境问题**；功能上仍是同一套 Supabase 能力（Auth、DB、Storage、Functions、Realtime），API 与官方一致，可按需直接替换或与现有原生桥方案并存。
