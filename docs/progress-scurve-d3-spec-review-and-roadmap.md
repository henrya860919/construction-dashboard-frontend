# 進度 S 曲線：D3 對齊規劃檢視報告與後續路線圖

**文件目的**：對照團隊內部《D3 圖表對齊原則與圖層規劃》與 **construction-dashboard-frontend 實作**（`ProgressManagementView.vue`、`ProgressUnifiedScurve.vue`），供同事交叉檢視與排程決策。

**對照程式基準**（後續已改版）：進度管理頁改為**單一 SVG**（`ProgressUnifiedScurve.vue`）+ `progress-scurve-layout.ts`；後端儀表板含 `planCurves`，型別見 `src/types/project-progress.ts`。

---

## 1. 執行摘要

| 項目 | 規劃文件主張 | 現況 | 建議 |
|------|--------------|------|------|
| 座標系統 | 日期列、圖表、底表 **同一張 SVG**，共用 `lineX`／`ptX` | 日期列與底表為 **HTML table**，圖表為 **一至兩張 SVG**（`chartPart: yAxis` + `plot`） | 短期可維持「共用 `cellW` + 與 `colgroup` 一致」策略；中長期若要做今日線、全高底色、圖例與表一體化，宜收斂成 **單一 SVG（或單一繪圖根節點）** |
| 對齊保證 | 「HTML 與 SVG 混用無法精確對齊」 | 以 **相同欄寬公式** 與 **表格分欄 = 繪圖寬度 `n × cellW`** 對齊，已改善先前「單一 colspan SVG」錯位問題 | 敘述可修正為：**混用時對齊「可達成但脆弱」**（邊框、`border-collapse`、sticky、`subpixel`、字型皆可能引入 1px 級誤差）；單一 SVG 則 **幾何對齊由同一套函式保證** |
| 圖層 | Layer 0～12，含背景、今日、追加週、多版本線、面積、圖例等 | 僅實作 **格線 + 最多三條線（主計畫、比較、實際）+ 變更垂直線 + 點**；無面積、無今日線、無多版本疊圖、無 SVG 內底表 | 依產品優先級 **分階段** 補齊（見第 5 節） |
| 資料來源 | 隱含需多版本曲線與「active」版本 | API 為 `primaryPlanId`、`comparePlanId`、單一比較曲線資料欄位 | 若要達規劃文件視覺，需 **後端擴充** 或 **前端多次請求合併**（見第 4 節） |
| 主題／無障礙 | 固定 hex／rgba 色票 | 專案規範為 **淺／深色** 語意色（CSS 變數） | 建議 **色票對照到主題 token**，避免深色模式對比失效；`foreignObject` 內表單需鍵盤與螢幕閱讀器測試 |

---

## 2. 規劃文件重點摘要（內部共識用）

- **幾何核心**：`lineX(i)` = 格線左緣；`ptX(i)` = 格中心；左側 `LABEL_W`、`SUB_W` 與 `PAD_L = CELL_W/2` 統一總寬公式。
- **垂直分區**：日期列高、圖表區高、底表每列固定行高，y 以區塊堆疊。
- **圖層順序**：背景與 highlight → 日期列與全高格線 → Y 軸格線 → 面積 → 非 active 計畫線 → active 計畫線 → 點 → 變更標記 → 實際線 → 今日線 → 圖表底邊 → 底表（含 `foreignObject` input）→ 圖例。
- **重繪策略**：每次狀態改變 **整張清空再畫**，不做 D3 data join。

以上與「可維護、可預測的渲染順序」一致，適合作為 **單一 SVG 實作** 的契約。

---

## 3. 現有實作對照

### 3.1 座標與版面

| 規劃概念 | 現有實作 |
|----------|----------|
| `CELL_W` | `cellW`：依 `ResizeObserver` 與容器寬度動態計算，`MIN_CELL_W = 48` |
| `LABEL_W + SUB_W` | 左側僅 **一欄** `LEFT_GUTTER = 120`（表頭為「日期」，列標籤為「本期預定」等），**未**拆成「主標 + 副標」雙欄幾何 |
| `lineX` / `ptX` | 繪圖區：`x = i * cellW` 為格線左緣；**點與線** 使用 `i * cellW + cellW/2`（等同 `ptX` 在僅繪圖區座標系下） |
| 第一點不貼邊 | 與「格線在 0…n、點在欄中心」一致；**未**另外加規劃中的 `PAD_L` 於總寬公式（總寬為 `LEFT_GUTTER + n * cellW`） |

### 3.2 圖層與視覺

| Layer（規劃） | 現有 |
|---------------|------|
| 0 外框／今日／追加週底色 | **無**（`isExtended` 僅在 DTO，畫面上未做欄位底色） |
| 1 日期列於 SVG 內 | **無**，日期在 `<thead><th>` |
| 2 Y 軸格線（水平虛線） | **無**獨立水平格線；僅 `d3.axis` 刻度線 |
| 3～4 面積填色 | **無** |
| 5～6 多版本計畫線與點 | **一條主計畫** + **至多一條比較** + **實際**；點為圓／三角，**無**版本色輪與 active／非 active 透明度規則 |
| 7 變更時間點 | **有**，垂直虛線 + 文字標籤（索引對應週期） |
| 8 實際進度 | **有**線與三角點 |
| 9 今日線 | **無** |
| 10 圖表底分隔線 | **無**（依賴 table `border`） |
| 11 SVG 底表 | **無**；底表為 HTML，`Input` 非 `foreignObject` |
| 12 圖例 | **有**簡易 HTML 圖例（線型說明），**不在**圖表座標系內 |

