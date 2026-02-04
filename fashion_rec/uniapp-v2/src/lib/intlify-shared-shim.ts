/**
 * Shim: @intlify/message-compiler 期望 @intlify/shared 导出 join，
 * 但 vue-i18n 9 使用的 @intlify/shared 9.1.9 未导出该函数。
 * 此文件补全 join 并重新导出，通过 vite resolve.alias 注入。
 * 使用 intlify-shared-internal 避免循环依赖（alias 将 @intlify/shared 指向本文件）
 */
export * from 'intlify-shared-internal'

/** 补全 message-compiler 所需的 join：将数组用分隔符连接成字符串 */
export const join = (arr: unknown[], sep = ''): string =>
  Array.isArray(arr) ? arr.join(sep) : String(arr)
