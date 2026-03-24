# Sidebar 翻頁式導航 — 評估與調整規劃

依現有架構（`navigation.ts`、`AppSidebar.vue`、`sidebar` store、`routes`、`breadcrumb`）評估新規格，並列出具體調整步驟。主題／顏色規格本文件不處理。

---

## 一、新規格與現有架構對照

### 1.1 層級與「進入點」對應

| 新規格 | 現有對應 | 說明 |
|--------|----------|------|
| **Layer 1**（主畫面） | `GLOBAL_SIDEBAR_ENTRIES` + 後台入口 | 後台管理 → 直接跳 `/admin/*`；專案列表 → **drill 進 Layer 2**（不是跳 `/projects`，而是顯示「某專案底下的選單」前需先選專案） |
| **Layer 2**（專案內第一層） | 目前無此層；現有是進專案後直接看到 `PROJECT_SIDEBAR_GROUPS` | 需新增：進入方式為「從 Layer 1 點專案列表後，先選專案再出現 Layer 2」或「從 Layer 1 點專案列表 = 進 `/projects`，在專案列表頁選某專案後 = 進入該專案，此時 sidebar 顯示 Layer 2」 |
| **Layer 3-A/B/C** | `PROJECT_SIDEBAR_GROUPS` 拆成三塊 | 專案管理 = 總覽/WBS/甘特/資源/排班/風險/工期調整；施工管理 = 監測/上傳/設備/自主檢查/施工日誌/缺失改善/照片；報修管理 = 總覽/報修紀錄 |

**重要約定（需在實作前定案）**：

- **Layer 2 的 scope**：是「當前已選專案」下的選單（即 URL 已是 `/p/:projectId/...`）。  
  亦即：使用者流程為 **Layer 1 專案列表 → 點某專案 → 跳轉 `/p/:projectId/dashboard`（或首個子頁）→ 此時 Sidebar 顯示 Layer 2**。
- 因此「專案列表」在 Layer 1 的行為建議為：**點擊後導向 `/projects`**（與現有一致），在專案列表頁選專案後由 router 進入 `/p/:projectId/...`，**一進入專案內，Sidebar 就顯示 Layer 2 panel**（不是 Layer 1）。  
  亦即：**Layer 1 僅在「未進專案」時顯示**（`/projects`、未選專案）；**一但有 projectId，Sidebar 直接顯示 Layer 2**。

### 1.2 新規格項目與現有 path 對照

以下用「新規格名稱 → 現有 path（或備註）」對齊，方便改 `navigation` 與 breadcrumb。

**Layer 2（專案內第一層）**

| 新規格項目 | 現有 path / 備註 |
|------------|------------------|
| 契約管理 | `/contract/*` 整塊，或單一「契約管理」頁 → `contract/management`，其餘放子層或保留在契約群組 |
| 專案基本資料 | `/contract/project-info` 或 dashboard；若「專案基本資料」= 儀表板+大事記+里程碑，則需對應到 `/dashboard`、`/overview/events`、`/overview/milestones` |
| [group] 工作執行 | 純 label，不可點擊 |
| 專案管理（drill） | → Layer 3-A |
| 施工管理（drill） | → Layer 3-B |
| 報修管理（drill） | → Layer 3-C（若尚無路由可先留 id，之後補） |
| 檔案管理 | `/files` |
| 相關表單 | `/files/forms` |

**Layer 3-A（專案管理）**

| 新規格 | 現有 path |
|--------|-----------|
| 總覽 | `/management/overview` |
| WBS清單 | `/management/wbs` |
| 甘特圖 | `/management/gantt` |
| 資源庫 | `/management/resources` |
| 排班表 | `/management/schedule` |
| 風險與議題 | `/management/risks` |
| 工期調整 | `/contract/schedule` |

**Layer 3-B（施工管理）**

| 新規格 | 現有 path |
|--------|-----------|
| 監測數據 | `/monitoring/history` |
| 數據上傳 | `/monitoring/upload` |
| 設備管理 | `/monitoring/devices` |
| 自主檢查 | 若無則新路由 |
| 施工日誌 | 若無則新路由 |
| 缺失改善 | 若無則新路由 |
| 照片管理 | `/files/photos` |

**Layer 3-C（報修管理）**

| 新規格 | 現有 path |
|--------|-----------|
| 總覽 / 報修紀錄表 | 若無則新路由或 placeholder |

**目前未在新規格中明確對應的現有項目**

