# 文件索引（前端）

開發約定以 **`.cursor/rules/`** 為準（`project-overview`、`project-routes`、`theme-support`、`ui-ux-principles` 等）。此目錄補充架構說明、交付與進階主題。

## 部署與交付

| 文件 | 說明 |
|------|------|
| [deployment-handover-railway-vercel.md](./deployment-handover-railway-vercel.md) | 接收方：Railway 後端 + Vercel 前端、`prod` 分支、migration |
| 後端 repo **`docs/deployment-setup-guide.md`** | 全託管逐步架設（含 R2、環境變數）；與本目錄 `deployment-handover-railway-vercel.md` 搭配使用 |

## 架構與導航

| 文件 | 說明 |
|------|------|
| [multi-project-multi-tenant-planning.md](./multi-project-multi-tenant-planning.md) | 多專案／多租戶 URL 與權限規劃 |
| [auth-and-admin-architecture.md](./auth-and-admin-architecture.md) | 認證、租戶後台、平台後台 |
| [sidebar.md](./sidebar.md) | 側欄結構、`AppSidebar`、與 `navigation.ts` 對應 |
| [breadcrumb.md](./breadcrumb.md) | 麵包屑與 `breadcrumb.ts` |

## 權限與模組

| 文件 | 說明 |
|------|------|
| [project-module-frontend-ui-gating.md](./project-module-frontend-ui-gating.md) | 專案內 UI 與 `useProjectPermission`／toast 約定 |
| [photo-management-permissions.md](./photo-management-permissions.md) | 照片管理模組與 `construction.photo` |

## 列表／表格 UI

| 文件 | 說明 |
|------|------|
| [data-table-list-views.md](./data-table-list-views.md) | 列表頁與 DataTable 工具列 |
| [advanced-data-table-toolbar-guide.md](./advanced-data-table-toolbar-guide.md) | 工具列進階用法 |
| [standalone-page-layout.md](./standalone-page-layout.md) | **獨立路由頁**（整頁詳情／表單）：頁首、卡片區塊、頁尾操作 |

## 施工／契約相關 UI

| 文件 | 說明 |
|------|------|
| [construction-valuation-ui.md](./construction-valuation-ui.md) | 估驗計價介面 |

## 手機／PWA 現場查驗

| 文件 | 說明 |
|------|------|
| [mobile-field-app-implementation-guide.md](./mobile-field-app-implementation-guide.md) | **實作與檢查清單**（路由、`MobileLayout`、歷史堆疊） |
| [pwa-mobile-app-planning.md](./pwa-mobile-app-planning.md) | 願景與方案比較（補充閱讀） |

## 其他

| 文件 | 說明 |
|------|------|
| [user-operation-manual.md](./user-operation-manual.md) | 使用者操作說明 |
| [system-vendor-relationship.md](./system-vendor-relationship.md) | 系統與廠商／介接關係整理 |

## 進度 S 曲線（前端實作）

幾何、圖層與 D3 繪製約定以 **`.cursor/rules/progress-scurve-unified-svg.mdc`** 為準；程式入口：`ProgressUnifiedScurve.vue`、`src/lib/progress-scurve-layout.ts`。
