import { useStudioStore } from '@/stores/studio'

export const MODEL_SCOPE_QUERY_KEY = 'model_id'
export const MODEL_SCOPE_HEADER_KEY = 'X-Fashion-Rec-Model-Id'
export const DEFAULT_MODEL_SCOPE_ID = 'example-IMG_9953'

export function resolveModelScopeId(modelId?: string | null): string {
  const raw = (modelId ?? '').trim()
  return raw || DEFAULT_MODEL_SCOPE_ID
}

export function currentModelScopeId(): string {
  const studioStore = useStudioStore()
  return resolveModelScopeId(studioStore.activeModelId)
}

export function withModelScopeParams(
  params?: Record<string, unknown>,
  modelId?: string | null,
): Record<string, unknown> {
  return {
    ...(params ?? {}),
    [MODEL_SCOPE_QUERY_KEY]: resolveModelScopeId(modelId),
  }
}