- 概況：儀表板、大事記、里程碑 → 建議歸在「專案基本資料」或單獨一項「概況」在 Layer 2 點擊後跳轉（或子頁）。
- 契約底下的「專案資訊、工期調整、契約管理、專案成員」→ 規格中「契約管理」「專案基本資料」「工期調整」需對應到這些 path。
- 監測的「報表」→ 規格未寫，可放在 Layer 3-B「施工管理」底下。

---

## 二、需要動到的檔案與職責

| 檔案 | 調整內容 |
|------|----------|
| `src/constants/navigation.ts` | 改為「分層」結構：Layer 1 條目、Layer 2 條目（含 group label + 三個 drill 項）、Layer 3-A/B/C 各自子項；可新增型別如 `NavLayer2Item`（葉節點 path / 子層 panelId）。 |
| `src/types/navigation.ts` | 新增「可 drill 的項目」型別（如 `panelId: 'project-mgmt' | 'construction' | 'repair'`）、group label 型別；必要時擴充 `NavItemProject` 為「path 或 panel」。 |
| `src/stores/sidebar.ts` | 新增 `currentPanel`、`panelHistory`、`drillIn(panelId)`、`drillOut()`；可選：由 `route.path` 推算初始 panel 並在進入專案時 set。 |
| `src/components/common/AppSidebar.vue` | 重構為多 panel（Layer 1 / Layer 2 / Layer 3-A/B/C），每個 panel 一個區塊；`v-show` + CSS transition（translateX + opacity）；Layer 2 頂部「← 主畫面」呼叫 `drillOut` 回 Layer 1；Layer 3 頂部「← 主畫面」呼叫 `drillOut` 回 Layer 2；點葉節點用 `router.push(buildProjectPath(projectId, pathSuffix))`。 |
| `src/constants/routes.ts` | 若新增「自主檢查／施工日誌／缺失改善／報修」等 path，在此加常數；其餘可不改。 |
| `src/router/index.ts` | 僅在新增上述新頁時加 route。 |
| `src/constants/breadcrumb.ts` | 可維持現有 `BREADCRUMB_PROJECT_SUFFIX_LABELS`；若要做「工作執行 › 施工管理 › 施工日誌」三層，需在 `useBreadcrumb` 或新常數中增加「path → 所屬模組（工作執行 / 專案管理 / 施工管理 / 報修管理）」的對應。 |
| `src/composables/useBreadcrumb.ts` | 專案內路徑時，若要有「工作執行 › 施工管理 › 頁名」，需依 path 對應到模組名再組出多段。 |
| `src/layouts/DefaultLayout.vue` | 側欄寬度若固定為 210px，改 `md:w-56` 為 `md:w-[210px]`（或用 CSS 變數）；collapsed 時邏輯保留。 |

**不需改動**

- 各 View 元件、API、`buildProjectPath` 的用法；僅導航與 sidebar 呈現方式改變。

---

## 三、建議實作順序

### Phase 1：資料層與型別

1. **`src/types/navigation.ts`**  
   - 定義 `SidebarPanelId = 'root' | 'project-list' | 'project-mgmt' | 'construction' | 'repair'`。  
   - 定義 Layer 2 項目：`NavLayer2Item = { type: 'link'; pathSuffix: string; ... } | { type: 'group'; label: string } | { type: 'drill'; panelId: SidebarPanelId; ... }`。  
   - Layer 3 沿用類似現有 `NavItemProject[]`（pathSuffix + label + icon）。

2. **`src/constants/navigation.ts`**  
   - 匯出 **Layer 1 條目**（後台管理、專案列表）：後台管理 path `/admin/projects`（或首個後台頁），專案列表 path `/projects`；專案列表可標記「點擊後不 drill，直接跳轉」，進入專案後由 layout 決定顯示 Layer 2。  
   - 匯出 **Layer 2 條目**（依規格順序）：契約管理、專案基本資料、[group 工作執行]、專案管理(drill)、施工管理(drill)、報修管理(drill)、檔案管理、相關表單；每個對應 pathSuffix 或 panelId。  
   - 匯出 **Layer 3-A/B/C** 三個陣列，內容為對應的 pathSuffix + label + icon（與現有 `PROJECT_SIDEBAR_GROUPS` 拆開對齊）。

3. **`src/stores/sidebar.ts`**  
   - 新增 `currentPanel: ref<SidebarPanelId | 'root'>`、`panelHistory: ref<(SidebarPanelId | 'root')[]>`。  
   - 新增 `drillIn(panelId: SidebarPanelId)`（push current 進 history，再 set currentPanel）、`drillOut()`（pop history 設回 currentPanel）。  
   - 可選：`setPanelFromRoute(path: string)`，依 path 判斷是否在專案內、屬於哪一區塊，設定 `currentPanel` 與 `panelHistory`（用於重整或深連結還原）。

