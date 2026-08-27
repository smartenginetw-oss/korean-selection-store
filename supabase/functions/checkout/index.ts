export {};

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const MAX_BODY_BYTES = 64 * 1024;
const IDEMPOTENCY_KEY = /^[a-zA-Z0-9:_-]{16,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE = /^09[0-9]{8}$/;

type CheckoutPayload = {
  idempotencyKey: string;
  paymentProvider: "test" | "ecpay";
  paymentMethod?: "credit" | "atm" | "cvs";
  shippingMethod?: "home_delivery" | "cvs_711" | "cvs_family";
  consentVersion?: string;
  couponCode?: string;
  customer: {
    email: string;
    phone: string;
    recipientName: string;
    postalCode?: string;
    city?: string;
    district?: string;
    addressLine?: string;
    storeCode?: string;
    storeName?: string;
    storeAddress?: string;
    customerNote?: string;
  };
  items: Array<{ variantId: string; quantity: number }>;
};

type PreviewPayload = {
  action: "preview";
  couponCode: string;
  shippingMethod?: "home_delivery" | "cvs_711" | "cvs_family";
  items: Array<{ variantId: string; quantity: number }>;
};

type EcpayPaymentConfig = {
  merchantId: string;
  hashKey: string;
  hashIv: string;
  returnUrl: string;
  paymentInfoUrl?: string;
  clientBackUrl?: string;
  orderResultUrl?: string;
  endpoint: string;
};

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, ...extraHeaders } });
}

function errorResponse(message: string, status: number, code: string, extraHeaders: Record<string, string> = {}) {
  return json({ error: { code, message } }, status, extraHeaders);
}

function isTestPaymentEnabled() {
  // The Edge Function is the final server-side boundary. Keep test payments
  // disabled unless the function secret explicitly opts them in.
  return Deno.env.get("TEST_PAYMENT_ENABLED") === "true";
}

function publicApiKeys(): string[] {
  const keys: string[] = [];
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (publishable) {
    try {
      const parsed = JSON.parse(publishable) as Record<string, unknown>;
      for (const value of Object.values(parsed)) if (typeof value === "string") keys.push(value);
    } catch {
      // The legacy fallback below covers projects that have not migrated keys.
    }
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) keys.push(legacy);
  return keys;
}

function isAuthorizedRequest(request: Request) {
  const presented = request.headers.get("apikey");
  if (!presented) return false;
  const allowed = publicApiKeys();
  // Hosted Supabase supplies one of these values automatically. Refuse to
  // run if the function was deployed without its public key configuration.
  return allowed.length > 0 && allowed.includes(presented);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(value: unknown): value is CheckoutPayload {
  if (!isRecord(value)) return false;
  if (typeof value.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(value.idempotencyKey)) return false;
  if (value.paymentProvider !== "test" && value.paymentProvider !== "ecpay") return false;
  if (typeof value.paymentMethod !== "undefined" && value.paymentMethod !== "credit" && value.paymentMethod !== "atm" && value.paymentMethod !== "cvs") return false;
  if (typeof value.consentVersion !== "undefined" && (typeof value.consentVersion !== "string" || value.consentVersion.length > 40)) return false;
  const shippingMethod = value.shippingMethod ?? "home_delivery";
  if (shippingMethod !== "home_delivery" && shippingMethod !== "cvs_711" && shippingMethod !== "cvs_family") return false;
  if (typeof value.couponCode !== "undefined" && (typeof value.couponCode !== "string" || value.couponCode.trim().length > 40)) return false;

  const customer = value.customer;
  if (!isRecord(customer)) return false;
  const requiredStrings = ["email", "phone", "recipientName"];
  if (requiredStrings.some((key) => typeof customer[key] !== "string" || String(customer[key]).trim().length === 0)) return false;
  if (String(customer.email).length > 254 || !String(customer.email).includes("@")) return false;
  if (!PHONE.test(String(customer.phone).trim())) return false;
  if (String(customer.recipientName).trim().length > 80) return false;
  if (typeof customer.postalCode !== "undefined" && String(customer.postalCode).trim().length > 10) return false;
  if (typeof customer.city !== "undefined" && String(customer.city).trim().length > 30) return false;
  if (typeof customer.district !== "undefined" && String(customer.district).trim().length > 30) return false;
  if (typeof customer.addressLine !== "undefined" && String(customer.addressLine).trim().length > 160) return false;
  if (typeof customer.storeCode !== "undefined" && String(customer.storeCode).trim().length > 40) return false;
  if (typeof customer.storeName !== "undefined" && String(customer.storeName).trim().length > 80) return false;
  if (typeof customer.storeAddress !== "undefined" && String(customer.storeAddress).trim().length > 160) return false;
  if (shippingMethod === "home_delivery" && [customer.postalCode, customer.city, customer.district, customer.addressLine].some((item) => typeof item !== "string" || item.trim().length === 0)) return false;
  if ((shippingMethod === "cvs_711" || shippingMethod === "cvs_family") && [customer.storeCode, customer.storeName, customer.storeAddress].some((item) => typeof item !== "string" || item.trim().length === 0)) return false;
  if (typeof customer.customerNote !== "undefined" && (typeof customer.customerNote !== "string" || customer.customerNote.trim().length > 500)) return false;

  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) return false;
  return value.items.every((item) => {
    if (!isRecord(item) || typeof item.variantId !== "string" || !UUID.test(item.variantId)) return false;
    const quantity = item.quantity;
    return typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10;
  });
}

