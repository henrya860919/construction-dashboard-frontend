# Construction Dashboard — Frontend

Vue 3 + Vite + Pinia + vue-echarts + **shadcn-vue**（new-york）。專案內路由採 **`/p/:projectId/...`**，並含 **PWA 現場查驗**（`/mobile`）。

---

## 技術棧摘要

| 項目 | 說明 |
|------|------|
| 框架 | Vue 3 + Vite |
| UI | shadcn-vue、Tailwind CSS 4 |
| 狀態 | Pinia |
| HTTP | axios（`src/api/client.ts`） |
| 圖表 | ECharts / vue-echarts |

API 路徑在程式中以 **`/api/v1/...`** 為前綴；`VITE_API_URL` 為**後端 origin**（不含路徑），例如 `https://api.example.com` 或 `http://localhost:3003`。

---

## 環境變數

1. 複製 **`.env.example`** 為 **`.env`**
2. 設定 **`VITE_API_URL`** 為後端 base（**不要結尾斜線**）

| 情境 | `VITE_API_URL` 範例 |
|------|---------------------|
| 本機直連後端 | `http://localhost:3003` |
| 本機後端在區網另一台機器 | `http://192.168.x.x:3003` |
| 正式環境 | `https://你的後端網域` |

### 本機搭配 Vite Proxy（可選）

`vite.config.ts` 已將 **`/api`** proxy 到 `http://localhost:3003`。若你希望瀏覽器請求走同源再轉發，可將 `VITE_API_URL` 設為**空字串**，則 axios 會對目前開發主機（預設 port **5175**）發出 `/api/v1/...`，由 Vite 轉到後端。

---

## 本機開發

```bash
npm install
cp .env.example .env
# 編輯 VITE_API_URL

npm run dev
```

- 開發伺服器預設：**`http://localhost:5175`**（`--host` 可區網存取）
- 請先啟動後端（預設 `3003`）並完成 DB migration

常用指令：

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式 |
| `npm run build` | `vue-tsc` + `vite build` |
| `npm run preview` | 預覽 production build（同樣 port 5175、含 `/api` proxy 設定） |
| `npm run lint` | ESLint |

---

## 正式環境建置

```bash
npm run build
```

產出目錄：**`dist/`**。部署時在平台設定：

- **Build command**：`npm run build`
- **Output directory**：`dist`
- **環境變數**：`VITE_API_URL=https://你的後端HTTPS網址`（與後端 `CORS_ORIGIN` 中列出的前端 origin 一致）

`VITE_*` 在 **build 時**代入，變更後需重新建置。

---

## 正式環境部署（範例：Vercel）

1. 將 repo 連到 Vercel（或匯入 GitHub 專案）。
2. Framework Preset：**Vite**
3. **Environment Variables**：新增 `VITE_API_URL` = 後端公開 HTTPS URL（無尾隨 `/`）。
4. Deploy。`vercel.json` 已設定 SPA fallback（`/(.*)` → `index.html`）。

### 與後端 CORS

後端 `CORS_ORIGIN` 必須包含此前端的正式 origin，例如：

`https://your-project.vercel.app`

若使用自訂網域，一併加入該 `https://...`。

---

## shadcn-vue 元件

與官網一致，請用 CLI 新增／覆寫：

```bash
npx shadcn-vue@latest add <元件名>
npx shadcn-vue@latest add <元件名> --overwrite
```

勿手動改 `src/components/ui/*` 內 CVA 的 base／variants。詳見 [shadcn-vue 文件](https://www.shadcn-vue.com/docs/components)。

---

## 與 iOS App 的關係

Web 與 App 共用同一後端 API（`/api/v1`）。App 端以環境變數 **`API_BASE_URL`** 指定完整 API root（含 `/api/v1`），見 constructionApp 的 README。

---

## 相關規範（開發時）

- 路由與側欄：`src/constants/routes.ts`、`navigation.ts`、`breadcrumb.ts`
- 主題：淺／深色需使用語意化 token（`theme-support`）
- 列表頁：見專案内 `ui-ux-principles` 與 `data-table-list-views` 說明
