<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold text-foreground">施工日誌</h1>
    <Card>
      <CardHeader>
        <CardTitle>施工日誌</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">
          施工日誌功能，此頁面待實作。實作時請以
          <code class="rounded bg-muted px-1 py-0.5 text-xs">useProjectModuleActions(projectId, 'construction.diary')</code>
          控管讀寫操作。
        </p>
      </CardContent>
    </Card>
  </div>
</template>
