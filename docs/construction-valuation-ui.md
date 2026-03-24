# 估驗計價（前端）

## 與後端契約

- **請款快照、PATCH 時 PCCES 單價不可變、列表頁 `summary` KPI 定義**：以後端 **`construction-dashboard-backend/docs/construction-valuation-billing-snapshot.md`** 為準。
- 更新估驗時若變更已存在 PCCES 列之單價，API 回 **400**，`error.code`：**`VALUATION_UNIT_PRICE_IMMUTABLE`**；可顯示 `error.message`。
- 列表頁 StateCard 與「本次估驗金額」欄位使用 **`formatMoneyNtd`**（`NT$` 前綴）；表單內 PCCES 綁定列之單價為唯讀顯示，與後端鎖定一致。
- **（七）本次止累計估驗金額**：前端以 `priorBilledAmount`（他次估驗已請款金額加總）＋本期 `currentPeriodQty×unitPrice` 顯示；與後端 `cumulativeAmountToDate` 一致，**不用**「累計數量×當前單價」，避免 PCCES 單價變更後改寫前期金額。

## 主要檔案

- `src/views/construction/ConstructionValuationsListView.vue` — 列表、summary、表格
- `src/views/construction/ConstructionValuationFormView.vue` — 明細表
- `src/api/construction-valuations.ts` — `getConstructionValuationListSummary` 等
