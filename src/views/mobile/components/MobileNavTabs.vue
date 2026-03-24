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
    <!-- 陰影用獨立層，避免 filter 導致子層 icon (SVG) 消失 -->
    <div class="mobile-tabbar-shadow" aria-hidden="true" />
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
  position: relative;
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  background: var(--card);
  /* 左上、右上圓角，底部貼齊螢幕 */
  border-radius: 1.25rem 1.25rem 0 0;
  /* 底部留白：僅 safe area */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
/* 陰影獨立層：避免 filter 造成子層 SVG icon 不渲染 */
.mobile-tabbar-shadow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--card);
  filter: drop-shadow(0 -2px 10px rgb(0 0 0 / 0.08)) drop-shadow(0 -1px 3px rgb(0 0 0 / 0.05));
  pointer-events: none;
  z-index: 0;
}
.dark .mobile-tabbar-shadow {
  filter: drop-shadow(0 -2px 10px rgb(0 0 0 / 0.3)) drop-shadow(0 -1px 3px rgb(0 0 0 / 0.2));
}
.mobile-tabbar-row {
  position: relative;
  z-index: 1;
  display: flex;
  height: 3.9rem;
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
