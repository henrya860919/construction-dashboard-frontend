<script setup lang="ts">
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

defineProps<{ embedded?: boolean }>()
</script>

<template>
  <div class="space-y-6">
    <h1 v-if="!embedded" class="text-xl font-semibold text-foreground">影像</h1>
    <Card>
      <CardHeader>
        <CardTitle>監測影像與媒體</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">
          監測相關照片、影片與檔案，此頁面待串接媒體 API 後實作。
        </p>
      </CardContent>
    </Card>
  </div>
</template>
