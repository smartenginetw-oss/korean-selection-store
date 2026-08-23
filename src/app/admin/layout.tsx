import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata = { title: "GYEOT Owner" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAdmin();
  return <AdminShell email={user.email} role={role}>{children}</AdminShell>;
}