### 3.3 重繪與狀態

- **符合**規劃：D3 端採 `selectAll('*').remove()` 後重畫（見 `ProgressUnifiedScurve.vue` 之 `render()`）。
- **表格與圖表**：Vue 響應式驅動 props 變更 → `watch` 觸發重繪；並非單一 `render()` 函式統管 HTML+SVG。

### 3.4 色彩與主題

- 規劃：`VERSION_COLORS`、`VERSION_FILLS`、今日紅線、追加週橙色等 **固定色**。
- 現有：自 `documentElement` 讀取 `--chart-*`、`--border`、`--muted-foreground` 等，**較利於深色模式**，但與規劃文件的「版本序號色」尚未對應。

---

## 4. 資料與 API 落差（影響能否一次到位做滿規劃 UI）

目前 `ProgressDashboardDto` 提供：

- `plans[]`：版本摘要（含 `effectiveFromDate`／`isBaseline` 等），**不含**每版本完整週期累計曲線。
- `periods[]`：以 **當前 primary + 可選 compare** 展開的合併列；比較資料僅 `periodPlannedCompare`／`cumulativePlannedCompare`。

若要實作規劃文件中的 **「版本 0～N 同時畫線、active 高亮、非 active 半透明」**：

- 需要 **每個版本一組週期累計值**（或後端直接回傳多序列），或
- 前端 **多次** `getProgressDashboard`（切換 primary／compare）組曲線——互動與效能與產品定義都需重新設計。

**結論**：視覺規劃與 **現行儀表板契約** 之間有 **結構性差距**；建議在路線圖中將「多版本疊圖」標為 **API／聚合策略** 前置任務。

---

## 5. 未來規劃（建議分階段）

### 階段 A — 維持混排架構下的體驗補強（低成本）

- 表頭／表身／圖表 **沿用同一套 `cellW`／`LEFT_GUTTER`**，持續用實機測 **捲動 + sticky + 縮放** 是否有殘餘錯位。
- 使用後端已有欄位：在 HTML 表或圖表旁 **標示 `isExtended` 欄**（底色），與規劃 Layer 0 部分對齊。
- 圖表區補 **水平 Y 格線（虛線）**，提升讀圖性（不需改 API）。

### 階段 B — 單一 SVG 化（中成本，對齊規劃核心）

- 新增容器元件（例如 `ProgressScurveUnifiedCanvas.vue`），**總寬** = `LABEL_W + SUB_W + N * CELL_W + 右側 padding`（或與現有 120px  gutter 協調後的單一公式）。
- 將 **日期文字、垂直格線、曲線、變更線、今日線、底表文字** 畫於同一 `svg`；編輯欄位採 **`foreignObject`** 嵌入現有 shadcn `Input`（需注意 **深色模式**與 **focus 樣式**）。
- 圖例置於 `DATE_H + offset` 的固定座標，與規劃 Layer 12 一致。
- 維持 **全量重繪** 策略；將 `draw` 拆成 `drawLayer0`…`drawLayer12` 函式以利 code review 與規劃文件逐條對照。

### 階段 C — 多版本與面積圖（高成本，依產品決策）

- 後端：儀表板擴充 **多序列**（例如 `planSeries: { planId, label, version, points[] }[]`）或專用 **歷史曲線 API**。
- 前端：依版本索引取色（**建議映射到主題 palette**，而非寫死 hex）；實作 **area under line**、**active**／**非 active** opacity／stroke 寬度規則。
- **今日線**：需定義「今日」對應 **哪一個 `periodIndex`／`periodDate`**（當週區間規則）。

### 階段 D — 輸出與列印

- 單一 SVG 有利 **匯出 PNG／PDF**；可排在 B 之後。

---

## 6. 風險與注意事項

1. **`foreignObject`**：Safari／縮放比例下偶有裁剪或模糊；需訂測試矩陣。
2. **無障礙**：純 SVG 圖表需 `title`／`desc` 或平行文字摘要；表單仍應可 **Tab** 聚焦。
3. **效能**：週數通常 < 百，全量重繪合理；若未來改 **日維度** 再評估。
4. **與既有文件關係**：後端 `docs/progress-management-spec-gap-analysis.md` 偏 **資料模型與模組邊界**；本文件偏 **前端 D3 呈現契約**，兩者可並存、互相連結。

---

## 7. 建議給同事的結論句（可放 PR／Wiki）

- **規劃文件的單一 SVG + 統一 `lineX`／`ptX` 是長期正解**，特別是要做「貫穿全高的今日／追加週底色」與「圖表＋表一體化」時。
- **目前產品採表格 + 雙 SVG 是過渡解**，在「僅對齊格線與變更垂直線」需求下可接受；與規劃文件的差距主要在 **多版本資料**、**面積與底色**、**今日線**、**SVG 內底表** 四塊。
- 建議下一個里程碑明確選擇：**要嘛擴充 API 支援多版本疊圖，要嘛先完成階段 B 單一 SVG（仍只畫 primary/compare/actual）**，避免同時大改資料與版面。

---

## 8. 文件維護

| 項目 | 建議 |
|------|------|
| 負責領域 | 前端（D3／版面）；API 變更需後端共同維護附錄 |
| 更新時機 | 每次進度管理頁 **大改版** 或 **儀表板 DTO 變更** 後更新本文件「第 3、4 節」 |
