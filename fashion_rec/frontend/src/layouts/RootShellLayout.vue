<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import HomeLayout from '@/layouts/HomeLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'

/** 使用首页顶栏（非侧边栏）的营销向路由 */
const MARKETING_ROUTE_NAMES = new Set([
  'home',
  'pricing',
  'blog',
  'blog-detail',
  'blog-create',
  'blog-edit',
])

const route = useRoute()

const useMarketingLayout = computed(() =>
  route.matched.some((record) => MARKETING_ROUTE_NAMES.has(record.name as string)),
)
</script>

<template>
  <HomeLayout v-if="useMarketingLayout">
    <router-view />
  </HomeLayout>
  <AppLayout v-else />
</template>
