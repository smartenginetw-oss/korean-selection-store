import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BackofficeCapability, BackofficeRole, canAccess, isBackofficeRole } from "@/lib/supabase/roles";

const adminLoginPath = "/admin-login?next=%2Fadmin";

/**
 * Server-side authorization boundary for every admin page.
 *
 * The proxy provides a fast redirect for anonymous requests, but the page
 * check remains necessary because a route-level redirect is not an
 * authorization boundary for Server Actions or direct requests.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(adminLoginPath);

  const { data: role, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !isBackofficeRole(role?.role)) {
    redirect("/?notice=admin_only");
  }

  return { user, role: role.role as BackofficeRole };
}

export async function requireOwner() {
  const result = await requireAdmin();
  if (result.role !== "admin") redirect("/admin?notice=owner_only");
  return result;
}

export async function requireCapability(capability: BackofficeCapability) {
  const result = await requireAdmin();
  if (!canAccess(result.role, capability)) redirect("/admin?notice=role_forbidden");
  return result;
}

export const requireCatalog = () => requireCapability("catalog");
export const requireInventory = () => requireCapability("inventory");
export const requireOrders = () => requireCapability("orders");
export const requireCustomers = () => requireCapability("customers");
export const requireCoupons = () => requireCapability("coupons");
export const requireContent = () => requireCapability("content");
export const requireReports = () => requireCapability("reports");
