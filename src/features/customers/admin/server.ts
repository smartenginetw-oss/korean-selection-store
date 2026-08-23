import { createClient } from "@/lib/supabase/server";
import { requireCustomers } from "@/lib/supabase/auth";

export type AdminCustomerSummary = {
  name: string;
  email: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

export type AdminCustomerMetrics = {
  customerCount: number;
  orderCount: number;
  totalSpent: number;
};

function maskName(value: string) {
  const first = Array.from(value.trim())[0];
  return first ? `${first}＊＊` : "未提供";
}

function maskEmail(value: string) {
  const [local, domain] = value.trim().split("@", 2);
  if (!local || !domain) return "＊＊＊";
  const visible = Array.from(local).slice(0, 2).join("");
  return `${visible}***@${domain}`;
}

function maskPhone(value: string) {
  const phone = value.trim();
  if (phone.length < 7) return "＊＊＊";
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

export async function getAdminCustomers() {
  await requireCustomers();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("email,phone,recipient_name,grand_total,order_status,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[admin/customers] read failed", error.message);
    return { customers: [] as AdminCustomerSummary[], metrics: null as AdminCustomerMetrics | null, error: "顧客資料目前無法讀取。" };
  }

  type Aggregate = AdminCustomerSummary & { key: string };
  const aggregates = new Map<string, Aggregate>();
  let orderCount = 0;
  let totalSpent = 0;

  for (const order of data ?? []) {
    const key = order.email.trim().toLowerCase();
    if (!key) continue;
    const cancelled = order.order_status === "cancelled";
    const current = aggregates.get(key);
    if (current) {
      current.orderCount += 1;
      current.totalSpent += cancelled ? 0 : order.grand_total;
      continue;
    }

    aggregates.set(key, {
      key,
      name: maskName(order.recipient_name),
      email: maskEmail(order.email),
      phone: maskPhone(order.phone),
      orderCount: 1,
      totalSpent: cancelled ? 0 : order.grand_total,
      lastOrderAt: order.created_at,
    });
  }

  for (const order of data ?? []) {
    if (order.order_status !== "cancelled") {
      orderCount += 1;
      totalSpent += order.grand_total;
    }
  }

  const customers = Array.from(aggregates.values())
    .sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime())
    .map((customer) => ({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      orderCount: customer.orderCount,
      totalSpent: customer.totalSpent,
      lastOrderAt: customer.lastOrderAt,
    }));

  return {
    customers,
    metrics: { customerCount: customers.length, orderCount, totalSpent },
    error: null,
  };
}
