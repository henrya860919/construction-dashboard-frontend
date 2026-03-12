# Construction Dashboard 頁面架構 — 實作順序與執行指南

本文件說明**建議的執行順序**與**各階段需要的東西**，方便依序開發、減少返工。

---

## 一、整體執行順序概覽

```
Phase 0：前置準備（依賴與常數）
    ↓
Phase 1：Layout 骨架（Header + Sidebar + 響應式）
    ↓
Phase 2：儀表板頁面骨架（路由、Tabs、區塊佔位）
    ↓
Phase 3：核心 UI 元件與 KPI 區塊
    ↓
Phase 4：圖表與數據區塊
    ↓
Phase 5：警報、表單、互動與優化
```

---

## 二、Phase 0：前置準備

**目標**：裝齊 shadcn-vue 元件、補齊常數與型別，後續階段才不會缺東缺西。

### 執行順序

| 步驟 | 動作 | 說明 |
|------|------|------|
| 0.1 | 安裝 shadcn-vue 元件 | 用 CLI 一次裝齊，避免之後邊做邊裝 |
| 0.2 | 路由常數擴充 | 儀表板、監測、施工子路徑（若採子路由） |
| 0.3 | 型別定義 | 儀表板 KPI、警報、圖表資料的 TypeScript 型別 |

### 需要的東西

**0.1 需安裝的元件（建議一次執行）**

```bash
npx shadcn-vue@latest add card tabs progress badge sheet scroll-area tooltip dropdown-menu dialog select input
```

- **Layout / 導航**：`sheet`、`scroll-area`、`tooltip`、`dropdown-menu`
- **內容區**：`card`、`tabs`、`progress`、`badge`
- **互動**：`dialog`、`select`、`input`（`button` 已有）

**0.2 常數**

- 在 `src/constants/routes.ts` 預留或新增：
  - `DASHBOARD`、`DASHBOARD_MONITORING`、`DASHBOARD_EXECUTION`、`PROJECTS` 等 path/name
- 若有側欄選單項目，可加 `src/constants/navigation.ts`（id、label、path、icon）

**0.3 型別（可隨 Phase 3/4 再補）**

- `src/types/dashboard.ts`（或 `api.ts` 內）：專案資訊、進度、預算、警報、環境數據、圖表 series 等

**產出**

- `src/components/ui/` 下多個元件可用
- 常數與型別檔就緒，後續 import 路徑固定

---

## 三、Phase 1：Layout 骨架（Header + Sidebar）

**目標**：DefaultLayout 拆成 Header、Sidebar、Main，支援收合與響應式，不包具體業務內容。

### 執行順序

| 步驟 | 動作 | 說明 |
|------|------|------|
| 1.1 | 新增 AppHeader 元件 | 左：logo/專案名 + 選單按鈕；右：使用者、通知等佔位 |
| 1.2 | 新增 AppSidebar 元件 | 導航項目列表，用 ScrollArea 包；收合時只顯示 icon |
| 1.3 | 小螢幕 Sidebar → Sheet | 用 Sheet 包同一份導航內容，由 Header 按鈕開關 |
| 1.4 | 改寫 DefaultLayout | 左 Sidebar + 右側（Header 在上、Main 在下） |
| 1.5 | Sidebar 狀態（可選） | Pinia store 或 provide/inject 存 collapsed、mobileOpen |

### 需要的東西

**1.1 AppHeader**

- 依賴：`Button`、`DropdownMenu`（使用者）、`Badge`（通知數）
- 依賴：lucide-vue-next 圖示（Menu, User, Bell 等）
- 檔案：`src/components/common/AppHeader.vue`（或 `layouts/` 下）

**1.2 AppSidebar**

- 依賴：`ScrollArea`、`Button`（variant ghost）、`Tooltip`（收合時）、導航常數
- 依賴：lucide-vue-next（LayoutDashboard, Activity, HardHat 等）
- 檔案：`src/components/common/AppSidebar.vue`
- 導航項目用 `constants/navigation.ts`；Sidebar 元件結構（SidebarProvider、Sidebar、SidebarHeader/Footer/Content/Group、SidebarTrigger）與本專案對應方式見 **[docs/sidebar.md](./sidebar.md)**。

**1.3 響應式**

- 斷點：例如 `md:` 以上顯示 Sidebar，以下改為 Sheet
- Header 左側按鈕：大螢幕切換 Sidebar 收合，小螢幕打開 Sheet

**1.4 DefaultLayout 結構**

- 左：`<AppSidebar />`（或包在 Sheet 裡）
- 右：`<header><AppHeader /></header>` + `<main><RouterView /></main>`
- 用 flex 或 grid 讓 Main 填滿剩餘空間

