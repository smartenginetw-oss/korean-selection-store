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
  paymentProvider: "test";
  consentVersion?: string;
  couponCode?: string;
  customer: {
    email: string;
    phone: string;
    recipientName: string;
    postalCode: string;
    city: string;
    district: string;
    addressLine: string;
    customerNote?: string;
  };
  items: Array<{ variantId: string; quantity: number }>;
};

type PreviewPayload = {
  action: "preview";
  couponCode: string;
  items: Array<{ variantId: string; quantity: number }>;
};

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message: string, status: number, code: string) {
  return json({ error: { code, message } }, status);
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
  if (value.paymentProvider !== "test") return false;
  if (typeof value.consentVersion !== "undefined" && (typeof value.consentVersion !== "string" || value.consentVersion.length > 40)) return false;
  if (typeof value.couponCode !== "undefined" && (typeof value.couponCode !== "string" || value.couponCode.trim().length > 40)) return false;

  const customer = value.customer;
  if (!isRecord(customer)) return false;
  const requiredStrings = ["email", "phone", "recipientName", "postalCode", "city", "district", "addressLine"];
  if (requiredStrings.some((key) => typeof customer[key] !== "string" || String(customer[key]).trim().length === 0)) return false;
  if (String(customer.email).length > 254 || !String(customer.email).includes("@")) return false;
  if (!PHONE.test(String(customer.phone).trim())) return false;
  if (String(customer.recipientName).trim().length > 80 || String(customer.postalCode).trim().length > 10 || String(customer.city).trim().length > 30 || String(customer.district).trim().length > 30 || String(customer.addressLine).trim().length > 160) return false;
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

async function invokeCheckout(payload: CheckoutPayload, profileId: string | null) {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const secret = databaseKey();
  if (!baseUrl || !secret) return errorResponse("Checkout server 尚未設定安全金鑰。", 503, "checkout_not_configured");

  const requestHeaders: Record<string, string> = {
    "content-type": "application/json",
    apikey: secret.key,
  };
  // Legacy service_role is JWT-based and needs Authorization. New secret keys
  // must stay on apikey only because they are deliberately not JWTs.
  if (!secret.isNewSecret) requestHeaders.authorization = `Bearer ${secret.key}`;

  const response = await fetch(`${baseUrl}/rest/v1/rpc/create_checkout_order_for_member`, {
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
    if (code === "22023" && typeof dbError.message === "string" && dbError.message.toLowerCase().includes("coupon")) return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
    if (code === "22023") return errorResponse("結帳資料無法驗證，請重新確認。", 400, "validation_error");
    console.error("[checkout] database RPC failed", code ?? "unknown");
    return errorResponse("目前無法建立訂單，請稍後再試。", 502, "checkout_unavailable");
  }

  return json({ order: body });
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
    body: JSON.stringify({ p_payload: { couponCode: payload.couponCode, items: payload.items } }),
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
    if (!validatePreviewPayload(payload)) return errorResponse("優惠碼資料格式不正確，請重新確認。", 400, "invalid_request");
    try {
      return await invokeCouponPreview(payload);
    } catch (error) {
      console.error("[coupon-preview] unexpected function error", error instanceof Error ? error.message : "unknown error");
      return errorResponse("目前無法檢查優惠碼，請稍後再試。", 502, "preview_unavailable");
    }
  }

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
