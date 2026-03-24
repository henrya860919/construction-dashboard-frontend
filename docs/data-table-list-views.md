# 列表頁資料表規範（Client-side TanStack Table）

本文件與 **`.cursor/rules/data-table-list-views.mdc`** 一致；新增或改版「專案內列表＋表格＋分頁」時請遵守。

## 目標

- **單一真相**：欄位定義一律為 `ColumnDef[]`；搜尋、分面篩選、欄位顯示名稱由 **`columnDef.meta`**（與 `id`／`accessorKey`）驅動，避免欄位與工具列各寫一份。
- **三區工具列**（可視頁面需求開關，見 `TableListFeatures`）：
  1. **搜尋**：全文篩選（`globalFilter` + `globalFilterFn`）。
  2. **篩選與排序**：`meta.filter` 自動產生分面／日期篩選；表頭排序與多欄排序。
  3. **欄位顯示**：欄位顯示開關（`enableHiding`、操作欄／勾選欄設 `enableHiding: false`）。

## 必用元件與 composable

| 用途 | 路徑 |
|------|------|
| 型別與 ColumnMeta 擴充 | `src/types/data-table.ts` |
| 表格狀態（篩選／排序／分頁／選取） | `useClientDataTable` — `src/composables/useClientDataTable.ts` |
| 工具列（搜尋＋依 meta 動態篩選＋重設＋多欄排序＋欄位顯示） | `DataTableFeatureToolbar` |
| 表頭＋表身＋水平捲動（**不含分頁**） | `DataTableFeatureSection`（內建 `Table scroll-container=false`） |
| 分頁 | `DataTablePagination`（無勾選欄時傳 `hide-selection-info`） |
| 可排序表頭 | `DataTableColumnHeader` |

參考實作：**`src/views/files/FileManagementView.vue`**（邊框殼無 `p-4`、無資料仍顯示表＋單列說明、分頁僅在 `list.length > 0` 且在外殼外）。**`src/views/contract/ProjectMembersView.vue`**（三區全开）。其餘對照見 **`.cursor/rules/data-table-list-views.mdc`**「參考實作」。

## 工具列：新增／上傳／建立（位置與尺寸）

凡使用 **`DataTableFeatureToolbar`**（內用 **`DataTableToolbarShell`**）的列表頁，**每個 table** 的主要建立動作請遵守：

1. **放進 `#actions`**，不要放進 `#filters`、也不要在頁面裡另拼一條擋在排序／欄位顯示左側。
2. **`DataTableToolbarShell` 由左到右**（篩選區與右側之間有 `flex-1` 間隔）：`#filters` → 間隔 → **重設**（有作用中篩選／排序時）→ **多欄排序** → **欄位顯示** → **`#actions`**。因此 **「新增／上傳／建立」永遠在整列最右邊**。
3. **按鈕尺寸**：該主要按鈕設 **`size="sm"`**（與工具列 `Input`／ghost 重設的 **`h-8`** 一致）。
4. **列勾選與批次**：有勾選時預設收合篩選／排序／欄位顯示（`collapseWhenRowSelection`）；**「重設」**不應只因勾選而出現（`hasActiveFilters` 不含選取）；**新增**宜在 **無選取** 時顯示、有選取時改顯示批次工具列。參考 **`src/views/contract/ProjectMembersView.vue`**。

手動拼 **`DataTableToolbarShell`**（未走 `DataTableFeatureToolbar`）的頁面，仍應遵守同一 **DOM 順序**，讓主要 CTA 落在排序／欄位顯示之後。

## DataTableFilterPill（工具列單選篩選）

路徑：`src/components/common/data-table/DataTableFilterPill.vue`。

- **觸發鈕**：`PlusCircle` + 標題（`title`）；已選時分隔線 + 選中標籤摘要；樣式與分面篩選膠囊一致（`h-8`、`border-dashed`、`bg-background`）。
- **下拉**：`CommandInput`（預設 placeholder = `title`）→ 分隔線 → 選項列表；選項以 **圓形 radio** 表示單選，**不要**用與多選分面相同的方塊勾選圖示。
- **`options`**：每項 `label`、`value`；可選 **`count`** 顯示在列右側。**僅在**資料列為該維度之完整母體（例如一次載入的全量列表）時傳 `count`；分頁或伺服器依其他條件過濾後的列表**不要**傳，避免錯誤筆數。
- **清除**：選中非「全部」時，列表底部提供「清除此篩選」（回到 `allValue`）。

## 版面與 UX（對齊 ui-ux-principles）

- **說明文字**與 **`DataTableFeatureToolbar`** 放在 **邊框表格外殼之外**，與 **`src/views/files/FileManagementView.vue`** 相同層級關係。
- **邊框表格外殼**：**一層** **`rounded-lg border border-border bg-card`**；**勿**加 **`p-4`**。
- **載入完成後**一律顯示表格（**`DataTableFeatureSection`** 或手動 **`Table`**）：**無資料**時表身以**單列**（**`emptyText`** 或 colspan）顯示說明，**勿**用整塊空狀態取代表格。
- **`DataTablePagination`**：**僅在列表確有資料時**渲染（例 **`!loading && list.length > 0`**）；放在**邊框殼 `</div>` 之後**的兄弟節點，**`class="mt-4"`**，**勿**包在邊框殼內。
- 寬表：水平捲動發生在 **`DataTableFeatureSection`** 外層（`min-w-0 overflow-x-auto`），勿撐出整頁橫向捲動（見 **`table-scroll-layout.mdc`**）。
- 第一欄勾選、操作收合在「更多」下拉（本頁維持既有列操作元件）。

## ColumnDef 約定

1. **`id`**：穩定字串，供 `COLUMN_LABELS`、欄位顯示、篩選欄位鍵使用。
2. **`meta.label`**：中文欄位名（給「欄位顯示／多欄排序」）；未設時後端 UI 可能 fallback `id`。
3. **`meta.searchable`**：僅文件與實作提醒；實際搜尋欄位由 **`globalFilterFn`** 實作。
4. **`meta.filter`**：
   - `{ type: 'faceted', title, options }` → 工具列自動掛 `DataTableFacetedFilter`；欄位需 `filterFn: 'arrIncludesSome'`（或自訂等價行為）。
   - `{ type: 'dateRange', title }` → 自動掛 `DataTableDateRangeFilter`；欄位需自訂 `filterFn` 解析 `{ from?, to? }`。
5. **勾選欄／操作欄**：`enableSorting: false`、`enableHiding: false`。
6. **分面篩選**：僅對**可見**欄位顯示篩選鈕（工具列已依 `column.getIsVisible()` 過濾）。

## useClientDataTable

- 傳入 **`features: TableListFeatures`** 以對應三區開關（關閉時內部會關掉對應 table 能力）。
- **`globalFilterFn`**：在 `features.search === true` 時應實作（至少涵蓋姓名、主旨等該頁宣告可搜尋欄位）。
- **`enableRowSelection`**：無勾選欄時設為 `false`，並在 **`DataTablePagination`** 設 **`hide-selection-info`**（勿傳給 `DataTableFeatureSection`）。

## 主題

- 工具列與表格僅使用語意化 token（`text-foreground`、`border-border` 等），見 **`theme-support.mdc`**。
