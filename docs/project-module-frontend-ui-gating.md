# 專案模組權限 — 前端 UI 控管

與後端 `assertProjectModuleAction` 對齊：在專案內頁使用 `useProjectModuleActions(projectId, '<PermissionModuleId>')` 取得 `canCreate` / `canRead` / `canUpdate` / `canDelete`。

**平台／租戶管理員**：`useProjectPermission` 內已視為全開，與後端一致。

### 按鈕／操作顯示原則（與 `ensureProjectPermission`）

- **僅「編輯」「刪除」**：無權限時**不顯示**（列操作選單用 `v-if`、主按鈕用 `v-if`）。
- **其餘**（新增、上傳、匯入、檢視、下載、開啟 Dialog、導頁等）：**按鈕或選單項維持顯示**，在 `@click`／handler 開頭呼叫 `ensureProjectPermission(allowed, kind)`；無權限時顯示 toast，不執行後續動作。
  - `kind`: `'create'`（新增類）、`'read'`（檢視／下載類）、`'change'`（需 `update` 但非「編輯」選單項本身，例如契約「新增分類」、表單儲存）。
- 實作輔助：`src/lib/permission-toast.ts` 的 `ensureProjectPermission`、`toastPermissionDenied`。

#### 刻意維持舊行為（create 不採「常駐＋toast」）

- **圖說管理** `ConstructionDrawingsView.vue`：所有需 `drawingsPerm.canCreate` 的操作——**新增頂層分類／圖說**、資料夾內**新增子分類／圖說項目**、葉節點**上傳新版本**——仍**只以 `v-if="drawingsPerm.canCreate"` 顯示**，無建立權限時按鈕／選單項不出現（**不**改為按鈕常駐再 `ensureProjectPermission(..., 'create')`）。
- **設備管理** `MonitoringDevicesView.vue`：**新增攝影機**及後續新增 Dialog／現場安裝精靈等建立流程，**只以 `v-if="equipmentPerm.canCreate"` 顯示入口**；無建立權限者不顯示按鈕（**不**採常駐＋toast）。`MonitoringDeviceDetailView.vue` 僅編輯／刪除等，無新增入口。
- **監測數據上傳** `MonitoringUploadView.vue`（`construction.upload`）：**步驟二**（拖曳／選檔、已選清單、上傳按鈕）**僅在 `uploadPerm.canCreate` 時顯示**；無建立權限時僅簡短說明，**不**改為上傳區常駐再 toast。`MonitoringMetricsView.vue` 導向「上傳數據」的連結同樣 **`v-if="uploadPerm.canCreate"`**。

與「其餘操作點擊 toast」規則並存時，**以上頁面之 create 類入口以本段為準**。

---

## 已接上 UI 控管的頁面（階段一）

| 領域 | 檔案 | 模組 id |
|------|------|---------|
| 檔案／表單 | `FileManagementView.vue`, `FileFormsView.vue` | `construction.upload` |
| 照片管理 | `FilePhotosView.vue` | `construction.photo` |
| 監測｜歷史圖表 | `MonitoringMetricsView.vue` | `construction.upload`（導向上傳頁按鈕）、閱覽維持 monitor read |
| 監測｜上傳 | `MonitoringUploadView.vue` | `construction.upload` |
| 監測｜設備 | `MonitoringDevicesView.vue`, `MonitoringDeviceDetailView.vue` | `construction.equipment` |
| 圖說 | `ConstructionDrawingsView.vue` | `project.drawings` |
| 缺失改善 | `ConstructionDefectsView.vue` + `ConstructionDefectsRowActions.vue` | `construction.defect` |
| 風險議題 | `ManagementRisksView.vue` + `ManagementRisksRowActions.vue` | `project.risk` |
| WBS | `ManagementWbsView.vue`（清單分頁主要操作；網路圖等可續接） | `project.wbs` |
| 報修紀錄 | `RepairRecordsView.vue` + `RepairRecordsRowActions.vue` | `repair.record` |
| 自主檢查 | `ConstructionSelfCheckView.vue`、`ConstructionSelfCheckTemplateView.vue`、`ConstructionSelfCheckRecordNewView.vue`、列操作 | `construction.inspection` |
| 甘特圖 | `ManagementGanttView.vue`、`GanttToolbar.vue`（里程碑編輯） | `project.gantt`（`update` 控拖曳、前置、里程碑） |
| 資源庫 | `ManagementResourcesView.vue`、`ManagementResourcesRowActions.vue` | `project.resource` |
| 工期調整 | `ContractScheduleView.vue`、`ScheduleRowActions.vue` | `project.duration` |
| 缺失詳情 | `ConstructionDefectDetailView.vue` | `construction.defect` |
| 專案資訊 | `ContractProjectInfoView.vue`（`update` 控編輯／儲存） | `project.overview` |
| 契約管理（契約檔） | `ContractManagementView.vue`、`ContractFileRowActions.vue` | `project.overview`（`create` 上傳、`delete` 刪除、`read` 下載／批次下載；`update` 新增分類） |
| 歷史警報 | `MonitoringAlertsView.vue`、`MonitoringAlertsRowActions.vue` | `construction.monitor`（列「查看」依 `read`） |

**僅讀、無變更 API 的頁面**：`DashboardView.vue`（儀表板 KPI／圖表）、`MonitoringMediaView.vue`、`MonitoringReportsView.vue` 無需額外按鈕控管；`RepairRecordDetailView.vue` 僅預覽／下載附件，對齊 `repair.record` 讀取即可。

---

## 路由與 path 映射

`NAV_PATH_PERMISSION_MODULE`（`src/constants/permission-modules.ts`）需含專案內 path suffix；`useProjectRoutePermissionGuard` 與側欄 `canReadPath` 依此解析。已補：

- `/monitoring/metrics`、`/monitoring/alerts`、`/monitoring/media` → `construction.monitor`（與 redirect 路徑一致）

---

## 列操作元件模式

`RowActions` 類元件：**「檢視」「下載」**等不改隱藏；**「編輯」「刪除」**以 `canEdit` / `canDelete`（或 `canRemove`）搭配 `v-if` 隱藏。父層在 `onView` / `onDownload` 等 callback 內呼叫 `ensureProjectPermission(..., 'read' | 'create')`。

---

## 建議後續接上的頁面

後端已有對應 `assertProjectModuleAction` 者，前端可依相同模式補齊：

- `construction.diary`：`ConstructionDiaryView.vue`（占位頁已註記 composable 用法）
- `project.schedule`：`ManagementScheduleView.vue`（目前僅讀取 WBS／資源顯示圖表，無寫入按鈕）
- `repair.overview`：`RepairOverviewView.vue`（占位頁已註記 composable 用法）

---

## 參考

- 照片模組細則：`docs/photo-management-permissions.md`
- 後端檔案 category 對模組：`construction-dashboard-backend/docs/project-module-permissions.md`
