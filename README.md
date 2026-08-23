# GYEOT 韓國男裝自營電商 V1

Next.js App Router、TypeScript 與 Supabase 架構的單一品牌電商。

## 本機啟動

```bash
npm install
npm run dev
```

複製 `.env.example` 為 `.env.local` 後填入自己的 Supabase 設定。`SUPABASE_SERVICE_ROLE_KEY` 只能存在伺服器端，禁止使用 `NEXT_PUBLIC_` 前綴；若未設定，結帳 API 會改走已部署的 Supabase Edge Function。

## 安全邊界

- 商品公開讀取與 Admin／顧客私人資料分離。
- 價格、折扣、庫存、訂單總額及付款狀態由 Server 驗證。
- 正式環境不得啟用 Test Payment Adapter。
- Migration 位於 `supabase/migrations`，正式連線前需先審查並執行 RLS 測試。

## Supabase V1 基礎設施

- 專案：`morii-korean-selection-store`（首爾／`ap-northeast-2`，project ref `abpcgehunhtqrfackqyn`）。
- 初始 schema、RLS、PII 邊界、庫存保留與付款事件去重欄位已建立；22 張 public table 均啟用 RLS。
- Data API 採明確 grants：匿名只讀商品目錄；`profiles`、`addresses`、訂單與付款資料不提供匿名存取。
- `.env.local` 僅存 Supabase URL 與 publishable key，已被 `.gitignore` 排除；service-role key 不放入本機前端設定。
- 商品頁已改由 Supabase catalog 讀取；`/api/checkout` 優先使用 server-only service role，未設定時改呼叫 `checkout` Edge Function，由 Supabase secrets 執行真正建單。
- 目前付款仍是測試 adapter，會建立訂單、付款紀錄與 15 分鐘庫存 reservation，不會產生真實扣款。

## 登入入口

- 商城會員登入：`/login`；訪客不需登入即可結帳。
- 管理員／員工後台登入：`/admin-login`；後台路由 `/admin/*` 仍由 Server-side `admin` 角色保護。
- 目前員工權限採個別 Supabase Auth 帳號，不共用帳密；V1 的 `admin` 角色是完整後台權限，細分職務權限會在員工流程確定後再加入。

## Vercel 部署拓撲

- 商城（`NEXT_PUBLIC_APP_MODE=store`）：<https://korean-selection-store-rebuilt.vercel.app>
- 獨立管理站（`NEXT_PUBLIC_APP_MODE=admin`）：<https://gyeot-admin.vercel.app>
- 兩個前端共用同一個 Supabase 專案，確保商品、庫存、訂單與帳號資料一致；管理站只開放 `/admin-login` 與 `/admin/*`。
- 生產建置使用 `next build --webpack`，確保 Next.js Proxy 會被 Vercel 正確部署。
