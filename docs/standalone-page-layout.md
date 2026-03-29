# 獨立路由頁版型（整頁詳情／表單）

由列表或其他入口 **`router.push`／`RouterLink`** 進入的**獨立路由頁**（非 `Dialog`／`Sheet` 內嵌），版面與列表頁不同；本文件與 **`.cursor/rules/standalone-page-layout.mdc`** 一致。

**列表頁**仍以 **`docs/data-table-list-views.md`**、**`ui-ux-principles.mdc`** §1.4 為準。

**主題**：僅使用語意化 token（`bg-background`、`text-foreground`、`border-border`、`bg-card`、`text-muted-foreground` 等），見 **`theme-support.mdc`**。

---

## 1. 頁面根節點

| 情境 | 建議 class | 說明 |
|------|------------|------|
| 一般後台內容頁 | `p-4 md:p-6 space-y-6` | 水平／垂直留白；區塊之間用 `space-y-6` 統一節奏 |
| 需吃滿主區高度（影片、儀表、分割版面） | `flex h-full min-h-0 flex-col gap-4` | 見 `MonitoringDeviceDetailView` |

---

## 2. 頁首（返回＋標題＋說明）

從列表進入的頁面應讓使用者清楚**如何回到上一層**與**本頁用途**。

**建議結構（表單／設定類獨立頁）**

- 外層：單一區塊包在 `space-y-6` 的第一個子節點（無需額外 `mb-6` 若根已 `space-y-6`）。
- **返回**（全專案對齊 **`RepairRecordDetailView`**、**`RepairRecordNewView`**、**`AdminElectronicFormBuilderView`** 等）：`Button variant="outline"` + `type="button"`（或 `as-child` 的 `RouterLink`）+ **`class="gap-2"`** + `ArrowLeft`（`class="size-4" aria-hidden="true"`）+ 文案（「返回列表」「返回組織管理（成員）」等）。若同列右側另有 **`size="sm"`** 之儲存／取消，返回鈕一併設 **`size="sm"`** 對齊高度。導向用 **`RouterLink`** 時：`Button variant="outline" … as-child` 包住 `RouterLink`。**避免**以 `variant="ghost"` + `text-muted-foreground` 作為主要返回（易與次級文字連結混淆）。**例外**：僅圖示、無文字之返回（如 **`PlatformTenantManageView`** 頂欄）可維持 `ghost` + `size="icon"`。
- **主標**：`h1` → `text-xl font-semibold tracking-tight text-foreground`（與列表頁標題同級）。
- **說明**：`mt-1 text-sm text-muted-foreground`；文內連結：`text-primary underline-offset-4 hover:underline`。

**頂部工具列（左標題區、右主要操作）— 可編輯獨立頁建議**

- 外層：`flex flex-wrap items-start justify-between gap-4`
- **左側**（`min-w-0 flex-1`）：返回、`h1`、說明文字（與上段相同層級）。
- **右側**（`flex shrink-0 flex-wrap items-center justify-end gap-2`）：**儲存**、**取消**（`outline`）、需確認之**破壞性**動作（開啟 `AlertDialog`）；與 **`MonitoringDeviceDetailView`**、本頁 **`AdminOrgAssignmentEditView`** 一致。
- 表單驗證／API 錯誤訊息可緊接在 `header` 下方（`text-destructive`），勿依賴頁尾按鈕才看見錯誤。

**僅返回、無右側操作時**

- `header`：`flex shrink-0 flex-wrap items-center justify-between gap-4` 亦可簡化為僅左側返回 + 標題。

**替代：僅一行 outline 返回（長篇詳情）**

- `flex flex-wrap items-center gap-3` 內：`Button variant="outline"` + `ArrowLeft` +「返回列表」。

參考實作：`AdminOrgAssignmentEditView.vue`、`RepairRecordDetailView.vue`、`MonitoringDeviceDetailView.vue`。

---

## 3. 載入、錯誤、前置條件（租戶未選等）

| 狀態 | 建議 |
|------|------|
| **載入中** | `flex flex-col items-center justify-center py-16 text-muted-foreground`；`Loader2` 建議 `size-8`；可加 `mt-2 text-sm` 說明文字。 |
| **錯誤／無法載入** | `rounded-lg border border-border bg-card p-8 text-center`；`text-sm text-destructive` 或 `text-muted-foreground`；提供 **`Button variant="outline"`** 返回列表或重試。 |
| **前置條件不符**（如平台方未選租戶） | 同上卡片樣式或 `px-4 py-6` 的簡化卡片內說明即可。 |

