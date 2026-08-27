import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CheckoutRequestSchema = z.object({
  idempotencyKey: z.string().min(16).max(128).regex(/^[a-zA-Z0-9:_-]+$/),
  paymentProvider: z.enum(["test", "ecpay"]),
  paymentMethod: z.enum(["credit", "atm", "cvs"]).default("credit"),
  shippingMethod: z.enum(["home_delivery", "cvs_711", "cvs_family"]).default("home_delivery"),
  consentVersion: z.string().min(1).max(40).default("terms-v1"),
  couponCode: z.string().trim().max(40).optional(),
  customer: z.object({
    email: z.string().email().max(254),
    phone: z.string().regex(/^09[0-9]{8}$/),
    recipientName: z.string().trim().min(1).max(80),
    postalCode: z.string().trim().max(10).optional(),
    city: z.string().trim().max(30).optional(),
    district: z.string().trim().max(30).optional(),
    addressLine: z.string().trim().max(160).optional(),
    storeCode: z.string().trim().max(40).optional(),
    storeName: z.string().trim().max(80).optional(),
    storeAddress: z.string().trim().max(160).optional(),
    customerNote: z.string().trim().max(500).optional(),
  }),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(50),
}).superRefine((value, context) => {
  const customer = value.customer;
  if (value.shippingMethod === "home_delivery") {
    for (const [key, label] of [["postalCode", "郵遞區號"], ["city", "縣市"], ["district", "區域"], ["addressLine", "地址"]] as const) {
      if (!customer[key]?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["customer", key], message: `${label}為必填` });
    }
  } else {
    for (const [key, label] of [["storeCode", "門市代碼"], ["storeName", "門市名稱"], ["storeAddress", "門市地址"]] as const) {
      if (!customer[key]?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["customer", key], message: `${label}為必填` });
    }
  }
});

const RetryCheckoutRequestSchema = z.object({
  retryOrderId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(128).regex(/^[a-zA-Z0-9:_-]+$/),
  paymentProvider: z.literal("ecpay"),
  paymentMethod: z.enum(["credit", "atm", "cvs"]).default("credit"),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { code, message } }, { status });
}

function isTestPaymentEnabled() {
  // Local development remains convenient, but production must opt in with a
  // server-only flag. The browser flag below is only a UI hint; this check is
  // the authoritative guard for direct API callers.
  return process.env.NODE_ENV !== "production"
    || (process.env.TEST_PAYMENT_ENABLED === "true" && process.env.NEXT_PUBLIC_TEST_PAYMENT_ENABLED === "true");
}

function mapCheckoutError(code?: string, fallbackStatus = 500, detail?: string) {
  if (code === "P0001" || code === "inventory_conflict") return errorResponse("商品庫存或規格已變更，請返回購物車重新確認。", 409, "inventory_conflict");
  if (code === "rate_limited") return errorResponse("操作太頻繁，請稍後再試。", 429, "rate_limited");
  if (code === "rate_limit_unavailable") return errorResponse("目前無法驗證請求頻率，請稍後再試。", 503, "rate_limit_unavailable");
  if (code === "ecpay_not_configured") return errorResponse("ECPay 測試環境尚未設定，請改用測試付款或稍後再試。", 503, "ecpay_not_configured");
  if (code === "ecpay_invalid_order") return errorResponse("ECPay 訂單資料不完整，請稍後再試。", 502, "ecpay_invalid_order");
  if (code === "test_payment_disabled") return errorResponse("正式環境未開放測試付款，請選擇可用的付款方式。", 503, "test_payment_disabled");
  if (code === "idempotency_conflict") return errorResponse("此訂單編號已用於其他付款方式，請重新整理購物車。", 409, "idempotency_conflict");
  if (code === "coupon_invalid") return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
  if (code === "22023" && detail?.toLowerCase().includes("coupon")) return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
  if (code === "22023") return errorResponse("結帳資料無法驗證，請重新確認。", 400, "validation_error");
  return errorResponse("目前無法建立訂單，請稍後再試。", fallbackStatus, "checkout_failed");
}

