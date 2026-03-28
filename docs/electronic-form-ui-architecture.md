# 電子表單 UI 架構規劃（Builder × 填寫／顯示）

本文回答：**要不要先列元件再做畫面**、**建置器與執行期 UI 如何分工**，以及建議的**目錄與實作順序**。  
後端領域模型與分階段計畫見同 workspace 後端 repo：`docs/electronic-forms-module-plan.md`（階段 C＝Renderer、階段 E＝Builder）。

---

## 1. 建議結論（一句話）

**先凍結「欄位型別＋`config` 契約」（registry），再實作「同一套型別的兩種外殼」——畫布上的編輯外殼（Builder）與專案內填寫／唯讀外殼（Runtime）**；不要先做滿拖曳三欄，再發現與 API／`fieldType` 對不起來。

---

## 2. 兩條 UI 產品線

| 產品線 | 使用者 | 目的 | 與你提供的示意圖對應 |
|--------|--------|------|------------------------|
| **Form Builder** | 租戶管理員（Admin） | 拖曳／排序欄位、編輯 `label`／驗證／條件、預覽、接 workflow 設定 | 左元件庫＋中畫布＋右屬性／流程 |
| **Form Runtime** | 專案成員 | 依已發布定義填寫 `data`、送審、檢視與簽核 | 無左庫；僅「表單內容＋動作列」（與預覽模式類似） |

兩者**共用**的是：

- `fieldType` → 用哪個 Vue 元件渲染**資料語意**（值型別、驗證、送出的 JSON key）。
- `config`（Json）→ 選項、寬度、placeholder、`show_when` 等**與編輯器無關的呈現與行為**。

兩者**不共用**的是：

- Builder 專用：**選取態、複製／刪除、拖曳把手、與右側面板雙向綁定**。
- Runtime 專用：**與 `FormSubmission` API 的狀態**（草稿／pending）、錯誤提示、唯讀模式。

---

## 3. 要不要「先把元件都建起來」？

**建議：不要一次建 20 個獨立檔**，改採下面順序。

1. **Registry（型別登記表）**  
   - 單一 TS 模組（例如 `src/lib/electronic-form/field-registry.ts`）定義：  
     `fieldType` 字串常數、`config` 的 Zod／型別、`defaultConfig`。  
   - 與後端 `FormField.fieldType`、`FormField.config` **字串與語意對齊**（後端無 enum 時，以前後端共識文件＋registry 為準）。

2. **每個型別一個「核心」元件（Runtime 優先）**  
   - 只做：**`modelValue`（或 `submission.data[fieldKey]`）雙向綁定＋disabled／readonly＋基本驗證顯示**。  
   - 型別可先覆蓋示意圖中的**基本欄位**（見下表），**結構類**（section、divider、static text）以「不進 `data` 或只影響排版」的規則寫清楚。

3. **Builder 外殼**  
   - `FormBuilderFieldChrome.vue`（或 per-type 薄包一層）：選取邊框、標題列顯示型別 badge、複製／刪除 emit。  
   - 中間包一層 **Preview 模式**的同一 Runtime 元件（`readOnly` 或 `variant="canvas"`），避免畫布與真實填寫長兩套。

4. **三欄版面**  
   - 最後再組 `ElectronicFormBuilderView`：左列表從 registry 產生、中間遞迴 render、右側依 `selectedFieldId` 編輯 `config`。

這樣 **Runtime 可先上線**（專案內填表），Builder 可晚一個迭代接 admin API。

---

## 4. 第一版欄位型別清單（對照示意圖）

以下 `fieldType` 為建議**與後端約定**的 snake 或 kebab 命名（實際以 registry 常數為準，並在 admin 儲存時與 API 一致）。

### 4.1 結構（通常不產生單一 scalar 值，或產生子樹）

| 示意 | 建議 `fieldType` | `data` 行為 | 備註 |
|------|------------------|-------------|------|
| 區塊 | `section` | 可選：子欄位扁平 merge 進根 `data`，或 `data.sectionKey.*`（須先定案） | 畫布上為容器 node |
| 分隔線 | `divider` | 不寫入 | 僅顯示 |
| 說明文字 | `static_text` / `help` | 不寫入 | `config.markdown` 可後續再做 |

### 4.2 基本欄位（對應單一 `fieldKey`）

| 示意 | 建議 `fieldType` | 值型別（約定） | `config` 常見鍵 |
|------|------------------|----------------|-----------------|
| 單行文字 | `text` | string | `placeholder`, `maxLength`, `width` |
| 多行文字 | `textarea` | string | `rows`, `maxLength` |
| 數字 | `number` | number | `min`, `max`, `step` |
| 金額 | `currency` | number 或 string（整數分） | `currency`, `decimals` |
| 日期 | `date` | string (ISO date) | `min`, `max` |
| 下拉 | `select` | string | `options: { value, label }[]` |
| 單選 | `radio` | string | 同上 |
| 多選 | `checkbox_group` | string[] | 同上 |

