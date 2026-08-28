# GYEOT 韓國男裝自營電商 V1

Next.js App Router、TypeScript 與 Supabase 架構的單一品牌電商。

## 本機啟動

```bash
npm install
npm run check
npm run dev
```

專案需要 Node.js 22 以上（目前 `.nvmrc` 固定 Node 24）。`npm run check` 會依序執行 TypeScript、ESLint 與 production build。

複製 `.env.example` 為 `.env.local` 後填入自己的 Supabase 設定。`SUPABASE_SERVICE_ROLE_KEY` 只能存在伺服器端，禁止使用 `NEXT_PUBLIC_` 前綴；若未設定，結帳 API 會改走已部署的 Supabase Edge Function。

## 安全邊界

- 商品公開讀取與後台／顧客私人資料分離。
- 價格、折扣、庫存、訂單總額及付款狀態由 Server 驗證。
- 正式環境不得啟用 Test Payment Adapter。
- Migration 位於 `supabase/migrations`，正式連線前需先審查並執行 RLS 測試。

## Supabase V1 基礎設施

- 專案：`morii-korean-selection-store`（首爾／`ap-northeast-2`，project ref `abpcgehunhtqrfackqyn`）。
- 初始 schema、RLS、PII 邊界、庫存保留與付款事件去重欄位已建立；22 張 public table 均啟用 RLS。
- Data API 採明確 grants：匿名只讀商品目錄；`profiles`、`addresses`、訂單與付款資料不提供匿名存取。
- `.env.local` 僅存 Supabase URL 與 publishable key，已被 `.gitignore` 排除；service-role key 不放入本機前端設定。
- 商品頁已改由 Supabase catalog 讀取；商品詳情路由採 on-demand server rendering，避免上架、價格或售罄狀態被部署時的靜態快照卡住；`/api/checkout` 優先使用 server-only service role，未設定時改呼叫 `checkout` Edge Function，由 Supabase secrets 執行真正建單。
- 商品詳情頁會在載入、切換規格與重新回到頁面時，以 `no-store` 公開狀態檢查同步規格的現貨／預購／售罄與價格；同步失敗時仍由結帳 Server 做最後驗證。
- 目前付款仍是測試 adapter，會建立訂單與付款紀錄，不會產生真實扣款；建單時的庫存保留會在付款完成後持續到後台出貨結算，避免已付款訂單被逾時清理。
- Checkout 已支援 ECPay Stage 的信用卡、ATM 虛擬帳號與超商代碼選擇；ATM／超商代碼的繳費資訊會由 `ecpay-payment-info` callback 保存到訂單明細。這仍是 Stage 整合，不能視為正式金流已上線。
- 測試付款在正式環境預設關閉；本機／Preview 必須同時以 `TEST_PAYMENT_ENABLED=true`（Server／Edge Function）與 `NEXT_PUBLIC_TEST_PAYMENT_ENABLED=true`（前端）明確開啟，避免正式商城被誤用測試付款。
- ECPay AIO 測試 adapter 已預留，但預設關閉；啟用前需在 Supabase Edge Function secrets 設定 `ECPAY_ENABLED=true`、MerchantID、HashKey、HashIV，並同步將 Preview 的 `NEXT_PUBLIC_ECPAY_ENABLED` 設為 `true`。目前只建議使用 Stage + Credit，正式端點不會由程式自動切換。

## 登入入口

- 商城會員登入：`/login`；訪客不需登入即可結帳。
- 老闆／合夥人／員工後台登入：`/admin-login`；後台路由 `/admin/*` 仍由 Server-side `user_roles` 角色保護。
- 會員與老闆／員工皆可從登入頁使用 `/forgot-password` 重設密碼；正式使用前，請在 Supabase Auth URL Configuration 將商城與管理站的 `/reset-password` 加入 Redirect URLs。重設連結會使用穩定的商城／管理站別名，不會綁定 Vercel 的暫時部署網址。
- Supabase Authentication → Email Templates → Reset Password 建議直接使用 Supabase 提供的 `{{ .ConfirmationURL }}` 作為連結，不要把 `{{ .SiteURL }}` 寫死成舊的 Vercel 部署網址；若自行組裝連結，須改用 `{{ .RedirectTo }}` 並保留 token／type 參數。修改後請從目前的商城／管理站登入頁重新寄送一封新信，舊信件仍會導向舊網址。
- 目前員工權限採個別 Supabase Auth 帳號，不共用帳密；`admin`（老闆）、`staff`、`catalog_staff`、`order_staff` 已依後台能力分流。

### 登入方式

V1 目前統一提供 Email＋密碼與 LINE 兩種登入方式。商城 `/login` 與管理站 `/admin-login` 共用同一套登入表單；管理站登入後會再依 `user_roles` 檢查後台權限，未授權的 LINE／會員帳號無法進入管理端。Magic Link 已停用，避免登入連結在商城與管理站之間錯誤跳轉。

LINE 登入需先在 Supabase Authentication 設定 Custom OAuth Provider `custom:line`，並將各部署的 `/auth/callback` 加入 Redirect URLs；若尚未設定，畫面會保留 Email＋密碼登入作為可用備援。

## V1 已完成的營運工具

