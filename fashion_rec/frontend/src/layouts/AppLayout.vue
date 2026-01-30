<template>
  <SidebarProvider :default-open="true" collapsible="offcanvas">
    <AppSidebarBody />
  </SidebarProvider>
</template>

<script setup lang="ts">
import { SidebarProvider } from '@/components/ui/sidebar'
import AppSidebarBody from './AppSidebarBody.vue'
</script>
