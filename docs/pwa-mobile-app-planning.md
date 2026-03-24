# PWA 手機查驗 App 架構規劃與分析

> **已落地實作的操作指南**（路由、Layout、歷史堆疊、iOS 鍵盤等）請見：**[mobile-field-app-implementation-guide.md](./mobile-field-app-implementation-guide.md)**。  
> 本文件以**規劃、方案比較與願景**為主。

本文件說明如何將現有 Construction Dashboard 前端擴充為 **同一程式碼庫、雙端呈現**：桌面版維持完整系統，手機端（含 PWA 安裝）僅呈現現場查驗相關功能，並可離線填單、連線後同步。

---

## 一、目標與約束

| 項目 | 說明 |
|------|------|
| **同一程式碼** | 不另建第二套 repo，同一 Vue 3 + Vite 專案產出 Web + PWA |
| **手機端定位** | 功能型 App，僅提供「現場查驗」所需子集，非完整後台 |
| **桌面端** | 維持現有 `/projects`、`/p/:projectId/...` 完整路由與側欄，不受影響 |
| **PWA** | 可安裝到主畫面、standalone 全螢幕、離線可填單、連線後同步 |

---

## 二、現有架構摘要

### 2.1 路由與專案脈絡

- **入口**：`/` → redirect 至 `/projects`；登入後進入專案列表，再進入 `/p/:projectId/dashboard`。
- **專案內路徑**：一律為 `/p/:projectId/...`，例如：
  - `/p/:projectId/construction/self-check`（自主檢查）
  - `/p/:projectId/construction/diary`（施工日誌）
  - `/p/:projectId/construction/defects`（缺失改善）
  - `/p/:projectId/repair/overview`、`/p/:projectId/repair/records`（報修）
- **Layout**：`DefaultLayout`（側欄 + 主內容）、`AuthLayout`（登入頁）。
- **認證**：`router.beforeEach` 檢查 `useAuthStore().isAuthenticated`，未登入導向 `/login`。

### 2.2 與手機端對應的功能

| 桌面路徑 | 功能 | 手機端對應 |
|----------|------|------------|
| `.../construction/self-check` | 自主檢查 | 自主檢查（列表／新增／拍照） |
| `.../construction/diary` | 施工日誌 | 施工日誌（今日快速填寫） |
| `.../construction/defects` | 缺失改善 | 缺失改善（列表／狀態／改善後拍照） |
| `.../repair/overview`、`.../repair/records` | 報修總覽／紀錄 | 報修（列表／新增報修單） |

其餘（儀表板、監測、契約、檔案、管理、後台等）**不在手機端提供**。

### 2.3 技術棧（與 PWA 相關）

- Vue 3 + Vite、Vue Router 4、Pinia、shadcn-vue
- 尚未：PWA manifest、Service Worker、裝置判斷、離線佇列

---

## 三、架構決策

### 3.1 單一 SPA、雙入口

- **同一 build**：一套 Vite build 同時包含「桌面版」與「手機版」路由。
- **入口區分**：
  - 桌面：`/`、`/projects`、`/p/:projectId/...`（現狀不變）。
  - 手機：`/mobile` 為 PWA 的 `start_url`；手機／PWA 啟動時導向 `/mobile`（或選專案後 `/mobile/p/:projectId/...`）。
- **不採用**：依裝置在建立 router 時只註冊其中一組 route（例如 `isMobileApp ? mobileRoutes : desktopRoutes`），因為 `createRouter()` 只執行一次，且 SSR/ hydration 時裝置可能未知；改為 **兩組 route 都註冊**，用 **navigation guard 做導向**。

### 3.2 手機版路由設計（兩種方案）

| 方案 | 路徑範例 | 優點 | 缺點 |
|------|----------|------|------|
| **A. 專案在 Store** | `/mobile`、`/mobile/inspection`、`/mobile/diary`… | URL 短、實作簡單 | 無深連結、無法直接分享「某專案某頁」 |
| **B. 專案在 URL** | `/mobile/p/:projectId/inspection`、`/mobile/p/:projectId/diary`… | 可深連結、可分享、與桌面路徑概念一致 | 路徑稍長、需在手機版維持 projectId |

**建議**：採用 **方案 B**（專案在 URL），理由：

- 與現有「專案內路徑皆帶 projectId」一致，API 呼叫可直接從 route 取 `projectId`。
- 支援「從通知／郵件點連結進某專案某功能」。
- 選專案後可 `router.push` 到 `/mobile/p/${projectId}/inspection`，行為明確。

