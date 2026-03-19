# 手機／PWA 現場查驗實作指南

本文件整理**目前已實作**的手機端行為、檔案位置與擴充方式，供之後新增「一頁一頁切換」類功能時對齊。  
較早的願景與方案比較見：**[pwa-mobile-app-planning.md](./pwa-mobile-app-planning.md)**。

---

## 1. 架構總覽

| 項目 | 說明 |
|------|------|
| **入口** | PWA `start_url` 為 `/mobile`（見 `vite.config.ts` → `VitePWA` manifest） |
| **Layout** | `MobileLayout`（`src/layouts/MobileLayout.vue`）：頂欄 + 可捲動主內容 + 底部 Tab |
| **路由前綴** | 一律在 **`/mobile`** 下，與桌面版 `/p/:projectId/...` 分離 |
| **專案脈絡** | URL 帶 **`/mobile/p/:projectId/...`**（與規劃文件方案 B 一致） |

桌面版路由與側欄**不受**手機路由影響；手機版為獨立子樹。

---

## 2. 路由與常數

### 2.1 註冊位置

- **`src/router/index.ts`**：`path: ROUTE_PATH.MOBILE`（`/mobile`）掛 `MobileLayout`，子路由為 `p/:projectId/...` 與選專案首頁等。
- 新增手機頁面時：在此加 `path` + `name` + `component`，並同步 **`src/constants/routes.ts`** 的 `ROUTE_PATH` / `ROUTE_NAME`。

### 2.2 路徑組裝

- 使用 **`buildMobileProjectPath(projectId, subPath)`**（`src/constants/routes.ts`），勿手寫 `/mobile/p/...`。
- `ROUTE_PATH` 內手機子路徑多為**相對片段**（如 `'defects'`、`'defects/new'`），實際導航要搭配 `buildMobileProjectPath` 或具名路由 `params`。

### 2.3 參考：缺失改善相關路由名稱

| ROUTE_NAME | 用途 |
|------------|------|
| `MOBILE_PROJECT_PICKER` | 選專案 |
| `MOBILE_INSPECTION` / `MOBILE_DIARY` / `MOBILE_DEFECTS` / `MOBILE_REPAIR` | 底部 Tab 根頁 |
| `MOBILE_INSPECTION_TEMPLATE` | 某樣板之查驗紀錄列表（右下角 FAB 新增） |
| `MOBILE_INSPECTION_RECORD_NEW` / `MOBILE_INSPECTION_RECORD_DETAIL` | 手機新增查驗／檢視單筆紀錄 |
| `MOBILE_DEFECT_DETAIL` | 單筆缺失詳情（含詳細／執行紀錄 Tab） |
| `MOBILE_DEFECT_NEW` / `MOBILE_DEFECT_EDIT` | 新增／編輯缺失 |
| `MOBILE_DEFECT_RECORD_NEW` / `MOBILE_DEFECT_RECORD_DETAIL` | 新增／檢視執行紀錄 |
| `MOBILE_REPAIR_NEW` / `MOBILE_REPAIR_DETAIL` / `MOBILE_REPAIR_EDIT` | 新增／詳情／編輯報修 |
| `MOBILE_REPAIR_RECORD_NEW` / `MOBILE_REPAIR_RECORD_DETAIL` | 新增／檢視報修紀錄 |
| `MOBILE_PHOTO_VIEWER` | 通用檢視照片（全螢幕） |

---

## 3. Layout 與頂欄

### 3.1 `MobileLayout.vue`

- **`projectId`**：優先 `route.params.projectId`，若短暫未同步則用 **`route.path` 正則** `/\/p\/([^/]+)/` 解析，避免返回根頁時底部 **Tab 消失**。
- **`ROOT_ROUTE_NAMES`**：這些路由**不顯示** Header 返回鈕（視為「根」）：選專案、各 Tab 首頁（檢查／缺失列表／報修／日誌）。
- **子頁**：其餘路由顯示返回；`goBack()` 使用 **`router.back()`**。
- **主內容**：`.mobile-page-layer` 為實際捲動層，鍵盤收起時會一併做捲動還原（與 `App.vue` / CSS 搭配）。

### 3.2 底部 Tab（`MobileNavTabs.vue`）

