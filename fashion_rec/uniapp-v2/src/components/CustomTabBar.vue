<template>
  <wd-root-portal>
    <wd-tabbar
      :model-value="tabValue"
      fixed
      placeholder
      safe-area-inset-bottom
      bordered
      active-color="#ec4899"
      inactive-color="#999"
      :z-index="9999"
      @change="handleChange"
    >
      <wd-tabbar-item name="index" title="首页" icon="home" />
      <wd-tabbar-item name="blog" title="博客" icon="file" />
    </wd-tabbar>
  </wd-root-portal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{ currentTab?: 'index' | 'blog' }>(),
  { currentTab: 'index' }
)

const tabValue = ref<'index' | 'blog'>(props.currentTab)

watch(() => props.currentTab, (v) => { tabValue.value = v }, { immediate: true })

function handleChange(e: { value: string | number }) {
  const value = String(e.value)
  if (value === 'index') {
    uni.switchTab({ url: '/pages/index/index' })
  } else if (value === 'blog') {
    uni.switchTab({ url: '/pages/blog-list/blog-list' })
  }
}
</script>