---

## 4. 內容寬度與區塊（資料呈現）

- **預設（後台主區內獨立頁）**：內容應**吃滿主區可用寬度**（僅根節點 `p-4 md:p-6` 留白）；**勿**為了「像表單」就套用 `max-w-lg`，否則整頁會像置中窄欄、與列表／儀表板其他頁不一致（獨立路由**不是** modal）。
- **選用窄欄**：僅在產品有明確理由時（例如極少欄、刻意置中的短文設定）才使用 `mx-auto max-w-lg`（或 `max-w-md`）包住內容區。
- **寬詳情**（多欄唯讀、附件、時間軸）：全寬卡片 + 響應式格線（`sm:grid-cols-2`、`lg:grid-cols-3` 等）。

**區塊外殼（卡片）**

- `rounded-lg border border-border bg-card`
- 內距：表單／摘要 `p-4`；較長唯讀內容 `p-4 sm:p-6`
- **勿**再套一層大 `Card` 包住「全頁標題＋全部內容」（與列表頁避免雙層 Card 相同邏輯）。

**區塊標題**

- 區塊主標：`h2` → `text-lg font-semibold text-foreground`
- 小節標：`text-sm font-medium text-muted-foreground`
- 鍵值標籤：`dt` → `text-xs font-medium text-muted-foreground`

**唯讀鍵值（詳情）**

- 容器：`dl` + `mt-4 grid gap-3 sm:grid-cols-2`（欄位多時可加 `lg:grid-cols-3`）
- 值：`dd` → `mt-0.5 text-sm text-foreground`；長文可加 `whitespace-pre-wrap`
- 小節分隔：`border-t border-border pt-4`

**表單區（可編輯）**

- 卡片內：`grid gap-4`；每欄 `grid gap-2` + `Label` + 控制項
- `SelectTrigger`／`Input` 建議 `class="bg-background"`
- 輔助說明：`text-xs text-muted-foreground`
- 多個選項（checkbox 群）：`rounded-md border border-border bg-muted/30 p-3`

---

## 5. 主要操作列（儲存／取消／破壞性）

- **預設（後台可編輯頁）**：置於 **§2 頁首右側工具列**（見上），表單區**不**再放重複的儲存列，避免與其他獨立頁不一致。
- **詳情頁＋編輯對話框**（與 **`ConstructionDefectDetailView`**）：頂部僅「返回」；其下一列為 **`h1` 詳情標題** 與右側 **「編輯」「刪除」**（`outline`＋`Pencil`／`Trash2`，刪除為紅字 `outline`）；內容為**單一** `bg-card` 唯讀區塊；**編輯**開啟 **`Dialog`**，表單與儲存／取消在對話框內。例：**`AdminOrgAssignmentEditView`**（組織指派詳情）。
- **例外**：超長表單若產品要求在捲動後仍能送出，可於**最後一張卡片底部**加次要「儲存」作重複入口（與頂欄並存時需文案一致）。
- **主要送出**：預設 variant；**取消**：`variant="outline"`；**破壞性**：`variant="destructive"`，觸發前用 **`AlertDialog`** 確認。
- 按鈕宜 **`size="sm"`**，與列表工具列對齊。

---

## 6. 與列表頁的銜接

- 從列表進入獨立頁後，**頁首應含返回與頁面用途**（主標＋可選說明），避免使用者失去脈絡。
- 路由參數與麵包屑依 **`project-routes.mdc`**、`breadcrumb.ts` 維護。

---

## 7. 參考實作

| 頁面 | 路徑 | 備註 |
|------|------|------|
| 組織指派詳情 | `src/views/admin/AdminOrgAssignmentEditView.vue` | 同缺失詳情：返回 → 標題＋編輯／刪除 → 單卡唯讀；編輯用 `Dialog` |
| 報修詳情 | `src/views/repair/RepairRecordDetailView.vue` | outline 返回、大卡片唯讀格線 |
| 監測設備詳情 | `src/views/monitoring/MonitoringDeviceDetailView.vue` | 頂部左右分區、全高版面 |

手機／PWA 的列表—詳情—表單導航（含 `router.back()`）另見 **`docs/mobile-field-app-implementation-guide.md`**。