async function createCheckoutViaEdgeFunction(payload: z.infer<typeof CheckoutRequestSchema>, accessToken?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const functionUrl = process.env.SUPABASE_CHECKOUT_FUNCTION_URL || (baseUrl ? `${baseUrl}/functions/v1/checkout` : undefined);

  if (!functionUrl || !publishableKey) {
    return errorResponse("Checkout server 尚未設定安全金鑰。", 503, "checkout_not_configured");
  }

  let response: Response;
  try {
    response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Publishable keys belong in apikey only. New Supabase keys are not JWTs.
        apikey: publishableKey,
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[checkout] Edge Function request failed", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法建立訂單，請稍後再試。", 503, "checkout_unavailable");
  }

  let body: { order?: unknown; payment?: unknown; error?: { code?: string; message?: string } } = {};
  try {
    body = await response.json();
  } catch {
    return errorResponse("目前無法建立訂單，請稍後再試。", 502, "checkout_unavailable");
  }

  if (!response.ok || !body.order) {
    return mapCheckoutError(body.error?.code, response.status >= 500 ? 503 : response.status);
  }

  return Response.json({ order: body.order, ...(body.payment ? { payment: body.payment } : {}) });
}

export async function POST(request: Request) {
  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return errorResponse("結帳資料格式不正確，請重新確認。", 400, "invalid_request");
  }

  const retryRequest = RetryCheckoutRequestSchema.safeParse(rawPayload);
  let parsed: z.infer<typeof CheckoutRequestSchema>;
  let retryOrderId: string | null = null;
  let retryRequestData: z.infer<typeof RetryCheckoutRequestSchema> | null = null;
  if (retryRequest.success) {
    retryRequestData = retryRequest.data;
    retryOrderId = retryRequest.data.retryOrderId;
    parsed = {
      idempotencyKey: retryRequestData!.idempotencyKey,
      paymentProvider: "ecpay",
      paymentMethod: retryRequestData!.paymentMethod,
      shippingMethod: "home_delivery",
      consentVersion: "terms-v1",
      items: [],
      customer: {
        email: "retry@example.invalid",
        phone: "0900000000",
        recipientName: "retry",
        postalCode: "000",
        city: "",
        district: "",
        addressLine: "",
      },
    };
  } else {
    try {
      parsed = CheckoutRequestSchema.parse(rawPayload);
    } catch {
      return errorResponse("結帳資料格式不正確，請重新確認。", 400, "invalid_request");
    }
  }

  if (parsed.paymentProvider === "test" && !isTestPaymentEnabled()) {
    return errorResponse("正式環境未開放測試付款，請選擇可用的付款方式。", 503, "test_payment_disabled");
  }

  // Resolve the member session on the server. The Edge Function validates the
  // forwarded token again; guests continue through the same checkout path with
  // no member identity attached.
  const supabase = await createClient();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const memberProfileId = user?.id ?? null;
  const accessToken = session?.access_token;

  if (retryOrderId) {
    if (!user) return errorResponse("請先登入會員帳號，再重新付款。", 401, "unauthorized");
    // Bind retries to the original order. A browser refresh or a second click
    // cannot create a second retry order with a new client-generated key.
    const retryIdempotencyKey = `retry-${retryOrderId}`;

    const [orderResult, itemsResult, paymentResult, existingRetryPaymentResult, retryShipmentResult] = await Promise.all([
          supabase.from("orders").select("id, email, phone, recipient_name, postal_code, city, district, address_line, shipping_method, coupon_code, payment_status, order_status").eq("id", retryOrderId).maybeSingle(),
      supabase.from("order_items").select("variant_id, quantity").eq("order_id", retryOrderId).order("created_at", { ascending: true }),
      supabase.from("payments").select("provider, status").eq("order_id", retryOrderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("payments").select("order_id, provider, status").eq("idempotency_key", retryIdempotencyKey).maybeSingle(),
      supabase.from("shipments").select("store_code, store_name, store_address").eq("order_id", retryOrderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (orderResult.error || !orderResult.data || itemsResult.error || paymentResult.error || existingRetryPaymentResult.error || retryShipmentResult.error || !paymentResult.data) {
      return errorResponse("找不到可重新付款的訂單。", 404, "retry_order_not_found");
    }

    const order = orderResult.data;
    const payment = paymentResult.data;
    if (order.payment_status !== "failed" || order.order_status !== "cancelled" || payment.provider !== "ecpay" || payment.status !== "failed") {
      return errorResponse("這筆訂單目前沒有可重新付款的狀態。", 409, "retry_not_available");
    }
    const existingRetryPayment = existingRetryPaymentResult.data;
    if (existingRetryPayment && (existingRetryPayment.provider !== "ecpay" || existingRetryPayment.order_id === retryOrderId)) {
      return errorResponse("此訂單的重新付款資料無法使用，請改用再次購買。", 409, "retry_conflict");
    }
    if (existingRetryPayment?.status === "paid") {
      return errorResponse("這筆訂單已建立新的付款單，請到會員中心查看。", 409, "retry_already_paid");
    }
    if (existingRetryPayment?.status === "failed") {
      return errorResponse("重新付款也未完成，請使用再次購買重新建立訂單。", 409, "retry_already_failed");
    }
    if (existingRetryPayment && existingRetryPayment.status !== "pending") {
      return errorResponse("這筆重新付款已經處理，請到會員中心查看訂單狀態。", 409, "retry_already_processed");
    }
    if (!itemsResult.data.length) {
      return errorResponse("原訂單沒有可重新付款的商品。", 409, "retry_items_missing");
    }
    if (itemsResult.data.some((item) => !item.variant_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)) {
      return errorResponse("原訂單商品規格已無法重新驗證，請改用再次購買。", 409, "retry_items_invalid");
    }

    parsed = {
      idempotencyKey: retryIdempotencyKey,
      paymentProvider: "ecpay",
      paymentMethod: retryRequestData!.paymentMethod,
      shippingMethod: order.shipping_method === "cvs_711" || order.shipping_method === "cvs_family" ? order.shipping_method : "home_delivery",
      consentVersion: "terms-v1",
      couponCode: order.coupon_code ?? undefined,
      customer: {
        email: order.email,
        phone: order.phone,
        recipientName: order.recipient_name,
        postalCode: order.postal_code,
        city: order.city,
        district: order.district,
        addressLine: order.address_line,
        storeCode: retryShipmentResult.data?.store_code ?? undefined,
        storeName: retryShipmentResult.data?.store_name ?? undefined,
        storeAddress: retryShipmentResult.data?.store_address ?? undefined,
      },
      items: itemsResult.data.map((item) => ({ variantId: item.variant_id!, quantity: item.quantity })),
    };
  }

  // Prefer the local server-role path when explicitly configured. Otherwise
  // use the deployed Edge Function, whose server-only key never reaches Next
  // or the browser.
  // ECPay is handled by the Edge Function even when local development has a
  // service-role key, so the same server-only signing and callback path is
  // exercised in Preview and locally.
  if (parsed.paymentProvider === "ecpay" || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createCheckoutViaEdgeFunction(parsed, accessToken);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_checkout_order_for_member", {
      p_payload: parsed,
      p_idempotency_key: parsed.idempotencyKey,
      p_profile_id: memberProfileId,
    });

    if (error) {
      console.error("[checkout] RPC failed", error.message);
      return mapCheckoutError(error.code, 500, error.message);
    }

    return Response.json({ order: data });
  } catch (error) {
    console.error("[checkout] server checkout failed", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法建立訂單，請稍後再試。", 500, "checkout_failed");
  }
}
