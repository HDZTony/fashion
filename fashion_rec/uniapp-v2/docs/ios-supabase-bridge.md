# iOS 原生 Supabase SDK 集成指引

目标：在 iOS 端使用官方 Supabase Swift SDK 完成登录，并通过原生插件把 session 回传给 uniapp。

## 依赖
- Xcode → Package Dependencies 添加 `https://github.com/supabase-community/supabase-swift.git`
- 选择最新版（或与后端兼容的版本）

## 插件接口约定
- 插件名称：`SupabaseAuth`
- 方法（任选其一暴露）：`login(params, callback)` 或 `signIn(params, callback)`
- 入参 `params`：
  - `email: string`
  - `password: string`
  - `redirectTo?: string`（可忽略）
- 回调返回：
  ```json
  {
    "access_token": "<JWT>",
    "refresh_token": "<token>",
    "expires_in": <number>,
    "token_type": "bearer",
    "user": { ... },
    "error": null
  }
  ```
  若失败，返回 `{ "error": "message" }`

## Swift 侧登录示例
```swift
import Supabase

struct NativeSession: Codable {
    let access_token: String
    let refresh_token: String
    let expires_in: Int?
    let token_type: String?
    let user: [String: AnyCodable]?
}

let client = SupabaseClient(
    supabaseURL: URL(string: "https://<your-ref>.supabase.co")!,
    supabaseKey: "<anon key>"
)

func login(email: String, password: String, completion: @escaping (Result<NativeSession, Error>) -> Void) {
    Task {
        do {
            let result = try await client.auth.signIn(
                email: email,
                password: password
            )
            guard let session = result.session else {
                throw NSError(domain: "SupabaseAuth", code: -1, userInfo: [NSLocalizedDescriptionKey: "No session"])
            }
            let native = NativeSession(
                access_token: session.accessToken,
                refresh_token: session.refreshToken ?? "",
                expires_in: Int(session.expiresIn ?? 0),
                token_type: session.tokenType,
                user: nil
            )
            completion(.success(native))
        } catch {
            completion(.failure(error))
        }
    }
}
```

## 与 uniapp 通信
- 5+ 原生插件中，暴露 `login(params, callback)`，回调入参为上面的 JSON。
- JS 侧已提供桥接模块 `src/lib/native-supabase.ts`：
  - `isNativeSupabaseAvailable()` 用于检测插件
  - `loginWithNativeSupabase({ email, password })` 调用插件
  - `applyNativeSession(...)` 在 `src/lib/supabase.ts` 中设置会话并写入存储
- 页面逻辑：`pages/login/login.vue` 已在 App 平台优先调用原生插件，失败则回落到 JS Supabase。

## 验证
1. 真机或模拟器运行 uniapp App。
2. 触发登录，原生插件应返回 token，页面自动跳转。
3. 查看日志：若缺少插件或调用失败，会自动回退到 JS 登录并输出错误日志。
