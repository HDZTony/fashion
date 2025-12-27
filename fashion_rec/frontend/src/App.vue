<script setup>
// Pinia auth store is automatically initialized when the store is created
// No need to manually call useAuthState() here anymore
</script>

<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