function validatePreviewPayload(value: unknown): value is PreviewPayload {
  if (!isRecord(value) || value.action !== "preview") return false;
  if (typeof value.couponCode !== "string" || value.couponCode.trim().length < 1 || value.couponCode.trim().length > 40) return false;
  if (typeof value.shippingMethod !== "undefined" && value.shippingMethod !== "home_delivery" && value.shippingMethod !== "cvs_711" && value.shippingMethod !== "cvs_family") return false;
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) return false;
  return value.items.every((item) => {
    if (!isRecord(item) || typeof item.variantId !== "string" || !UUID.test(item.variantId)) return false;
    return typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10;
  });
}

function databaseKey(): { key: string; isNewSecret: boolean } | null {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      const key = parsed.default;
      if (typeof key === "string" && key.length > 0) return { key, isNewSecret: key.startsWith("sb_secret_") };
    } catch {
      // Fall through to the legacy service-role variable.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return legacy ? { key: legacy, isNewSecret: false } : null;
}

function requestSource(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (forwarded) return forwarded.slice(0, 120);
  if (realIp) return realIp.slice(0, 120);
  const authorization = request.headers.get("authorization")?.trim();
  return authorization ? `auth:${authorization.slice(-120)}` : "unknown";
}

async function digestRateLimitKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ecpayConfig(): EcpayPaymentConfig | null {
  if (Deno.env.get("ECPAY_ENABLED") !== "true") return null;
  const merchantId = Deno.env.get("ECPAY_MERCHANT_ID")?.trim();
  const hashKey = Deno.env.get("ECPAY_HASH_KEY")?.trim();
  const hashIv = Deno.env.get("ECPAY_HASH_IV")?.trim();
  const returnUrl = Deno.env.get("ECPAY_RETURN_URL")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!merchantId || !hashKey || !hashIv || !returnUrl) return null;
  return {
    merchantId,
    hashKey,
    hashIv,
    returnUrl,
    paymentInfoUrl: Deno.env.get("ECPAY_PAYMENT_INFO_URL")?.trim()
      || (supabaseUrl ? `${supabaseUrl}/functions/v1/ecpay-payment-info` : undefined),
    clientBackUrl: Deno.env.get("ECPAY_CLIENT_BACK_URL")?.trim() || undefined,
    orderResultUrl: Deno.env.get("ECPAY_ORDER_RESULT_URL")?.trim() || undefined,
    // Stage is deliberately the safe default. Production requires an explicit
    // endpoint secret/configuration change after merchant approval.
    endpoint: Deno.env.get("ECPAY_ENDPOINT")?.trim() || "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
  };
}

function taipeiTradeDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}/${values.month}/${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

async function ecpayCheckMacValue(fields: Record<string, string>, config: EcpayPaymentConfig) {
  const sorted = Object.entries(fields)
    .filter(([key]) => key !== "CheckMacValue")
    .sort(([left], [right]) => left.toLowerCase().localeCompare(right.toLowerCase()));
  const raw = `HashKey=${config.hashKey}&${sorted.map(([key, value]) => `${key}=${value}`).join("&")}&HashIV=${config.hashIv}`;
  const encoded = encodeURIComponent(raw)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7e")
    .replace(/'/g, "%27")
    .toLowerCase()
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function buildEcpayPayment(order: Record<string, unknown>, paymentMethod: "credit" | "atm" | "cvs" = "credit") {
  const config = ecpayConfig();
  if (!config) return { error: errorResponse("ECPay 測試環境尚未設定，請先補齊伺服器密鑰。", 503, "ecpay_not_configured") };
  const orderNumber = typeof order.orderNumber === "string" ? order.orderNumber : "";
  const merchantTradeNo = typeof order.merchantTradeNo === "string" ? order.merchantTradeNo : "";
  const orderId = typeof order.orderId === "string" ? order.orderId : "";
  const totalAmount = typeof order.grandTotal === "number" ? order.grandTotal : 0;
  if (!orderNumber || !merchantTradeNo || !orderId || !Number.isInteger(totalAmount) || totalAmount < 1) {
    return { error: errorResponse("ECPay 訂單資料不完整，請稍後再試。", 502, "ecpay_invalid_order") };
  }

  const fields: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: taipeiTradeDate(),
    PaymentType: "aio",
    TotalAmount: String(totalAmount),
    TradeDesc: "GYEOT online order",
    ItemName: `GYEOT order ${orderNumber}`.slice(0, 200),
    ReturnURL: config.returnUrl,
    ChoosePayment: paymentMethod === "atm" ? "ATM" : paymentMethod === "cvs" ? "CVS" : Deno.env.get("ECPAY_CHOOSE_PAYMENT")?.trim() || "Credit",
    EncryptType: "1",
    CustomField1: orderNumber,
    CustomField2: orderId,
  };
  if (config.clientBackUrl) fields.ClientBackURL = config.clientBackUrl;
  if (config.orderResultUrl) fields.OrderResultURL = config.orderResultUrl;
  if ((paymentMethod === "atm" || paymentMethod === "cvs") && config.paymentInfoUrl) {
    fields.PaymentInfoURL = config.paymentInfoUrl;
  }
  fields.CheckMacValue = await ecpayCheckMacValue(fields, config);
  return { payment: { provider: "ecpay", method: "POST", action: config.endpoint, fields } };
}

async function enforceRateLimit(request: Request, scope: "checkout" | "coupon_preview", limit: number, windowSeconds: number): Promise<Response | null> {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const secret = databaseKey();
  const unavailableCode = scope === "checkout" ? "checkout_not_configured" : "preview_not_configured";
  const unavailableMessage = scope === "checkout" ? "Checkout server 尚未設定安全金鑰。" : "優惠碼服務尚未設定安全金鑰。";
  if (!baseUrl || !secret) return errorResponse(unavailableMessage, 503, unavailableCode);

  const rateKey = `${scope}:${await digestRateLimitKey(requestSource(request))}`;
  const requestHeaders: Record<string, string> = { "content-type": "application/json", apikey: secret.key };
  if (!secret.isNewSecret) requestHeaders.authorization = `Bearer ${secret.key}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/rpc/consume_api_rate_limit`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ p_rate_key: rateKey, p_limit: limit, p_window_seconds: windowSeconds }),
    });
  } catch (error) {
    console.error(`[${scope}] rate-limit request failed`, error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法驗證請求頻率，請稍後再試。", 503, "rate_limit_unavailable");
  }

  if (!response.ok) {
    console.error(`[${scope}] rate-limit RPC failed`, response.status);
    return errorResponse("目前無法驗證請求頻率，請稍後再試。", 503, "rate_limit_unavailable");
  }

  let decision: { allowed?: unknown; retryAfterSeconds?: unknown } = {};
  try {
    decision = await response.json() as { allowed?: unknown; retryAfterSeconds?: unknown };
  } catch {
    return errorResponse("目前無法驗證請求頻率，請稍後再試。", 503, "rate_limit_unavailable");
  }

  if (decision.allowed === true) return null;
  const retryAfter = Math.max(1, Math.min(3600, Number(decision.retryAfterSeconds) || windowSeconds));
  return errorResponse("操作太頻繁，請稍後再試。", 429, "rate_limited", { "retry-after": String(retryAfter) });
}

