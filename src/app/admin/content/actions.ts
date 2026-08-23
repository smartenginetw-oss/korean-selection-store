"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireContent } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const ContentSchema = z.object({
  slug: z.enum(["about", "shopping-guide", "shipping", "returns", "contact", "privacy", "terms"]),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(12000),
  isPublished: z.boolean(),
});

function contentRedirect(status: "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/content?${params.toString()}`);
}

export async function updateContentAction(formData: FormData) {
  const { user } = await requireContent();
  const parsed = ContentSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body"),
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) contentRedirect("error", "請確認標題與內容長度。內容最多 12,000 字。 ");

  const supabase = await createClient();
  const { error } = await supabase.from("store_pages").upsert({
    slug: parsed.data.slug,
    title: parsed.data.title,
    body: parsed.data.body,
    is_published: parsed.data.isPublished,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "slug" });

  if (error) {
    console.error("[admin/content] update failed", error.message);
    contentRedirect("error", "內容尚未儲存，請稍後再試。");
  }

  revalidatePath(`/${parsed.data.slug}`);
  revalidatePath("/admin/content");
  contentRedirect("updated");
}
