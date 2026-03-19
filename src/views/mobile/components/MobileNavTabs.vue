<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ClipboardCheck, AlertCircle, Wrench, BookOpen } from 'lucide-vue-next'
import { buildMobileProjectPath } from '@/constants/routes'
import { ROUTE_PATH } from '@/constants/routes'

defineProps<{
  projectId: string
}>()

const tabs = [
  { path: ROUTE_PATH.MOBILE_INSPECTION, label: '自主檢查', icon: ClipboardCheck },
  { path: ROUTE_PATH.MOBILE_DEFECTS, label: '缺失改善', icon: AlertCircle },
  { path: ROUTE_PATH.MOBILE_REPAIR, label: '報修', icon: Wrench },
  { path: ROUTE_PATH.MOBILE_DIARY, label: '施工日誌', icon: BookOpen },
]
</script>

<template>
  <nav class="mobile-tabbar" role="tablist">
    <div class="mobile-tabbar-row">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="buildMobileProjectPath(projectId, tab.path)"
        class="mobile-tab-item"
        :aria-current="$route.path.includes(tab.path) ? 'page' : undefined"
      >
        <span class="mobile-tab-icon" aria-hidden>
          <component :is="tab.icon" class="size-6" />
        </span>
        <span class="mobile-tab-label">{{ tab.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.mobile-tabbar {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  background: var(--card);
  /* 底部留白：無 safe area 時至少 0.5rem；有 safe area 時用 2.7 倍（依實際機型微調） */
  padding-bottom: max(0.5rem, calc(env(safe-area-inset-bottom, 0px) * 2.7));
}
.mobile-tabbar-row {
  display: flex;
  height: 3.5rem;
  align-items: stretch;
  justify-content: space-around;
  flex-shrink: 0;
}
.mobile-tab-item {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 0;
  color: var(--muted-foreground);
  text-decoration: none;
  font-size: 11px;
  transition: color 0.15s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.mobile-tab-item:active {
  background: var(--muted);
  opacity: 0.5;
}
.mobile-tab-item.router-link-active {
  color: var(--primary);
  font-weight: 500;
}
.mobile-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.mobile-tab-icon :deep(svg) {
  display: block;
}
.mobile-tab-label {
  flex-shrink: 0;
  line-height: 1.2;
}
</style>