**產出**

- 有 Header、Sidebar、可收合、手機用 Sheet，主內容區為 `<RouterView />`

---

## 四、Phase 2：儀表板頁面骨架

**目標**：儀表板路由、Tabs（監測數據 / 施工執行）、區塊佔位，先不接真實資料與圖表。

### 執行順序

| 步驟 | 動作 | 說明 |
|------|------|------|
| 2.1 | 路由設定 | `/dashboard` 或 `/` 對應儀表板 view，可選子路由 monitoring/execution |
| 2.2 | DashboardView 骨架 | 上方 KPI 區塊（3 個 Card 佔位）、下方 Tabs |
| 2.3 | Tabs 內容佔位 | 「監測數據」與「施工執行」底下各放幾個空 Card，標題為主 |
| 2.4 | 區塊標題與更新時間 | 每個區塊有標題列，可含「更新時間」文案佔位 |

### 需要的東西

**2.1 路由**

- `router/index.ts`：DefaultLayout 的 children 加上 dashboard（及可選 monitoring、execution）
- 若用 Tabs 不換路由：一個 route 對應一個 DashboardView 即可

**2.2 DashboardView**

- 依賴：`Card`、`Tabs`
- 檔案：`src/views/DashboardView.vue`（或 `Dashboard/Index.vue`）
- 上：三塊 Card（專案資訊、整體進度、預算執行）只放標題與假數字
- 下：`Tabs` 兩項，內容區用 Card 佔位

**2.3 區塊標題**

- 每個 Card 內：標題 + 可選「更新時間: …」、可選「+ 新增進度數據」按鈕佔位

**產出**

- 進入儀表板可看到 KPI 三卡、Tabs 切換、區塊標題與佔位，無真實資料與圖表

---

## 五、Phase 3：核心 UI 與 KPI 區塊

**目標**：KPI 卡內容真實化、Progress 與 Badge 使用方式固定、可接 API 或 mock。

### 執行順序

| 步驟 | 動作 | 說明 |
|------|------|------|
| 3.1 | 專案資訊卡 | 累計天數、開工/預定完工日，資料來自 props 或 composable |
| 3.2 | 整體進度卡 | 大數字 %、計畫/實際進度、Progress 條 |
| 3.3 | 預算執行卡 | 已執行/核定預算、執行率 %、Progress 條 |
| 3.4 | 可選：KpiCard 共用元件 | 標題 + 主數值 + 副文案 + 可選 Progress，減少重複 |

### 需要的東西

**3.1–3.3**

- 依賴：`Card`、`Progress`、型別（專案資訊、進度、預算）
- 資料：可先寫 mock 物件，或從 `useDashboard()`、`useProjectInfo()` 等 composable 取得
- API：若後端就緒，在 composable 內呼叫 `api.getDashboard()` 等

**3.4 KpiCard（可選）**

- 檔案：`src/components/dashboard/KpiCard.vue`
- Props：title, value, subtitle?, progress?, unit? 等，方便三張 KPI 卡共用

**產出**

- 三張 KPI 卡顯示正確欄位與 Progress，資料來源統一（mock 或 API）

---

## 六、Phase 4：圖表與數據區塊

**目標**：施工進度趨勢、環境監測、水位趨勢、人力/設備/安全等圖表與數據區塊上線。

### 執行順序

| 步驟 | 動作 | 說明 |
|------|------|------|
| 4.1 | 圖表用 Card 外框 | 每個圖表一 Card，標題列含更新時間、可選按鈕 |
| 4.2 | 施工進度趨勢（折線圖） | vue-echarts 線圖，預定/實際/請款進度，x 軸時間 |
| 4.3 | 環境監測數據 | 溫度、濕度、PM2.5 等小卡或網格，數字 + 單位 |
| 4.4 | 水位 24h 趨勢 | vue-echarts 線圖，可標示閾值線 |
| 4.5 | 人力組成 / 設備使用率 / 安全巡查 | 圓餅、橫條、直條圖，依 mockup 配置 |
| 4.6 | 施工項目完成率 | 圓形進度（Progress 或自訂圓形）+ 項目名稱 |

### 需要的東西

**4.1**

- 依賴：`Card`、vue-echarts
- 共用的圖表外框可做成 `ChartCard.vue`（title, updateTime?, 預設 slot 放 echarts）

**4.2–4.6**

- 依賴：vue-echarts、echarts、型別（series、xAxis 等）
- 資料：mock 或 API，格式與型別一致，方便之後換成真實 API
- 若有多個圖表，可拆成 `ProgressTrendChart.vue`、`WaterLevelChart.vue` 等，在 DashboardView 裡組裝

