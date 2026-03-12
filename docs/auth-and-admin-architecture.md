# 登入與後台架構（單租／多租）

本文件說明登入流程、後台入口、單租／多租後台的呈現與管理方式。

---

## 一、整體流程

```
登入頁 (/login)
    → 輸入 email / 密碼 → 後端驗證 → 回傳 JWT + user（含 id, email, name, tenantId, systemRole）
    → 前端存 token（localStorage）+ user → 導向 /projects（專案列表）

專案列表 (/projects)
    → 依權限顯示可存取的專案（系統層：本租戶或全部；專案層：僅被指派的專案）
    → 點選專案 → 進入 /p/:projectId/dashboard（工作區）

工作區內
    → 側欄：當前專案、切換專案、概況／監測／契約、專案列表
    → 頂欄：依角色顯示「後台」入口（見下）

後台入口（依角色顯示）
    → 租戶管理員 / 專案管理員：顯示「單租後台」→ /admin
    → 平台管理員：顯示「多租後台」→ /platform-admin
    → 僅專案層一般成員：可不顯示後台入口
```

---

## 二、角色與可見入口

| 角色 (systemRole) | 專案列表範圍 | 單租後台 (/admin) | 多租後台 (/platform-admin) |
|-------------------|--------------|-------------------|----------------------------|
| platform_admin    | 全部專案     | 可進（可選租戶視角）| ✓ 可進                     |
| tenant_admin      | 本租戶專案   | ✓ 可進            | ✗ 不可進                   |
| project_user      | 被指派專案   | ✗ 不可進（或僅有限）| ✗ 不可進                   |

---

## 三、單租後台（/admin）— 租戶自管

**對象**：tenant_admin（公司／租戶管理員）、或 project_admin（專案管理員，可僅開放部分功能）。

**入口**：頂欄或側欄「後台」或「管理」→ 點擊進入 `/admin`。

**版面**：獨立 layout（AdminLayout），左側欄為後台選單，主區為內容。

**功能區塊**：

| 選單項目     | 路徑           | 說明 |
|--------------|----------------|------|
| 專案管理     | /admin/projects | 本租戶專案列表；新增／編輯／停用專案；專案成員（ProjectMember）維護 |
| 成員管理     | /admin/members  | 本租戶使用者列表；邀請／停用；指派專案與角色（project_admin / member / viewer） |
| 公司設定     | /admin/settings | 租戶名稱、Logo 等（單租時即「公司」設定） |

**權限**：後端 API 依 JWT 的 `tenantId` 限定查詢／寫入範圍，僅能操作「當前租戶」資料。

---

## 四、多租後台（/platform-admin）— 平台營運

**對象**：僅 platform_admin（平台管理員）。

**入口**：頂欄「多租後台」或「平台管理」→ `/platform-admin`（僅在 systemRole 為 platform_admin 時顯示）。

**版面**：獨立 layout（PlatformAdminLayout），左側欄為平台選單。

**功能區塊**：

| 選單項目     | 路徑                        | 說明 |
|--------------|-----------------------------|------|
| 租戶管理     | /platform-admin/tenants     | 租戶 CRUD；建立／編輯／停用租戶 |
| 專案總覽     | /platform-admin/projects   | 全部專案列表；可依租戶篩選 |
| 使用者總覽   | /platform-admin/users      | 全部使用者；可依租戶篩選、檢視角色 |

**權限**：後端 API 僅在 JWT 為 platform_admin 時放行，可跨租戶查詢與管理。

---

## 五、管理流程摘要

1. **登入**：任一角色登入後皆先到專案列表；token 與 user 持久化，後續請求帶 Authorization。
2. **專案列表**：依角色回傳可存取專案（後端過濾）；選專案後進入工作區。
3. **工作區**：僅能操作有權的專案；側欄「切換專案」回專案列表。
4. **單租後台**：租戶／專案管理員從頂欄或側欄進入，管理「本租戶」專案與成員。
5. **多租後台**：平台管理員從頂欄進入，管理所有租戶、專案與使用者。
6. **路由守衛**：未登入 → 重導向 /login；已登入訪問 /login → 重導向 /projects；訪問 /admin 或 /platform-admin 時檢查角色，無權則 403 或重導向首頁。

---

## 六、前端路由結構

```
/login                     → AuthLayout, LoginView（未登入可訪問）
/                          → DefaultLayout
  /projects                → 專案列表
  /p/:projectId/...        → 專案內工作區
  /admin                   → AdminLayout（需 tenant_admin 或 project_admin）
    /admin/projects        → 專案管理
    /admin/members         → 成員管理
    /admin/settings        → 公司設定
  /platform-admin          → PlatformAdminLayout（需 platform_admin）
    /platform-admin/tenants   → 租戶管理
    /platform-admin/projects  → 專案總覽
    /platform-admin/users     → 使用者總覽
```

---

## 七、後端 API 對應

| 用途         | 方法/路徑                     | 說明 |
|--------------|-------------------------------|------|
| 登入         | POST /api/v1/auth/login       | body: email, password；回傳 accessToken, user |
| 當前使用者   | GET /api/v1/auth/me           | Header: Authorization；回傳 user（含 systemRole, tenantId） |
| 專案列表     | GET /api/v1/projects          | 依 JWT 過濾：platform_admin 全部；其餘本租戶或專案成員 |
| 單租後台     | GET/POST /api/v1/admin/projects, /admin/users 等 | 需 JWT，且 tenantId 一致，限定本租戶 |
| 多租後台     | GET/POST /api/v1/platform-admin/tenants, /projects, /users | 需 JWT 且 systemRole === platform_admin |

詳細 API 規格見後端 `docs/backend-prisma-api.md` 與 API 契約 `.cursor/rules/api-contract.mdc`。

---

## 八、測試帳號（seed）

執行 `npm run db:seed` 後可用以下帳號登入（密碼皆為 `password123`）：

| Email | 角色 | 可進單租後台 | 可進多租後台 | 專案列表範圍 |
|-------|------|--------------|--------------|--------------|
| admin@example.com | tenant_admin | ✓ | ✗ | 本租戶專案 |
| member@example.com | project_user | ✗ | ✗ | 被指派專案 |
| platform@example.com | platform_admin | ✓ | ✓ | 全部專案 |