async function resolveAuthenticatedProfileId(request: Request): Promise<{ profileId: string | null; error?: Response }> {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return { profileId: null };
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return { profileId: null, error: errorResponse("結帳登入狀態無效，請重新登入。", 401, "unauthorized") };
  }

  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const secret = databaseKey();
  if (!baseUrl || !secret) {
    return { profileId: null, error: errorResponse("Checkout server 尚未設定安全金鑰。", 503, "checkout_not_configured") };
  }

  try {
    const response = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: secret.key, authorization },
    });
    if (!response.ok) return { profileId: null, error: errorResponse("結帳登入狀態無效，請重新登入。", 401, "unauthorized") };
    const body = await response.json() as { id?: unknown };
    if (typeof body.id !== "string" || !UUID.test(body.id)) {
      return { profileId: null, error: errorResponse("結帳登入狀態無效，請重新登入。", 401, "unauthorized") };
    }
    return { profileId: body.id };
  } catch {
    return { profileId: null, error: errorResponse("目前無法驗證會員登入狀態，請稍後再試。", 503, "checkout_unavailable") };
  }
}

async function invokeCheckout(payload: CheckoutPayload, profileId: string | null): Promise<Response> {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const secret = databaseKey();
  if (!baseUrl || !secret) return errorResponse("Checkout server 尚未設定安全金鑰。", 503, "checkout_not_configured");
  if (payload.paymentProvider === "test" && !isTestPaymentEnabled()) {
    return errorResponse("正式環境未開放測試付款，請選擇可用的付款方式。", 503, "test_payment_disabled");
  }
  if (payload.paymentProvider === "ecpay" && !ecpayConfig()) {
    return errorResponse("ECPay 測試環境尚未設定，請先補齊伺服器密鑰。", 503, "ecpay_not_configured");
  }

  const requestHeaders: Record<string, string> = {
    "content-type": "application/json",
    apikey: secret.key,
  };
  // Legacy service_role is JWT-based and needs Authorization. New secret keys
  // must stay on apikey only because they are deliberately not JWTs.
  if (!secret.isNewSecret) requestHeaders.authorization = `Bearer ${secret.key}`;

  const rpc = payload.paymentProvider === "ecpay"
    ? "create_ecpay_checkout_order_for_member"
    : "create_checkout_order_for_member";
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ p_payload: payload, p_idempotency_key: payload.idempotencyKey, p_profile_id: profileId }),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return errorResponse("目前無法建立訂單，請稍後再試。", 502, "checkout_unavailable");
  }

  if (!response.ok) {
    const dbError = isRecord(body) ? body : {};
    const code = typeof dbError.code === "string" ? dbError.code : undefined;
    if (code === "P0001") return errorResponse("商品庫存或規格已變更，請返回購物車重新確認。", 409, "inventory_conflict");
    if (code === "22023" && typeof dbError.message === "string" && dbError.message.toLowerCase().includes("idempotency")) return errorResponse("此訂單編號已用於其他付款方式，請重新整理購物車。", 409, "idempotency_conflict");
    if (code === "22023" && typeof dbError.message === "string" && dbError.message.toLowerCase().includes("coupon")) return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
    if (code === "22023") return errorResponse("結帳資料無法驗證，請重新確認。", 400, "validation_error");
    console.error("[checkout] database RPC failed", code ?? "unknown");
    return errorResponse("目前無法建立訂單，請稍後再試。", 502, "checkout_unavailable");
  }

  const order = isRecord(body) ? body : {};
  if (payload.paymentProvider === "ecpay") {
    const payment = await buildEcpayPayment(order, payload.paymentMethod ?? "credit");
    if ("error" in payment && payment.error) return payment.error;
    return json({ order, payment: payment.payment });
  }
  return json({ order });
}

