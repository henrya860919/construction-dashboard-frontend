# Construction Dashboard - Frontend

Vue 3 + Vite + Pinia + vue-echarts + shadcn-vue。主題與 theme 變數已設好，新元件載入即可用。

## 加 shadcn-vue 元件（與官網規範一致）

```bash
npx shadcn-vue@latest add <元件名>
```

例如：`add card`、`add input`、`add table`、`add chart`。元件會出現在 `src/components/ui/`，用 `@/components/ui/xxx` 引入。**不要手動改 CVA variants/size**，以維持與 [官網](https://www.shadcn-vue.com/docs/components) 一致。

若某元件已存在但想對齊官網最新版：

```bash
npx shadcn-vue@latest add <元件名> --overwrite
```

## 環境

1. 複製 `.env.example` 為 `.env`
2. 設定 `VITE_API_URL` 為後端 API 網址（本機開發可為 `http://localhost:3003`）

## 指令

- `npm run dev` - 開發（port 5175，/api 會 proxy 到後端 3003）
- `npm run build` - 建置
- `npm run preview` - 預覽建置結果
