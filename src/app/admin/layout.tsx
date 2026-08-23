import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata = { title: "GYEOT Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return <AdminShell email={user.email}>{children}</AdminShell>;
}
