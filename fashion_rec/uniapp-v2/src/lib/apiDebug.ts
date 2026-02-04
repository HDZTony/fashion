/**
 * API 接口调试日志，用于博客页展示请求/响应信息。
 */
import { ref, type Ref } from 'vue'

export interface ApiDebugEntry {
  id: number
  time: string
  method: string
  url: string
  status: number | string
  duration: number
  preview?: string
}

const MAX_ENTRIES = 50
let nextId = 1

const logs: Ref<ApiDebugEntry[]> = ref([])

export function pushApiLog(entry: Omit<ApiDebugEntry, 'id' | 'time'>): void {
  const full: ApiDebugEntry = {
    ...entry,
    id: nextId++,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  }
  logs.value.unshift(full)
  if (logs.value.length > MAX_ENTRIES) {
    logs.value.pop()
  }
}

export function clearApiLogs(): void {
  logs.value = []
}

export function getApiLogs(): Ref<ApiDebugEntry[]> {
  return logs
}
