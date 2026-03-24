# 進階資料表工具列與架構指南

本文說明如何做出類似 **shadcn/ui「Tasks」範例** 的表格體驗（搜尋、分面篩選、多欄排序、欄位顯示），在 **shadcn-vue** 下應搭配哪些元件，以及本專案目前表格「分散在各 View」時是否該重構、怎麼優化。

---

## 一、參考 UI 功能拆解

| 區塊 | 行為 | 與 TanStack Table 的關係 |
|------|------|---------------------------|
| **搜尋**（如「Search titles…」） | 單一文字篩選，通常對「標題／名稱」欄 | `columnFilters` + 該欄 `filterFn`（常為 `includesString`），或自訂 `globalFilter` |
| **分面篩選**（Status、Priority…） | 多選、選項旁顯示 **count**、觸發器上顯示已選 **Badge** | 每個維度一個欄位 filter，值型別多為 `string[]`；count 需從「目前資料列」或「後端聚合」算出 |
| **日期篩選**（Created At） | 選日期區間或單日 | 欄位 filter 用 `{ from?, to? }` 或 timestamp；UI 用 **Calendar**（常放 **Popover**） |
| **Reset** | 清空搜尋與所有篩選 | 重設 `columnFilters`、`globalFilter`、必要時 `sorting` |
| **Sort**（含數字角標） | 可 **多規則排序**、可拖曳優先順序 | TanStack 內建 `SortingState` 為 **陣列** 即多欄排序；拖曳需 UI 層維護陣列順序（如 `vuedraggable`） |
| **View** | 搜尋欄位名稱 + 勾選顯示／隱藏 | `columnVisibility`；進階版用 **Command** 做「Search columns…」 |

**重點**：畫面上的「faceted」若要做到 **count 會隨其他篩選變動**，資料必須是「在套用其他 filter 後的列集合」上計算；全端分頁時通常要 **後端回傳 facet 統計** 或 **一次載入完整資料** 才能在客戶端正確聯動。

---

## 二、建議使用的 shadcn-vue 元件