若第一版希望極簡，可先做方案 A，再演進到 B。

### 3.3 裝置判斷與導向規則

- **Composable**：`useDevice()` 提供：
  - `isPWA`：是否從主畫面啟動（`display-mode: standalone` 或 iOS `navigator.standalone`）。
  - `isMobile`：是否為手機裝置（UA 或畫面寬度 &lt; 768）。
  - `isMobileApp`：是否視為「手機 App 情境」→ `isPWA || isMobile`（或僅 `isPWA` 若希望只有安裝成 PWA 才走手機版）。
- **Router guard**（建議在既有 `beforeEach` 內一併處理）：
  - 若 `isMobileApp && !to.path.startsWith('/mobile')` 且 `to.path !== '/login'` **且使用者未選擇「使用桌面版」** → 導向 `/mobile`（或 `/mobile` 選專案後的首頁）。
  - 若 `!isMobileApp && to.path.startsWith('/mobile')` → 導向 `/projects`（或 `/`），避免桌面瀏覽器誤入手機版。
  - 登入頁 `/login` 兩端共用；登入後依 `isMobileApp`（及是否選擇桌面版）決定導向 `/mobile` 或 `/projects`。

### 3.4 在 App 內切回桌面版（使用者偏好）

- **需求**：在手機／PWA 中仍可選擇「使用完整桌面版」，預設則為手機版。
- **行為**：
  - **預設**：在手機或 PWA 啟動時，一律進入手機版（`/mobile` 或 `/mobile/p/:projectId/...`）。
  - **選項**：在手機版提供一項設定（例如選單或設定頁的「使用完整版網站」／「切換至桌面版」），點選後：
    - 將偏好寫入 **Store + 持久化**（如 `localStorage` 或 Pinia persist），例如 `preferDesktopOnMobile: true`。
    - 導向桌面版入口（如 `/projects` 或 `/`），之後在**同一 session 或下次開啟**時，只要此偏好為 `true`，router guard **不再**把使用者導向 `/mobile`，改走完整桌面版 Layout 與路由。
  - **切回手機版**：在桌面版（且偵測到為手機裝置時）可提供「切回手機版」按鈕，清除 `preferDesktopOnMobile` 並導向 `/mobile`。
- **實作要點**：
  - 新增一 Store（如 `useAppPreferenceStore`）或於既有設定 Store 中增加 `preferDesktopOnMobile: boolean`，預設 `false`；可搭配 `localStorage` 持久化。
  - Router guard 邏輯：若 `isMobileApp && store.preferDesktopOnMobile`，則**不** redirect 到 `/mobile`，允許進入 `/projects`、`/p/:projectId/...` 等桌面路由。
  - 手機版 Layout（Header 或選單）內提供「使用完整版」按鈕；桌面版在手機時可於 Header 或側欄提供「切回手機版」。
- **小結**：預設為手機版，使用者可主動切到桌面版並記住偏好，兩者並存於同一 App 內。

### 3.5 手機版是否複用既有 View

| 做法 | 說明 |
|------|------|
| **完全複用** | 手機版僅換 Layout（MobileLayout），內容仍用 `ConstructionSelfCheckView` 等 | 改動少，但桌面版 UI（表格、側欄）未必適合小螢幕 |
| **手機專用 View** | 新增 `views/mobile/` 下專用頁（如 `MobileInspectionView.vue`），必要時共用底下元件或 API 層 | UI 可針對觸控、單欄、底部 Tab 優化，推薦 |

**建議**：**手機專用 View**（`views/mobile/`），與桌面 View 共用：

- API client、stores、型別、部分表單/列表元件（若抽成共用 component）。
- 不共用：整頁 layout、複雜表格、桌面專用側欄。

---

## 四、PWA 技術要點

### 4.1 套件與設定

- **套件**：`vite-plugin-pwa`（基於 Workbox）。
- **設定要點**：
  - `registerType: 'autoUpdate'`（或 `prompt` 若需手動更新）。
  - `manifest.start_url: '/mobile'`，使安裝後開啟即進手機版。
  - `manifest.display: 'standalone'`，隱藏瀏覽器 UI。
  - `manifest.orientation: 'portrait'`（可選）。
  - 適當的 `theme_color`、`background_color`、icons（192、512，含 maskable）。
- **Workbox**：快取 `**/*.{js,css,html,ico,png,svg}`；可對 `/api/` 用 NetworkFirst、圖片 CacheFirst，以支援離線瀏覽與離線送單。

### 4.2 離線與同步

