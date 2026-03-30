import { nanoid } from 'nanoid'
import type { StudioChatMessage } from '@/composables/useStudioChatKit'

export type StudioChatHistoryEntry = {
  id: string
  updatedAt: number
  title: string
  messages: StudioChatMessage[]
}

const MAX_ENTRIES = 40
const STORAGE_PREFIX = 'fashion-rec-studio-chat-sessions:'

export function historyStorageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey}`
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function isValidMessage(x: unknown): x is StudioChatMessage {
  if (!isRecord(x)) return false
  if (typeof x.id !== 'string') return false
  if (x.role !== 'user' && x.role !== 'assistant') return false
  if (typeof x.text !== 'string') return false
  if (!Array.isArray(x.imageUrls)) return false
  if (!x.imageUrls.every(u => typeof u === 'string')) return false
  if (x.resultImageUrl !== undefined && typeof x.resultImageUrl !== 'string') return false
  if (x.sceneBackgroundUrl !== undefined && typeof x.sceneBackgroundUrl !== 'string') return false
  if (x.sceneBackgroundActionPrompt !== undefined && typeof x.sceneBackgroundActionPrompt !== 'string')
    return false
  return true
}

function isValidEntry(x: unknown): x is StudioChatHistoryEntry {
  if (!isRecord(x)) return false
  if (typeof x.id !== 'string') return false
  if (typeof x.updatedAt !== 'number') return false
  if (typeof x.title !== 'string') return false
  if (!Array.isArray(x.messages)) return false
  return x.messages.every(isValidMessage)
}

export function deriveChatTitle(messages: StudioChatMessage[]): string {
  for (const m of messages) {
    if (m.role === 'user' && m.text.trim()) {
      const t = m.text.trim().replace(/\s+/g, ' ')
      return t.length > 48 ? `${t.slice(0, 48)}…` : t
    }
  }
  return '—'
}

export function loadHistoryList(userKey: string): StudioChatHistoryEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(historyStorageKey(userKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function upsertHistoryEntry(userKey: string, entry: StudioChatHistoryEntry): void {
  if (typeof localStorage === 'undefined') return
  const list = loadHistoryList(userKey).filter(e => e.id !== entry.id)
  list.push(entry)
  list.sort((a, b) => b.updatedAt - a.updatedAt)
  const trimmed = list.slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(historyStorageKey(userKey), JSON.stringify(trimmed))
  } catch {
    // quota / private mode
  }
}

export function deleteHistoryEntry(userKey: string, id: string): void {
  if (typeof localStorage === 'undefined') return
  const list = loadHistoryList(userKey).filter(e => e.id !== id)
  try {
    localStorage.setItem(historyStorageKey(userKey), JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function newChatSessionId(): string {
  return nanoid()
}

export function cloneMessages(msgs: StudioChatMessage[]): StudioChatMessage[] {
  return msgs.map(m => ({
    ...m,
    imageUrls: [...m.imageUrls],
  }))
}