下列對應 [shadcn-vue 元件清單](https://www.shadcn-vue.com/docs/components)；**尚未安裝的請用 CLI 新增**（專案規範：`npx shadcn-vue@latest add <元件名>`），勿手改 `ui/*` 的 CVA 基底。

### 2.1 本專案已具備（可直接沿用）

| 用途 | 元件 |
|------|------|
| 表格骨架 | `Table`、`TableHeader`、`TableBody`、`TableRow`、`TableCell`…（`@/components/ui/table`） |
| 工具列按鈕 | `Button`、`ButtonGroup` |
| 搜尋框 | `Input` |
| 下拉選單（簡易欄位切換） | `DropdownMenu`、`DropdownMenuCheckboxItem` 等 |
| 分面選項勾選 | `Checkbox` |
| 觸發器上的標籤／數量 | `Badge` |
| 區隔線 | `Separator` |
| 排序／欄位選單內的選項 | `Select`（欄位 id、asc/desc） |

目前 **`DataTableViewOptions.vue`** 已用 `DropdownMenu` + `DropdownMenuCheckboxItem` 做欄位顯示，但**沒有**「Search columns…」的 **Command** 體驗。

### 2.2 要做到參考圖等級時建議新增

| 用途 | 元件 | 說明 |
|------|------|------|
| 分面篩選／日期／進階 Sort 面板 | **Popover** | 點按鈕展開浮層，比 Dropdown 更好塞複雜版面 |
| 選項列表內搜尋（Status、Priority、欄位名稱） | **Command**（`CommandInput`、`CommandList`、`CommandItem`、`CommandGroup`） | 與 React 版 Tasks 範例同一套路 |
| 日期篩選 | **Calendar**（+ Popover） | 需一併確認專案是否已有 `calendar`；沒有則 `shadcn-vue add calendar` |
| 觸發鈕樣式（虛線框、+ 圖示） | 現有 `Button` + `variant`／`class` 覆寫即可，必要時加 **cn** 組合 class |

### 2.3 多規則排序列「拖曳」

| 選項 | 說明 |
|------|------|
| **vuedraggable**（`vuedraggable@next`） | 與 Vue 3 相容，用於 Sort 面板內重排 `SortingState` 陣列 |
| 僅「上下箭頭」調順序 | 不必拖曳套件，用 Button + 交換陣列元素即可 |

### 2.4 建議的元件組合（對照參考圖）

- **分面篩選觸發器**：`Button`（outline／自訂 dashed）+ 圓形 **Plus** 圖示（`lucide-vue-next`）+ `Separator` + **Badge**（已選值）
- **分面下拉內容**：`Popover` → `Command` → 每列 `Checkbox` + 圖示 + 文字 + 右側 count
- **Reset**：`Button` variant `ghost` + `X` 圖示
- **Sort 按鈕**：`Button` + 角標 **Badge**（`sorting.length`）
- **Sort 面板**：`Popover` 內多列 `Select`（欄位）+ `Select`（Asc/Desc）+ 刪除鈕 + 拖曳 handle
- **View**：`Popover` 或 `DropdownMenu` + **Command**（搜尋欄位）+ `DropdownMenuCheckboxItem` 或 Command 內可勾選列

---

## 三、資料流與後端分頁的注意事項

本專案多數列表頁是 **`GET ...?page=&limit=`**，資料只有「當頁」，與 shadcn **Tasks 全客戶端** 範例不同。

| 模式 | 搜尋／篩選／排序 | Facet count |
|------|------------------|-------------|
| **客戶端**（一次載入全部或大量列） | `getFilteredRowModel`、`getSortedRowModel` 等即可 | 用 `table.getFilteredRowModel().rows` 或 `table.getPreFilteredRowModel()` 依需求計算 |
| **伺服端分頁**（現況常見） | 篩選／排序參數應反映在 **API query**，`useVueTable` 常只保留 `manualPagination: true`，排序用 `onSortingChange` 觸發重新 `fetch` | 若要有精準 count，需 **API 回傳各狀態筆數**（aggregation），或接受「僅全客戶端列表」才顯示 count |

**實務建議**：先決定該列表是「重表格互動」還是「重後端效能」。重互動且資料量可控 → 可考慮客戶端或虛擬捲動；重效能 → 工具列上的每個動作都應對應到 **query 參數** 與後端契約。

---

## 四、本專案現況與「分散」是否為問題

### 4.1 現況摘要

- 已共用：**`DataTablePagination`**、部分頁使用 **`DataTable`** + **`DataTableToolbar`** + **`DataTableColumnHeader`**（例如監測指標）。
- **`DataTableToolbar`** 目前僅：**單一 `Input` 篩選一欄** + **`DataTableViewOptions`**（無 Command、無分面、無 Reset、無獨立 Sort 面板）。
- 許多 View **在頁面內自建** `useVueTable`、`ColumnDef`、`FlexRender`、`<Table>` 結構，與 **`DataTable.vue` 封裝並行**，因此會感覺「分散」。

### 4.2 分散是否「有差」？

- **不一定壞**：每個領域列表的欄位、API、批次操作差異大，強行塞進單一「萬用表格元件」容易變成 props 地獄。
- **值得收斂的訊號**：同樣的 toolbar 區塊複製貼上三次以上、篩選／排序狀態與 URL query 同步邏輯重複、視覺與 UX 不一致。

### 4.3 建議的優化方向（漸進式）

1. **保留 View 內的「網域邏輯」**（載入資料、dialog、權限、路由 `projectId`），不要把整頁塞進一個元件。
2. **抽出「純展示＋TanStack 接線」層**（可選）：
   - `useDataTableState()`：`sorting`、`columnFilters`、`columnVisibility`、`rowSelection` + `valueUpdater`。
   - `DataTableShell.vue`：只負責 `Table` 渲染與 `FlexRender`（接收已建立好的 `table`）。
3. **擴充共用工具列**（優先）：
   - **`DataTableToolbarShell.vue`**：已定案實作——**`#filters` slot** 放各頁自訂的搜尋／分面／日期；內建 **flex-1 間隔**、**重設**（`hasActiveFilters` + `@reset`）、**多欄排序**、**欄位顯示（Command）**、最後 **`#actions`**（**新增／上傳／建立** 與批次區放此，整列最右；主要 CTA 建議 **`size="sm"`**）。既有簡易版仍為 **`DataTableToolbar.vue`**（單欄搜尋 + 舊版欄位選單）。完整約定見 **`docs/data-table-list-views.md`**。
   - **`DataTableFacetedFilter.vue`**、**`DataTableMultiSortPopover.vue`**、**`DataTableColumnVisibilityCommand.vue`** 等可與 Shell 組合使用。
   - 升級 **`DataTableViewOptions.vue`**（可選）：可改為 Command 搜尋欄位名（與參考圖一致）；進階頁已改用 `DataTableColumnVisibilityCommand`。
4. **目錄約定**（建議）：

```text
src/components/common/data-table/     # 跨頁共用 UI
src/views/<domain>/columns/             # 該頁專用 ColumnDef（可選）
src/composables/useXxxListQuery.ts      # API + query 參數同步（可選）
```

5. **與 UI 規範對齊**：多選工具列仍遵守 **`ui-ux-principles.mdc`**（篩選在左、已選與 ButtonGroup 在右等）；新 toolbar 的 **Reset／Sort／View** 應與既有篩選列同一條 flex 規則，避免破版。

---

## 五、實作步驟建議（里程碑）

1. **安裝缺少的 shadcn-vue 元件**：`popover`、`command`、（若要做日期）`calendar`。
2. **先做一個「全客戶端」示範頁或 Story**：固定 `data` 陣列，接上 faceted filter + multi-sort + view options，驗證互動與深色模式（**`theme-support.mdc`**）。
3. **把 FacetedFilter／SortPanel 抽成元件**，props 明確：`column`、`title`、`options`（含 value、label、icon、count）、`selectedValues` 與 `onChange`。
4. **若要套用到 API 分頁頁面**：將 `selectedValues`、`sorting` 映射為 query，在 `watch` 或 `useDebounceFn` 後呼叫列表 API；facet count 視後端能力決定是否顯示。
5. **再決定是否重構舊 View**：優先重構「產品上最需要強篩選」的 1～2 頁，避免大爆炸重寫。

---

## 六、總結

- **要做成參考圖那套**：核心是 **TanStack Table 狀態**（filters / sorting / visibility）+ **Popover + Command + Checkbox + Badge + Button**；多排序列再加 **Select** 與可選的 **vuedraggable**。
- **本專案已有基礎**：`DataTable`、`DataTablePagination`、`DataTableColumnHeader`、`DataTableToolbarShell`（進階工具列版型 + slots）、`DataTableToolbar`（精簡版）、`DataTableViewOptions`（簡易版）。
- **表格架構分散**：在大型專案屬常態；**值得做的是抽出重複的 toolbar／faceted／sort 元件與 composable**，而不是強迫所有頁面共用同一支巨型 `DataTable`。伺服端分頁列表需**另外設計 API 契約**，無法直接複製全客戶端 Tasks 範例的行為。

---

## 相關檔案（本 repo）

- **可操作的完整範本頁**（商品報修假資料 150 筆）：專案內路由 `buildProjectPath(projectId, '/repair/product-repair-demo')`，名稱 `ROUTE_NAME.PROJECT_REPAIR_DEMO_TABLE`；實作於 `src/views/repair/ProductRepairDataTableTemplateView.vue`（含分面篩選、日期區間、多欄排序、欄位搜尋顯示、全文搜尋、重設）。
- 共用表格：`src/components/common/data-table/`
- TanStack 版本：`package.json` → `@tanstack/vue-table`
- UI 規範：`.cursor/rules/ui-ux-principles.mdc`、`theme-support.mdc`
- shadcn-vue 新增元件：`.cursor/rules/shadcn-vue-official.mdc`
