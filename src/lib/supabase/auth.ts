import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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

  if (error || (role?.role !== "admin" && role?.role !== "staff")) {
    redirect("/?notice=admin_only");
  }

  return { user, role: role.role as "admin" | "staff" };
}

export async function requireOwner() {
  const result = await requireAdmin();
  if (result.role !== "admin") redirect("/admin?notice=owner_only");
  return result;
}
