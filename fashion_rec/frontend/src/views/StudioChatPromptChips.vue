<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'

const { files, removeFile } = usePromptInput()
</script>

<template>
  <div
    v-if="files.length > 0"
    class="flex flex-wrap gap-2 px-3 pt-2"
  >
    <div
      v-for="f in files"
      :key="f.id"
      class="relative size-14 overflow-hidden rounded-lg border border-pink-100 bg-muted/30"
    >
      <img
        :src="f.url"
        :alt="f.filename || ''"
        class="size-full object-cover"
      >
      <button
        type="button"
        class="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        :aria-label="'Remove'"
        @click="removeFile(f.id)"
      >
        <X class="size-3" />
      </button>
    </div>
  </div>
</template>
