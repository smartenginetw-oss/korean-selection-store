import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: { code: "invalid_order", message: "訂單編號格式不正確。" } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "請先登入會員帳號。" } }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, payment_status, fulfillment_status, order_status, updated_at")
    .eq("id", id)
    .maybeSingle();

  // RLS deliberately makes another member's order indistinguishable from a
  // missing order. Do not expose database details through this polling API.
  if (error || !data) {
    return Response.json({ error: { code: "order_not_found", message: "找不到這筆訂單。" } }, { status: 404 });
  }

  return Response.json({
    order: {
      id: data.id,
      paymentStatus: data.payment_status,
      fulfillmentStatus: data.fulfillment_status,
      orderStatus: data.order_status,
      updatedAt: data.updated_at,
    },
  }, { headers: { "cache-control": "no-store" } });
}