- **情境**：工地網路不穩，使用者仍可填寫表單、拍照。
- **做法**：
  - 離線時將「待送出」的請求寫入 **IndexedDB**（或 Pinia + persist），並標記為 pending。
  - 使用 **同一 API**（與桌面版一致），僅在無法連線時改為寫入佇列並回傳「已暫存，將於連線後同步」。
  - 監聽 `online`，連線後依序送出佇列並清除；若失敗可保留並重試或提示。
- **Store**：例如 `stores/offlineQueue.ts` 負責佇列與同步，可被手機版表單元件呼叫。

### 4.3 iOS 安裝提示

- iOS Safari 不會自動出現「加到主畫面」；可在手機版（且非 standalone 時）顯示自製提示：「點選分享 → 加入主畫面」以安裝 PWA。

---

## 五、手機版 UI 架構

### 5.1 Layout

- **MobileLayout.vue**：
  - 頂部：返回（若有上一頁）、標題、選單或設定（可含專案切換）。
  - 主內容區：`<router-view />`，可捲動。
  - 底部：Tab Bar（自主檢查、缺失改善、報修、施工日誌），對應 `/mobile/p/:projectId/...` 各子路徑。
- **專案選擇**：若採用方案 B，可於「第一次進入 `/mobile` 無 projectId」時顯示專案選擇器，選後導向 `/mobile/p/:projectId/inspection`；並在 Header 或選單中提供「切換專案」。

### 5.2 功能頁對應與簡化原則

| 功能 | 桌面 View | 手機 View（建議） | 簡化重點 |
|------|-----------|-------------------|----------|
| 自主檢查 | ConstructionSelfCheckView | MobileInspectionView | 列表＋新增；表單用 Sheet；拍照用 `input[type=file][capture]` |
| 施工日誌 | ConstructionDiaryView | MobileDiaryView | 今日為主、少欄位、快速送出 |
| 缺失改善 | ConstructionDefectsView | MobileDefectsView | 依狀態篩選、列表＋詳情、改善後拍照 |
| 報修 | RepairOverviewView / RepairRecordsView | MobileRepairView | 列表＋新增報修單、拍照、位置 |

### 5.3 UI 規格（與主題一致）

- 遵守既有 **theme-support**：使用 `bg-background`、`text-foreground`、`border-border` 等，不硬編碼色碼。
- 觸控：最小點擊區域約 48px；表單 input 高度建議 ≥ 48px；字級 ≥ 16px 以減少 iOS 自動縮放。
- 安全區域：Tab Bar 使用 `padding-bottom: env(safe-area-inset-bottom)`；主內容區使用 `100dvh` 等避免被瀏覽器 UI 遮擋。

---

## 六、路由與常數擴充建議

### 6.1 常數（routes.ts）

- 新增 `ROUTE_PATH.MOBILE`、`ROUTE_PATH.MOBILE_*`（如 `MOBILE_INSPECTION`、`MOBILE_DIARY`、`MOBILE_DEFECTS`、`MOBILE_REPAIR`）。
- 若採方案 B：路徑型態為 `/mobile/p/:projectId/inspection` 等，可定義為 path 樣板或由 `buildMobileProjectPath(projectId, subPath)` 組出。

### 6.2 Router 註冊

- 在現有 `routes` 陣列中**新增**一組以 `path: '/mobile'` 為根的路由：
  - `/mobile`：可 redirect 到專案選擇或預設專案首頁。
  - `/mobile/p/:projectId`：redirect 到該專案手機首頁（如 inspection）。
  - `/mobile/p/:projectId/inspection`、`/diary`、`/defects`、`/repair` 為 children，component 為 `MobileLayout` + 對應 View。
- **不改動**既有 `/`、`/projects`、`/p/:projectId/...` 的註冊方式，僅在 `beforeEach` 中加上上述手機／桌面導向邏輯。

### 6.3 導航與麵包屑

- 手機版不使用現有側欄與麵包屑；由 **MobileLayout** 的 Tab Bar 與 Header 提供導航。
- 若未來在手機版需要麵包屑，可在 `constants/breadcrumb.ts` 為 `/mobile/...` 增加對應即可。

---

## 七、檔案與目錄結構建議

