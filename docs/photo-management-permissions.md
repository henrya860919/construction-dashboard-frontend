# 照片管理 — 權限規則（前後端對齊）

供擴充「照片管理」或相關 API 時遵循；模組 id、動作語意、檔案 `category` 必須一致，否則會出現「矩陣有開卻 403」或側欄／路由與實際守門不一致。

---

## 1. 模組與路由

| 項目 | 值 |
|------|-----|
| **權限模組 id** | `construction.photo` |
| **專案內路徑** | `/p/:projectId/files/photos`（pathSuffix：`/files/photos`） |
| **常數** | 前端 `src/constants/permission-modules.ts` 的 `NAV_PATH_PERMISSION_MODULE['/files/photos']`；後端 `src/constants/permission-modules.ts` 同 id |

- **進入頁面**：`useProjectRoutePermissionGuard` 以 `resolvePermissionPathSuffix` → `permissionModuleForProjectPath` 解析模組，無 **`read`** 則導向儀表板或 `/projects`。
- **側欄**：`AppSidebar` 用 `canReadPath(pathSuffix)`，同樣依 `NAV_PATH_PERMISSION_MODULE`；**必須**為 `/files/photos` 單獨對應 `construction.photo`，勿與 `/files`（`construction.upload`）共用。

---

## 2. 動作（create / read / update / delete）怎麼用

與 `useProjectModuleActions(projectId, 'construction.photo')` 及後端 `assertProjectModuleAction` 一致。

### 前端（`FilePhotosView.vue`）

- **`read`**：路由守門 + 側欄；頁內若需隱藏唯讀敏感區可再加 `photoPerm.canRead`（目前多數 UI 以 create/delete/update 區分）。
- **`create`**：上傳照片、新增相簿、照片加入相簿、**我的最愛**（與後端「寫入關聯」語意對齊時視為 create）。
- **`update`**：預留給需「編輯中繼資料」的操作；**我的最愛**在 UI 上允許 `canUpdate || canCreate` 亦可操作（與後端 add favorite 使用 `create` 並存時，前端放寬避免過嚴）。
- **`delete`**：刪除照片、刪除相簿、從相簿移除照片、移除我的最愛。

### 後端對照表

| 區域 | 行為 | `assertProjectModuleAction` 動作 |
|------|------|-----------------------------------|
| **檔案** `file.service` `ensureProjectFile` | 僅當 `Attachment.category === 'photo'`（`FILE_CATEGORY_PHOTO`） | 上傳／讀取檔案內容／刪附件 → `create` / `read` / `delete` |
| **相簿** `album.service` `ensurePhoto` | 列表／相簿內照片列表 | `read` |
| | 新增相簿、**照片加入相簿** | `create`（加入關聯視為建立） |
| | 刪相簿、從相簿移除照片 | `delete` |
| **我的最愛** `photo-favorite.service` | 列表 | `read` |
| | 加入最愛 | `create` |
| | 移除最愛 | `delete` |

---

## 3. 附件 `category`：`photo` 與 `construction.upload` 分離

圖庫／照片管理上傳時 **body 必須**帶 `category: 'photo'`（前端常數 `PHOTO_CATEGORY`），與後端 `FILE_CATEGORY_PHOTO` 一致。

`file.service.ts` 的 `ensureProjectFile` 規則：

| `category` | 權限模組 |
|------------|----------|
| `drawing_revision` | `project.drawings` |
| `photo` | `construction.photo` |
| 其他／null | `construction.upload` |

因此：**只開「照片管理」、未開「檔案／上傳」** 仍可上傳圖庫，**前提是** category 為 `photo`。  
一般檔案管理、其他業務 category 仍走 **`construction.upload`**。

---

## 4. 實作新功能時的檢查清單

1. **後端**：新 API 是否在專案範圍內？先 `assertCanAccessProject`，再 `assertProjectModuleAction(..., 'construction.photo', '<action>')`，動作與上表語意一致。
2. **若經過檔案上傳／讀檔／刪附件**：確認該筆附件的 `category`；圖庫一律 `photo`，才會守 `construction.photo`。
3. **前端**：`useProjectModuleActions(projectId, 'construction.photo')`；按鈕／選單用對 `canCreate` / `canRead` / `canUpdate` / `canDelete`。
4. **新專案內路由**：在 `permission-modules.ts` 的 `NAV_PATH_PERMISSION_MODULE` 新增 pathSuffix → 模組對應；若屬照片領域，應指向 **`construction.photo`**（或子路徑並在 `resolvePermissionPathSuffix` 能向上解析到已登記的鍵）。
5. **與後端常數同步**：`PermissionModuleId` 列表需與後端 `permission-modules.ts` 一致。

---

## 5. 相關檔案索引

| 層級 | 檔案 |
|------|------|
| 前端權限常數／路徑映射 | `src/constants/permission-modules.ts` |
| 前端模組能力 | `src/composables/useProjectModuleActions.ts`、`useProjectPermission.ts` |
| 前端路由 read 守門 | `src/composables/useProjectRoutePermissionGuard.ts` |
| 照片頁 | `src/views/files/FilePhotosView.vue` |
| 後端檔案與 category | `src/modules/file/file.service.ts`、`src/constants/file.ts` |
| 後端相簿／最愛 | `src/modules/album/album.service.ts`、`src/modules/photo-favorite/photo-favorite.service.ts` |
| 後端檔案 category 對照說明 | `docs/project-module-permissions.md`（「檔案 API：category → 模組」） |

---

## 6. 與其他「照片」功能的區別

行動端修繕等若使用 **其他** `category`（例如 `repair_photo`），`ensureProjectFile` 會走 **`construction.upload`**（或日後你為該 category 新增的模組），**不**自動等同 `construction.photo`。新業務線應明確決定模組與 category，並寫入本文件或 `project-module-permissions.md`。
