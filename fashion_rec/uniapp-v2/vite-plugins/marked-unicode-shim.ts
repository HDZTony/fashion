/**
 * UniApp App (iOS/Android) 的 JavaScriptCore 不支持正则中的 Unicode 属性转义 (\p{L}, \p{N}, \p{P}, \p{S})。
 * marked 17.x 使用这些 ES2018 特性，导致运行时 SyntaxError。
 * 本插件在构建时替换 marked 源码中的 Unicode 正则为兼容写法。
 */
import type { Plugin } from 'vite'

/** 标点/符号的兼容字符类（替代 \p{P}\p{S}） */
const P = '\\u2000-\\u206F\\u3000-\\u303F!"#\\$%&\'()*+,\\-.\/:;<=>?@\\[\\]^_`{|}~'

/**
 * 替换 marked 源码中的 Unicode 正则字面量。
 */
function replaceUnicodeRegex(code: string): string {
  let result = code
  result = result.replace(/\/\[\\p\{L\}\\p\{N\}\]\/u/g, '/[0-9A-Za-z\\u0080-\\uFFFF]/')
  result = result.replace(/\/\[\\p\{P\}\\p\{S\}\]\/u/g, `/[${P}]/`)
  result = result.replace(/\/\[\\s\\p\{P\}\\p\{S\}\]\/u/g, `/[\\s${P}]/`)
  // [^\s\p{P}\p{S}] - 注意 ^ 无反斜杠
  result = result.replace(/\/\[\^\\s\\p\{P\}\\p\{S\}\]\/u/g, `/[^\\s${P}]/`)
  result = result.replace(/\/\(?!~\)\[\\p\{P\}\\p\{S\}\]\/u/g, `/(?!~)[${P}]/`)
  result = result.replace(/\/\(?!~\)\[\\s\\p\{P\}\\p\{S\}\]\/u/g, `/(?!~)[\\s${P}]/`)
  // (?:[^\s\p{P}\p{S}]|~)
  result = result.replace(/\/\(?:\[\^\\s\\p\{P\}\\p\{S\}\]\|~\)\/u/g, `/(?:[^\\s${P}]|~)/`)
  // 兜底：替换所有剩余的 \p{P}\p{S} 和 \p{L}\p{N}（可能格式略有不同）
  result = result.replace(/\\p\{P\}\\p\{S\}/g, P)
  result = result.replace(/\\p\{L\}\\p\{N\}/g, '0-9A-Za-z\\u0080-\\uFFFF')
  return result
}

export function markedUnicodeShim(): Plugin {
  return {
    name: 'marked-unicode-shim',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('node_modules') || !id.includes('marked'))
        return null

      const newCode = replaceUnicodeRegex(code)
      if (newCode !== code)
        return { code: newCode, map: null }
      return null
    },
  }
}