```
public/
  icons/
    icon-192.png
    icon-512.png

src/
  layouts/
    MobileLayout.vue              # 手機版 Layout（Header + Tab Bar + router-view）
  views/mobile/
    MobileProjectPickerView.vue   # 選專案（進入 /mobile 且無 projectId 時）
    MobileInspectionView.vue      # 自主檢查
    MobileDiaryView.vue           # 施工日誌
    MobileDefectsView.vue         # 缺失改善
    MobileRepairView.vue          # 報修
  composables/
    useDevice.ts                  # isPWA / isMobile / isMobileApp
  stores/
    offlineQueue.ts               # 離線佇列與同步
    appPreference.ts              # 選用：preferDesktopOnMobile 等 App 偏好（持久化）
  components/mobile/             # 手機專用元件（可選）
    IOSInstallPrompt.vue          # iOS 安裝引導
    PhotoUpload.vue               # 拍照／上傳
    StatusBadge.vue               # 狀態 Badge
  constants/
    routes.ts                     # 新增 MOBILE_* 路徑
  router/
    index.ts                      # 註冊 /mobile 路由 + guard 導向
```

- **vite.config.ts**：加入 `VitePWA({ ... })`，包含 manifest、Workbox、start_url `/mobile`。

---

## 八、實作順序建議

1. **PWA 基礎**  
   安裝 `vite-plugin-pwa`，設定 manifest（name、short_name、start_url、display、icons），確認 build 後可安裝到主畫面並以 standalone 開啟。

2. **裝置判斷與導向**  
   實作 `useDevice.ts`；在 router 的 `beforeEach` 中依 `isMobileApp` 將手機導向 `/mobile`、桌面誤入 `/mobile` 時導向 `/projects`；登入後依裝置導向不同首頁。若實作「在 App 內切回桌面版」，則 guard 須一併檢查 `preferDesktopOnMobile`（見 §3.4），為 `true` 時不 redirect 到 `/mobile`。

3. **手機版路由與 Layout**  
   註冊 `/mobile`、`/mobile/p/:projectId` 及各子路徑；實作 `MobileLayout.vue`（Header + Tab Bar + `<router-view />`），子路由先接空白或佔位頁。若要做「切回桌面版」，在 Header 或選單內加入「使用完整版網站」按鈕，並在桌面版（手機裝置時）提供「切回手機版」。

4. **專案選擇**  
   實作 `/mobile` 無 projectId 時的專案選擇頁（或從 Store 取上次使用專案並 redirect）；選後導向 `/mobile/p/:projectId/inspection`。

5. **四個功能頁**  
   依序實作自主檢查、施工日誌、缺失改善、報修的手機 View；先接既有 API（帶 `projectId`），再視需要共用或抽離元件。

6. **離線佇列與同步**  
   實作 `offlineQueue` store、IndexedDB 持久化、`online` 時同步；表單送出改為經由佇列（離線寫入、連線送出）。

7. **iOS 安裝提示與體驗**  
   在非 standalone 的 iOS 上顯示「加入主畫面」說明；檢查安全區域、字級、觸控目標與主題色。

---

## 九、與後端／API 的關係

- 手機版與桌面版**共用同一組 API**（同 host、同認證）。
- 所有需專案脈絡的 API 皆帶 `projectId`（query 或 body），與現有桌面版一致。
- 若後端未來要區分「來自手機 App」的請求，可加 Header（例如 `X-App-Mode: mobile`），非必須。

---

## 十、風險與注意事項

| 項目 | 說明 |
|------|------|
| **Router 初始化** | 不在 `createRouter` 時依裝置只註冊一組 route；改為兩組都註冊、用 guard 導向，避免 hydration 與直接輸入 URL 時行為不一致。 |
| **認證** | 手機與桌面共用同一登入流程與 token；PWA 關閉再開仍須在 token 有效期内，過期後導回登入。 |
| **離線衝突** | 若同一筆資料在離線時被多人修改，同步時可能需後端支援版本或衝突處理策略。 |
| **快取** | Workbox 快取策略需與 API 語意一致（例如 GET 可快取、POST 不寫入快取，僅佇列）。 |

---

## 十一、參考：Claude 建議對照

本規劃已納入並調整以下重點：

- 使用 **vite-plugin-pwa**、manifest `display: standalone`、`start_url: '/mobile'`。
- **useDevice** 判斷 PWA／手機並導向 `/mobile`。
- 手機版**獨立 Layout + Tab Bar**，四個功能為自主檢查、缺失改善、報修、施工日誌。
- **離線佇列**（Store + IndexedDB）+ 連線後同步。
- **iOS 安裝提示**元件。
- **專案在 URL**（方案 B）為本文件建議，以支援深連結並與現有專案脈絡一致；若希望第一版極簡，可先做方案 A 再演進。

---

以上為 PWA 手機查驗 App 的架構規劃與分析，可依此文件依序實作並在實作中微調路由與 UI 細節。