async function invokeCouponPreview(payload: PreviewPayload) {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const secret = databaseKey();
  if (!baseUrl || !secret) return errorResponse("優惠碼服務尚未設定安全金鑰。", 503, "preview_not_configured");

  const requestHeaders: Record<string, string> = { "content-type": "application/json", apikey: secret.key };
  if (!secret.isNewSecret) requestHeaders.authorization = `Bearer ${secret.key}`;
  const response = await fetch(`${baseUrl}/rest/v1/rpc/preview_coupon_discount`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ p_payload: { couponCode: payload.couponCode, shippingMethod: payload.shippingMethod, items: payload.items } }),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return errorResponse("目前無法檢查優惠碼，請稍後再試。", 502, "preview_unavailable");
  }
  if (!response.ok) {
    const dbError = isRecord(body) ? body : {};
    const code = typeof dbError.code === "string" ? dbError.code : undefined;
    if (code === "P0001") return errorResponse("商品規格已變更，請回到購物車重新確認。", 409, "inventory_conflict");
    if (code === "22023" && typeof dbError.message === "string" && dbError.message.toLowerCase().includes("coupon")) return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
    if (code === "22023") return errorResponse("優惠碼資料無法驗證，請重新確認。", 400, "validation_error");
    console.error("[coupon-preview] database RPC failed", code ?? "unknown");
    return errorResponse("目前無法檢查優惠碼，請稍後再試。", 502, "preview_unavailable");
  }
  return json({ preview: body });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return errorResponse("只接受 POST 結帳請求。", 405, "method_not_allowed");
  if (!isAuthorizedRequest(request)) return errorResponse("結帳請求未授權。", 401, "unauthorized");

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return errorResponse("結帳資料過大。", 413, "payload_too_large");

  let payload: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return errorResponse("結帳資料過大。", 413, "payload_too_large");
    payload = JSON.parse(raw);
  } catch {
    return errorResponse("結帳資料格式不正確，請重新確認。", 400, "invalid_request");
  }

  if (isRecord(payload) && payload.action === "preview") {
    const rateLimitResponse = await enforceRateLimit(request, "coupon_preview", 30, 300);
    if (rateLimitResponse) return rateLimitResponse;
    if (!validatePreviewPayload(payload)) return errorResponse("優惠碼資料格式不正確，請重新確認。", 400, "invalid_request");
    try {
      return await invokeCouponPreview(payload);
    } catch (error) {
      console.error("[coupon-preview] unexpected function error", error instanceof Error ? error.message : "unknown error");
      return errorResponse("目前無法檢查優惠碼，請稍後再試。", 502, "preview_unavailable");
    }
  }

  const rateLimitResponse = await enforceRateLimit(request, "checkout", 8, 600);
  if (rateLimitResponse) return rateLimitResponse;
  if (!validatePayload(payload)) return errorResponse("結帳資料格式不正確，請重新確認。", 400, "invalid_request");

  try {
    const identity = await resolveAuthenticatedProfileId(request);
    if (identity.error) return identity.error;
    return await invokeCheckout(payload, identity.profileId);
  } catch (error) {
    console.error("[checkout] unexpected function error", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法建立訂單，請稍後再試。", 502, "checkout_unavailable");
  }
});
