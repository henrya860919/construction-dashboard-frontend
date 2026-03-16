# 狀態／統計卡樣式盤點

**已統一**：全站狀態／統計卡一律使用 **StateCard**（儀表板同款），規範見 `.cursor/rules/ui-ux-principles.mdc` 三之一。

以下為歷史盤點紀錄，現已全部改為 StateCard。

---

## 一、StateCard（共用元件）

**檔案**：`src/components/common/StateCard.vue`

**結構**：
- 外層：shadcn `Card`（rounded-xl border py-6 shadow-sm）
- `CardHeader`：`flex flex-row items-center justify-between`，左邊 `CardTitle`（text-lg font-medium），右邊 `#icon` slot
- `CardContent`：default slot（主數值＋說明）、可選 `Progress`（props.progress）

**使用處**：
- **DashboardView**：累計天數、整體進度、預算執行（KPI 三卡）→ `grid gap-4 md:grid-cols-3`
- **MonitoringDevicesView**：設備數量、線上、離線、尚未設定 → `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`

**視覺**：
- 標題在上、字級較大（text-lg）
- 主數值多為 `text-3xl font-bold`（由使用端寫在 slot）
- 副說明 `text-xs text-muted-foreground`
- 可選進度條

**特點**：唯一有抽成元件的統計卡，可插 icon、可選 progress，版面是「標題在上、內容在下」。

---

## 二、PlatformTenantManageView 統計卡（手寫）

**檔案**：`src/views/platform-admin/PlatformTenantManageView.vue`

**結構**：
- 外層：`Card class="border-border"`
- 僅 `CardHeader`，無 CardContent
- `CardHeader`：`flex flex-row items-center gap-3 pb-2`
  - 左：`div.size-12.rounded-xl.bg-primary/10.text-primary` ＋ icon
  - 右：`CardTitle`（text-base font-medium **text-muted-foreground**）＋ 數值（text-2xl font-semibold tabular-nums）

**使用處**：租戶管理頁「成員總數」「專案總數」「總使用儲存空間」

**視覺**：
- **橫向**：左 icon 塊、右標題＋數值
- 標題是 muted、字級較小（text-base）
- 數值 text-2xl

**網格**：`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`

---

## 三、ContractScheduleView 摘要卡（手寫）

**檔案**：`src/views/contract/ContractScheduleView.vue`

**結構**：
- 外層：`Card class="border-border"`
- 僅 `CardContent class="flex items-center gap-4 pt-6"`
  - 左：同款 icon 區 `size-12 rounded-xl bg-primary/10 text-primary`
  - 右：label（**text-xs font-medium uppercase tracking-wider text-muted-foreground**）＋ 數值（text-2xl 或 text-lg font-semibold）

**使用處**：工期調整頁「申請天數」「核定天數」「開工時間」「預定竣工日期」

**視覺**：
- 同樣橫向：左 icon、右 label＋數值
- Label 小字、大寫、tracking-wider，muted
- 與 PlatformTenantManageView 類似，但用 CardContent 且 label 樣式更強調（uppercase）

**網格**：`grid gap-4 sm:grid-cols-2 lg:grid-cols-4`

---

## 四、ChartSummaryCards（專用元件）

**檔案**：`src/components/dashboard/ChartSummaryCards.vue`

**結構**：
- **不用** shadcn Card
- 外層：`div.grid.grid-cols-2.gap-3.sm:grid-cols-4`
- 每個子項：`div.rounded-lg.border.border-transparent.px-4.py-3` ＋ CSS 變數（--summary-current-bg 等）

**使用處**：儀表板「環境監測數據」區塊內的「當前數值／平均值／最高值／最低值」

**視覺**：
- 標題：text-xs font-medium opacity-90
- 數值：text-lg font-bold tabular-nums
- 背景／字色由主題變數決定，無 icon

**特點**：語意是「圖表摘要」，視覺較扁平、無 icon、多色塊。

---

## 五、其他相關元件（非純統計卡）

| 元件 | 用途 | 備註 |
|------|------|------|
| **AlertCard** | 儀表板「警報專區」單一警報卡 | 依等級有紅/黃/綠背景、Badge、大數值＋說明，語意是「警報狀態」 |
| **MonitorCard** | 儀表板「環境監測」指標**選擇器** | 按鈕型、可 selected，左 icon 右 label+value，是選單不是純展示卡 |

---

## 總結：目前幾種「狀態統計卡」樣式

| 樣式 | 外層 | 版面 | 標題/標籤 | 數值 | 使用處 |
|------|------|------|------------|------|--------|
| **StateCard** | Card | 上：標題＋icon；下：主數值＋副說明＋可選 Progress | CardTitle text-lg | slot 自訂（多為 text-3xl） | 儀表板 KPI、設備狀態 |
| **PlatformTenantManageView** | Card | 橫：左 icon 塊、右 標題＋數值 | CardTitle text-base muted | text-2xl | 租戶管理 統計 |
| **ContractScheduleView** | Card | 橫：左 icon 塊、右 label＋數值 | label text-xs uppercase muted | text-2xl / text-lg | 工期調整 摘要 |
| **ChartSummaryCards** | div | 無 icon，標題＋數值 | text-xs opacity-90 | text-lg | 環境監測 圖表摘要 |

**不一致點**：
1. 有共用元件（StateCard）也有多處手寫 Card＋icon＋數值。
2. 手寫的兩種（租戶管理、工期調整）都是「左 icon 右文字」，但一個用 CardHeader、一個用 CardContent，標題一個 text-base、一個 text-xs uppercase。
3. StateCard 是「上標題、下內容」；其餘兩種是「左 icon、右文字」。
4. 網格欄數不統一（2/3/4 欄依頁面各自設定）。

下一步可決定：要統一成「StateCard 風格」、還是「左 icon 右數值」風格，再寫進 ui-ux-principles 或單獨的「狀態統計卡」規範，並逐步改寫手寫處或擴充 StateCard。