- 僅在 **`projectId` 存在**時顯示（選專案頁不顯示）。
- 樣式注意：**勿對整個 `nav` 下 `filter`**，以免子層 SVG icon 在某些頁不渲染；陰影用**獨立層**（如 `.mobile-tabbar-shadow`）。
- 需要避開鍵盤遮擋時，可加上 class **`pwa-fixed-bottom`**（見 `main.css`）。

---

## 4. 導航與瀏覽器歷史（重要）

手機流程多為「列表 → 詳情 → 表單」，若用 **`router.push` 回到上一層**，歷史會變成 `A → B → C → B`，使用者按返回會回到 **C（例如編輯頁）**，體感錯誤。

### 4.1 約定

| 情境 | 建議 |
|------|------|
| 表單**儲存成功**或**取消**，要回到「進入表單前的那一頁」 | **`router.back()`** |
| 從詳情進子頁（編輯／新增） | 維持 **`router.push`**（堆一層，之後 `back()` 可回詳情） |
| 需固定返回後的 UI 狀態（例如詳情內「執行紀錄」分頁） | 先用 **`router.replace`** 把目前詳情的 **URL query**（如 `?tab=records`）寫好，再 **`push`** 子頁；子頁 **`back()`** 時會帶正確 query |

### 4.2 參考實作：`MobileDefectDetailView.vue`

- 使用者切換「詳細內容／執行紀錄」時，以 **`router.replace`** 同步 **`?tab=records`** 或清空，避免只靠元件內 state。
- **`goAddRecord` / `goViewRecord`**：`await router.replace`（帶 `tab=records`）→ `await router.push`（子頁），再從子頁 `back()` 可回到執行紀錄分頁。

### 4.3 參考實作：表單頁

- `MobileDefectEditView.vue`、`MobileDefectRecordNewView.vue`、`MobileDefectNewView.vue`：成功送出與取消皆 **`router.back()`**（不再 `push` 到列表／詳情）。

新增類似模組時請複製此模式。

---

## 5. PWA、iOS 與鍵盤

### 5.1 `App.vue`（僅在 **iOS + standalone**）

- **根頁防滑出**：`history.pushState` + `popstate` + 邊緣滑動 `preventDefault`（與 `MobileLayout` 的 `ROOT_ROUTE_NAMES` / `App.vue` 內 `MOBILE_ROOT_NAMES` 需**同步**）。
- **Viewport**：動態寫入 CSS 變數 **`--vh`**（依 `visualViewport` / `innerHeight`）；`focusin` / `focusout` 為 `body` 加 **`keyboard-open`**。

### 5.2 `src/assets/main.css`

- **`body.ios-pwa-standalone`**：手機 layout 高度改用 `calc(var(--vh, 1vh) * 100)`，減輕 100vh 誤差。
- **`body.keyboard-open .pwa-fixed-bottom`**：鍵盤開啟時隱藏固定底欄，避免錯位。
- **`.scrollbar-hide`**：捲動區可隱藏捲軸仍保留捲動。
- **小螢幕 `input/textarea/select` `font-size: 16px`**：減少 iOS 聚焦放大。

### 5.3 `index.html`

- viewport 含 **`interactive-widget=resizes-content`**（與鍵盤行為搭配）。

### 5.4 `MobileLayout` 鍵盤

- `focusout`（input/textarea/select）與 `visualViewport` `resize`：延遲後 **`scrollTo({ behavior: 'smooth' })`** 多層還原，避免關閉鍵盤後畫面卡在上方。

---

## 6. 區網與開發環境

- **`VITE_API_URL`**（`.env`）須與手機／模擬器實際連線之**後端 host** 一致；換 IP（例如 `192.168.x.x`）後要改並**重啟** dev server。
- **`vite.config.ts`**：`server.host: '0.0.0.0'`；`hmr.host` 使用 **`getNetworkHost()`**（取第一個非內部 IPv4）。若瀏覽器用另一張網卡的 IP 開頁，HMR 可能異常，可改為以環境變數指定 HMR host（後端 repo 有 **`docs/local-network-access.md`** 可一併參考區網設定）。

---

## 7. 缺失改善模組（範例架構）

可作為「列表 + 詳情 + 多層子頁」的範本。

