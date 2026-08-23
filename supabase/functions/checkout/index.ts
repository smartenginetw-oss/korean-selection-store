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

async function invokeCheckout(payload: CheckoutPayload) {
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

  const response = await fetch(`${baseUrl}/rest/v1/rpc/create_checkout_order`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ p_payload: payload, p_idempotency_key: payload.idempotencyKey }),
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

  if (!validatePayload(payload)) return errorResponse("結帳資料格式不正確，請重新確認。", 400, "invalid_request");

  try {
    return await invokeCheckout(payload);
  } catch (error) {
    console.error("[checkout] unexpected function error", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法建立訂單，請稍後再試。", 502, "checkout_unavailable");
  }
});
