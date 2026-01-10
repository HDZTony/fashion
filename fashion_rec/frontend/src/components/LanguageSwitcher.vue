<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="toggleDropdown"
      class="flex items-center gap-2 px-3 py-2 text-sm text-pink-600 hover:text-pink-700 transition-colors font-medium rounded-md hover:bg-pink-50"
      :aria-label="t('nav.language')"
    >
      <Globe class="w-4 h-4" />
      <span class="hidden sm:inline">{{ currentLocaleName }}</span>
      <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showDropdown }" />
    </button>
    
    <div
      v-if="showDropdown"
      class="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-pink-200 py-1 z-50"
    >
      <button
        @click="switchLanguage('en')"
        class="w-full text-left px-4 py-2 text-sm hover:bg-pink-50 transition-colors flex items-center gap-2"
        :class="{ 'bg-pink-50 text-pink-700 font-medium': locale === 'en' }"
      >
        <span>🇺🇸</span>
        <span>English</span>
        <Check v-if="locale === 'en'" class="w-4 h-4 ml-auto" />
      </button>
      <button
        @click="switchLanguage('zh')"
        class="w-full text-left px-4 py-2 text-sm hover:bg-pink-50 transition-colors flex items-center gap-2"
        :class="{ 'bg-pink-50 text-pink-700 font-medium': locale === 'zh' }"
      >
        <span>🇨🇳</span>
        <span>中文</span>
        <Check v-if="locale === 'zh'" class="w-4 h-4 ml-auto" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe, ChevronDown, Check } from 'lucide-vue-next'
import { setLocale } from '@/i18n'

const { locale, t } = useI18n()
const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const currentLocaleName = computed(() => {
  return locale.value === 'zh' ? '中文' : 'English'
})

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
  showDropdown.value = false
}

const switchLanguage = (lang: 'en' | 'zh') => {
  setLocale(lang)
  closeDropdown()
}

// Handle click outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