| 區塊 | 位置 |
|------|------|
| 列表 | `src/views/mobile/MobileDefectsView.vue` |
| 詳情／分頁 | `src/views/mobile/defects/MobileDefectDetailView.vue` |
| 表單 | `MobileDefectNewView.vue`、`MobileDefectEditView.vue`、`MobileDefectRecordNewView.vue` |
| 紀錄詳情 | `MobileDefectRecordDetailView.vue` |
| API | `src/api/defect-improvements.ts` |
| 後端 | `construction-dashboard-backend`：`/api/v1/projects/:projectId/defect-improvements` 等 |

### 7.1 通用照片檢視

- Store：`src/stores/photoViewer.ts`（關閉／換一批時會 `revoke` 先前建立的 `blob:` URL）
- Composable：`src/composables/usePhotoViewer.ts` → 以 **`apiClient` + `responseType: 'blob'`** 帶 JWT 取檔後建立 `blob:` URL，再導向 **`MOBILE_PHOTO_VIEWER`**（不可直接用 `<img :src="完整 API URL">`，瀏覽器請求不會帶 `Authorization`）
- 頁面：`src/views/mobile/MobilePhotoViewerView.vue`  
其他模組要「看大圖」可沿用同一套。

### 7.2 列表互動（參考）

- 左滑刪除、分頁內左右滑切 Tab 等：**觸控閾值**與「直向捲動誤觸」需分離（見 `MobileDefectsView.vue` 內註解與常數）。

### 7.3 報修模組（列表 + 詳情 Tab「詳細內容／報修紀錄」+ 表單）

| 區塊 | 位置 |
|------|------|
| 列表 | `src/views/mobile/MobileRepairView.vue` |
| 詳情 | `src/views/mobile/repairs/MobileRepairDetailView.vue` |
| 表單 | `MobileRepairNewView.vue`、`MobileRepairEditView.vue` |
| 報修紀錄 | `MobileRepairRecordNewView.vue`、`MobileRepairRecordDetailView.vue` |
| API | `src/api/repair-requests.ts` |
| 後端 | `construction-dashboard-backend`：`/api/v1/projects/:projectId/repair-requests` 與 `.../records` |

---

## 8. UI／無障礙與主題

- 手機頁面仍須遵守 **`theme-support.mdc`**（語意色、深淺模式）。
- 複雜列表／表單可對照 **`ui-ux-principles.mdc`**；手機常以全寬按鈕、`touch-manipulation`、`min-h-*` 放大觸控區。

---

## 9. 新增一組「手機功能」檢查清單

- [ ] `routes.ts`：`ROUTE_PATH` / `ROUTE_NAME`、`buildMobileProjectPath` 用法正確  
- [ ] `router/index.ts`：子路由掛在 `/mobile` 下  
- [ ] 表單完成／取消：**優先 `router.back()`**，避免重複堆疊  
- [ ] 若詳情有 **Tab／狀態** 需在返回後保留：**`replace` 寫入 URL** 再進子頁  
- [ ] `MobileLayout`：`pageTitle`、`ROOT_ROUTE_NAMES`（若為新 Tab 根頁要列入）  
- [ ] 底部 Tab：若為主要入口，在 **`MobileNavTabs.vue`** 新增項目  
- [ ] API：`projectId` 帶入後端並做權限過濾（後端模組化 controller → service → repository）  
- [ ] PWA：新靜態資源若需離線快取，檢查 `vite-plugin-pwa` / `workbox` 設定  
- [ ] 完成後執行 **`npm run build`**（前端）

---

## 10. 相關檔案索引

| 檔案 | 用途 |
|------|------|
| `src/layouts/MobileLayout.vue` | 手機主版面、返回邏輯、捲動還原 |
| `src/views/mobile/components/MobileHeader.vue` | 頂欄 |
| `src/views/mobile/components/MobileNavTabs.vue` | 底部導覽 |
| `src/App.vue` | iOS PWA 根頁防護、--vh、keyboard-open |
| `src/assets/main.css` | PWA／捲軸／鍵盤 class |
| `vite.config.ts` | PWA、`server` / `hmr` / `proxy` |
| `index.html` | viewport |

---

*文件隨實作演進請更新本檔與 `.cursor/rules/mobile-pwa-field-app.mdc`。*