- 商品資訊欄位：材質、尺寸、Model、產地與洗滌方式。
- 商品生命週期：草稿、上架、封存與恢復草稿；分類可由「商品分類」管理。
- 商品刪除安全規則：上架商品必須先封存；有訂單、庫存保留或異動歷史的商品不可硬刪，只能保留封存狀態。
- 圖片管理：替代文字、排序與主圖切換。
- 訂單管理：訂單編號／Email／姓名搜尋、付款／訂單／履約篩選、分頁瀏覽、履約狀態更新，以及 Test adapter 的部分／全額退款紀錄；訂單列表可依目前篩選條件匯出遮罩個資的 UTF-8 CSV。
- 付款失敗的 ECPay 訂單可在會員訂單明細選擇信用卡、ATM 或超商代碼重新付款；重新付款仍沿用原訂單的冪等保護。
- 報表與總覽：日／月／年收支報表、今日訂單／今日與本月營業額、近 14 天趨勢與熱門商品；報表可依目前篩選條件匯出 UTF-8 CSV（摘要、趨勢、熱賣商品與月份營業費用）。

## V1.5 採購基礎（進行中）

- 供應商管理已建立：供應商名稱、國家、聯絡人、電話、Email、LINE、Kakao、付款條件與備註；供應商可停用但不刪除歷史資料。
- `/admin/suppliers` 僅開放老闆、合夥人與全營運員工，供應商資料不提供匿名或商城 API 存取。
- 廠商報價已建立：報價單號、日期、幣別、匯率、狀態、備註，以及商品／暫存商品、規格、單件成本、MOQ 與數量；商品與 SKU 會保存快照以保留歷史成本。
- `/admin/quotations` 僅開放老闆、合夥人與全營運員工；報價資料啟用 RLS，匿名角色無 Data API 權限，草稿明細可調整但非草稿報價不提供刪除。
- 採購單已建立：可從有效報價單帶入供應商、記錄下單／預計到貨日、幣別匯率、單件成本、數量、運費與其他費用，並由資料庫觸發器自動計算商品成本與採購總額。
- `/admin/purchase-orders` 僅開放老闆、合夥人與全營運員工；採購單狀態包含草稿、已下單、部分到貨、已收貨與已取消，採購單與明細均啟用 RLS，匿名角色無 Data API 權限。
- 到貨驗收已接入：可在已下單／部分到貨採購單建立不可刪除的到貨批次，輸入每筆實收數量；資料庫交易會鎖定採購明細、檢查剩餘數量、增加 `inventory_levels.on_hand` 並寫入 `purchase_received` 異動，最後自動更新部分到貨／已收貨狀態。
- 暫存商品沒有 SKU 規格，無法自動入庫；到貨頁會明確標示並阻止送出。多商品採購單與分批驗收已保留資料結構，採購單建立頁目前先提供一筆明細。

## Analytics（可選）

- 設定 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 後，商城才會載入 GA4；管理站不載入追蹤腳本。
- 已預留 `view_item`、`add_to_cart`、`begin_checkout` 與 `purchase` 事件；事件只包含商品、金額與訂單編號，不傳姓名、Email、電話或地址。
- 未設定測量 ID 時，事件函式會安全略過，不會阻塞商品瀏覽、結帳或訂單建立。

退款目前只會更新測試付款紀錄與訂單時間線，不會對真實金流產生退款；正式金流與 webhook 必須在指定金流商後再接入。

## ECPay 測試環境

- 使用綠界 AIO 全頁導向付款，不使用 iframe；付款頁由 ECPay Stage 提供。
- `checkout` Edge Function 只在收到 `paymentProvider=ecpay` 且 `ECPAY_ENABLED=true` 時產生簽名表單；未設定時仍維持測試付款 adapter。
- 綠界的 Server-to-Server ReturnURL 指向 `ecpay-callback` Edge Function，先驗證 CheckMacValue，再以冪等 RPC 更新付款、訂單時間線與庫存保留。
- ATM／超商代碼另以 `PaymentInfoURL` 指向 `ecpay-payment-info`，只保存銀行代碼、虛擬帳號／繳費代碼與期限等必要資訊，不保存卡號或驗證資料；若你改用自訂 URL，請設定 `ECPAY_PAYMENT_INFO_URL`。
- 付款失敗會釋放庫存與優惠碼使用次數；ECPay 待付款訂單的 15 分鐘保留逾時後會由後續清理流程釋放。付款成功後保留會停止逾時，直到後台出貨結算；若付款回呼抵達時保留已先過期，訂單會進入 `exception`，交由後台人工處理，避免超賣。
- ECPay MerchantID／HashKey／HashIV 僅放 Supabase secrets，禁止放進 `NEXT_PUBLIC_` 環境變數或 Git。

## Vercel 部署拓撲

- 商城（`NEXT_PUBLIC_APP_MODE=store`）：<https://korean-selection-store-rebuilt.vercel.app>
- 獨立管理站（`NEXT_PUBLIC_APP_MODE=admin`）：<https://gyeot-admin.vercel.app>
- 兩個前端共用同一個 Supabase 專案，確保商品、庫存、訂單與帳號資料一致；管理站只開放 `/admin-login` 與 `/admin/*`。
- 生產建置使用 `next build --webpack`，確保 Next.js Proxy 會被 Vercel 正確部署。