**後續階段**再補：`file`／`table`／`user_picker`／`signature` 等（見後端計畫階段 G）。

---

## 5. 元件目錄建議（前端 repo）

依 `project-overview.mdc`：僅 Builder 或僅 Runtime 單頁使用可放 `views/` 下子資料夾；**跨 Builder＋Runtime 共用**則放 `components/`。

```
src/
  lib/electronic-form/
    field-registry.ts          # 型別常數、config 型別、預設值
    evaluate-show-when.ts      # 條件顯示（單一純函式，便於測試）
  components/electronic-form/
    runtime/
      FormRuntime.vue          # 依 fields[] 遞迴／扁平渲染 + v-model data
      fields/
        EfTextField.vue
        EfTextareaField.vue
        EfNumberField.vue
        ...
    builder/
      FormBuilderShell.vue     # 三欄 layout
      FormBuilderCanvas.vue
      FormBuilderLibrary.vue
      FormBuilderInspector.vue # 右側：基本／驗證／條件 tabs
      FormBuilderFieldChrome.vue
    shared/                    # 若真有 Builder+Runtime 共用且非 fields
      ...
```

命名前綴 `Ef` 可避免與全域 `Input` 混淆；若團隊偏好目錄區隔也可省略前綴。

---

## 6. 與 shadcn-vue／主題

- **Runtime** 優先使用既有 `Input`、`Textarea`、`Select`、`RadioGroup`、`Checkbox`、`Label` 等，樣式用語意 token（`theme-support.mdc`）。
- **Builder** 的選取框、拖曳狀態可用 `border-primary` 等，避免硬編碼色。

---

## 7. 審核流程區塊（示意圖下方）

- **後台 Builder**：右側或可讀取／編輯 workflow（已有 API：`PUT .../workflow-steps`）。  
- **專案 Runtime**：顯示**唯讀**步驟列表即可（資料來自 `workflowSnapshot` 或定義 API）；**簽核按鈕**放在 submission 詳情頁，與 `POST .../approval-actions` 對齊。

---

## 8. 實作順序（建議里程碑）

| 順序 | 內容 | 產出 |
|------|------|------|
| M1 | Registry ＋ `text` / `textarea` / `number` / `date` / `select` 的 Runtime 元件 | 專案內可填一張簡單表（mock 或真 API） |
| M2 | `FormRuntime` 整合 `required`、`readonly`、`show_when` | 與後端驗證方向一致 |
| M3 | 專案內列表／詳情頁（`construction.electronic_form` 權限） | 與現有列表頁 UX 規範對齊 |
| M4 | Builder 畫布＋chrome＋接欄位 CRUD／reorder API | 接近你提供的三欄示意 |
| M5 | 右側驗證／條件 tab、預覽彈窗、發布前檢查 | 與 `draft`／`publish` 規則一致 |

---

## 9. 風險與刻意延後的事項

- **拖曳函式庫**（`vuedraggable` 等）：M4 再引入，避免 M1 範圍膨脹。  
- **`section` 與 `data` 扁平／巢狀**：須與後端索引、`FormSubmissionIndex` 鍵名一致後再實作。  
- **`actionsOnApprove`**：僅後端白名單執行；前端只顯示說明與設定 JSON，不執行業務副作用。

---

## 10. 相關文件

- 後端：`construction-dashboard-backend/docs/electronic-forms-module-plan.md`  
- 專案內權限：`construction.electronic_form`（`permission-modules.ts`、`NAV_PATH_PERMISSION_MODULE['/construction/electronic-forms']`）  
- UI 列表規範：`.cursor/rules/ui-ux-principles.mdc`、`data-table-list-views.mdc`

---

## 11. 已定案程式契約（v1）

| 項目 | 後端 | 前端 |
|------|------|------|
| 版本號 | `ELECTRONIC_FORM_FIELD_CONTRACT_VERSION` | 同左，需手動同步 |
| `fieldType` 清單 + `config` Zod | `src/schemas/electronic-form-field-contract.ts` | `src/constants/electronic-form-field-contract.ts` |
| Admin 建立／更新欄位 | `createElectronicFormFieldSchema`／`updateElectronicFormFieldBody` 內 `superRefine`；PATCH 僅同時改 `fieldType`+`config` 時於 Zod 驗 config，其餘組合於 `electronic-form-definition.service` `updateField` | 送 API 前可先用 `defaultConfigForElectronicFormFieldType` |

**`showWhen`**：後端已支援單條 `{ fieldKey, operator, value? }`（`operator`：`equals` | `notEquals` | `in` | `notIn` | `isEmpty` | `isNotEmpty`）。複合 AND／OR 留待下一版契約。

---

*版本：初稿；隨 `fieldType` 與 API 契約調整時更新 §4、§11。*