### Phase 2：Sidebar UI

4. **`src/components/common/AppSidebar.vue`**  
   - 外層仍用 `ScrollArea`；內部改為「多個 panel 並排」的容器（例如一層 `div` 包多個 `div.panel`），每個 panel 對應一個 layer（root / project-list 當 Layer 2 用 / project-mgmt / construction / repair）。  
   - **顯示邏輯**：  
     - 未在專案內（無 `projectId`）：只顯示 Layer 1 panel（後台管理、專案列表）。  
     - 在專案內（有 `projectId`）：依 `currentPanel` 顯示 Layer 2 或 Layer 3-A/B/C；Layer 2 顯示「← 主畫面」+ 規格中的 Layer 2 項目；Layer 3 顯示「← 主畫面」+ 顏色點 + 模組名 + badge + 分隔線 + 子項。  
   - 點擊「專案列表」：`router.push('/projects')`，不改變 panel（因為離開專案後會變回 Layer 1）。  
   - 點擊「契約管理」等葉節點：`router.push(buildProjectPath(projectId, pathSuffix))`。  
   - 點擊「專案管理/施工管理/報修管理」：`drillIn('project-mgmt' | 'construction' | 'repair')`。  
   - 「← 主畫面」：`drillOut()`。  
   - 動畫：用 CSS transition（例如 260ms cubic-bezier）控制每個 panel 的 `transform: translateX` 與 `opacity`，使當前 panel 滑入、上一個滑出。

5. **`src/layouts/DefaultLayout.vue`**  
   - 側欄寬度改為 210px（如 `md:w-[210px]`），與規格一致。

### Phase 3：Breadcrumb 與可選還原

6. **`src/constants/breadcrumb.ts`**（可選）  
   - 新增「path 後綴 → 所屬模組」對應，例如：  
     `pathSuffix` 屬於 `/management/*` → 模組名「專案管理」；`/monitoring/*`、`/files/photos` 等 →「施工管理」；報修 path →「報修管理」。  
   - 用於組成「工作執行 › 施工管理 › 施工日誌」。

7. **`src/composables/useBreadcrumb.ts`**  
   - 專案內路徑時，若 path 落在某個模組，則在「專案名稱」與「頁名」之間插入「工作執行」、「模組名」兩段（依規格格式）。

8. **Route 同步 panel（可選）**  
   - 在 `AppSidebar.vue` 或 layout 內 `watch(route.path)`：當進入 `/p/:projectId/management/...` 時設 `currentPanel = 'project-mgmt'` 並適當設定 `panelHistory`；同理施工、報修。這樣重整或深連結時 sidebar 會停在正確層級。

---

## 四、與現有行為的差異整理

| 項目 | 現有 | 新規格後 |
|------|------|----------|
| 專案內 sidebar | 一次展開所有群組（概況、監測、契約、檔案、管理） | 先顯示 Layer 2（契約、專案基本資料、工作執行群組、專案/施工/報修 drill、檔案、相關表單），點「專案/施工/報修」再進 Layer 3。 |
| 後台 / 專案列表 | 與專案內項目混在同一層（依 route 切換整塊內容） | Layer 1 僅兩項：後台管理、專案列表；進入專案後為 Layer 2。 |
| 寬度 | `md:w-56`（224px） | 210px。 |
| 動畫 | 無 | 260ms translateX + opacity 滑入滑出。 |
| 返回 | 專案內有「切換專案」回 `/projects` | Layer 2/3 頂部「← 主畫面」僅做 drillOut，不負責跳轉；回專案列表仍靠「切換專案」或從 Layer 1 點專案列表再選。 |

---

## 五、小結

- **路由與 path 不變**：仍為 `/p/:projectId/...`，僅 sidebar 的「分層」與「翻頁」行為改變。  
- **必改**：`navigation.ts`（分層資料）、`types/navigation.ts`（型別）、`sidebar` store（panel + history）、`AppSidebar.vue`（多 panel + 動畫 + 點擊行為）。  
- **可選**：breadcrumb 三層顯示、依 route 還原 panel、新增「自主檢查／施工日誌／缺失改善／報修」等路由。  
- 實作前建議先定案：Layer 2 是否包含「專案基本資料」以及其對應 path（dashboard vs contract/project-info），以及「概況」三項要併入哪裡，再開始改 `navigation.ts` 與 Sidebar。