**產出**

- 儀表板所有圖表與數據區塊都有外框與標題，圖表有資料（mock 或 API）

---

## 七、Phase 5：警報、表單、互動與優化

**目標**：警報專區、新增/編輯表單、篩選、權限與體驗優化。

### 執行順序

| 步驟 | 動作 | 說明 |
|------|------|------|
| 5.1 | 警報專區 | 熱危害、空污、水位等 Card + Badge（警報/注意）+ 圖示與文案 |
| 5.2 | 新增/編輯進度數據 | 「+ 新增進度數據」開 Dialog，表單用 Input、Select、DatePicker、Button |
| 5.3 | 篩選與查詢 | 日期區間、專案、類型等 Select/Input + 查詢 Button，影響圖表與列表 |
| 5.4 | 權限與導航 | Sidebar 依角色顯示項目；按鈕級用 v-if 或 Can 元件 |
| 5.5 | 載入與錯誤 | 圖表/卡片的 loading、error 狀態，統一用 composable 或元件 |

### 需要的東西

**5.1 警報**

- 依賴：`Card`、`Badge`、lucide-vue-next（Flame, Cloud, Droplets 等）
- 資料：警報等級、數值、建議措施等型別與 API/mock

**5.2 表單**

- 依賴：`Dialog`、`Input`、`Select`、`Button`，可選 DatePicker
- 表單驗證：可沿用專案內 Zod 或手寫規則
- API：送出後呼叫後端，成功關閉 Dialog 並刷新列表/圖表

**5.3 篩選**

- 依賴：`Select`、`Input`、`Button`
- 狀態：篩選條件存 Pinia 或 component state，傳給 composable 或 API 參數

**5.4 權限**

- 路由 meta.roles、Sidebar 過濾、按鈕 v-if 依 store 或 useAuth 的 role

**5.5 載入/錯誤**

- 共用 Loading 元件、錯誤訊息區塊或 Toast，資料層在 composable 內處理 loading/error

**產出**

- 警報區可顯示、表單可送出、篩選可作用、權限與載入/錯誤有基本處理

---

## 八、依賴關係總表（何時需要什麼）

| 階段 | 需要先完成 | 本階段會產出 |
|------|------------|--------------|
| Phase 0 | 無 | 元件庫、常數、型別 |
| Phase 1 | Phase 0（至少 sheet, scroll-area, dropdown-menu, button） | Header、Sidebar、Layout |
| Phase 2 | Phase 1、card、tabs | 儀表板路由、Tabs、佔位區塊 |
| Phase 3 | Phase 2、progress、型別 | KPI 三卡、可選 KpiCard |
| Phase 4 | Phase 2、vue-echarts、型別 | 所有圖表與數據區塊 |
| Phase 5 | Phase 3–4、dialog、select、input、badge | 警報、表單、篩選、權限、載入/錯誤 |

---

## 九、建議的檔案結構（參考）

```
src/
├── components/
│   ├── common/          # AppHeader, AppSidebar, AppBreadcrumb
│   ├── dashboard/       # KpiCard, ChartCard, 警報卡、圓形進度等
│   └── ui/              # shadcn-vue 元件
├── composables/         # useDashboard, useProjectInfo, useAuth...
├── constants/
│   ├── routes.ts
│   ├── navigation.ts    # 側欄項目
│   └── breadcrumb.ts    # 麵包屑 path → label 對照
├── layouts/
│   └── DefaultLayout.vue
├── views/
│   ├── DashboardView.vue
│   └── ...
├── types/
│   ├── api.ts
│   └── dashboard.ts     # KPI、警報、圖表
└── stores/              # 若 Sidebar 狀態、篩選條件放 store
```

---

## 十、相關文件

- **Sidebar**：元件結構、本專案實作、檔案與響應式行為，見 [docs/sidebar.md](./sidebar.md)。
- **麵包屑**：架構、資料流、新增路由時如何補 label，見 [docs/breadcrumb.md](./breadcrumb.md)。

---

## 十一、總結：建議的執行順序一句話

1. **Phase 0**：裝齊元件、補常數與型別。  
2. **Phase 1**：做 Header + Sidebar + Layout，能收合、能響應式。  
3. **Phase 2**：做儀表板路由 + Tabs + 區塊佔位。  
4. **Phase 3**：把 KPI 三卡與 Progress 做實、接資料。  
5. **Phase 4**：把所有圖表與數據區塊做實、接 vue-echarts 與資料。  
6. **Phase 5**：警報、表單、篩選、權限與載入/錯誤。

照這個順序做，每個階段需要的東西都在前一段或 Phase 0 準備好，你只要依文件從 Phase 0 開始執行即可。
