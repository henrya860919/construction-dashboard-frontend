<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'

const { isDark } = storeToRefs(useThemeStore())
</script>

<template>
  <Toaster
    :theme="isDark ? 'dark' : 'light'"
    class="toaster group"
    position="top-center"
    :duration="1500"
    :close-button="true"
    :rich-colors="false"
  />
</template>
