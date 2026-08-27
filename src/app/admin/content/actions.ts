"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireContentManager } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const ContentSchema = z.object({
  slug: z.enum(["about", "shopping-guide", "shipping", "returns", "contact", "privacy", "terms"]),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(12000),
  isPublished: z.boolean(),
});

const legalSlugs = new Set(["returns", "privacy", "terms"]);

const HomeCollectionSchema = z.object({
  slug: z.enum(["new-arrivals", "in-stock", "preorder"]),
  eyebrow: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(180),
  href: z.string().trim().regex(/^\/(?!\/)[A-Za-z0-9/_?=&.%:#-]+$/, "首頁連結必須是站內路徑。"),
  tone: z.string().trim().regex(/^#[0-9a-f]{6}$/i, "色彩請使用 6 碼 HEX。"),
  sortOrder: z.coerce.number().int().min(0).max(99),
  isPublished: z.boolean(),
});

function contentRedirect(status: "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/content?${params.toString()}`);
}

export async function updateContentAction(formData: FormData) {
  const { user } = await requireContentManager();
  const parsed = ContentSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body"),
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) contentRedirect("error", "請確認標題與內容長度。內容最多 12,000 字。 ");
  if (parsed.data.isPublished && legalSlugs.has(parsed.data.slug) && /路由骨架|法務確認|正式版本將/.test(parsed.data.body)) {
    contentRedirect("error", "退換貨、隱私權與服務條款必須先換成法務審閱後的正式文字，不能直接發布目前的骨架內容。");
  }

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

export async function updateHomeCollectionAction(formData: FormData) {
  const { user } = await requireContentManager();
  const parsed = HomeCollectionSchema.safeParse({
    slug: formData.get("slug"),
    eyebrow: formData.get("eyebrow"),
    title: formData.get("title"),
    description: formData.get("description"),
    href: formData.get("href"),
    tone: formData.get("tone"),
    sortOrder: formData.get("sortOrder"),
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) contentRedirect("error", parsed.error.issues[0]?.message ?? "請確認首頁選品內容。");

  const supabase = await createClient();
  const { error } = await supabase.from("store_home_collections").upsert({
    slug: parsed.data.slug,
    eyebrow: parsed.data.eyebrow,
    title: parsed.data.title,
    description: parsed.data.description,
    href: parsed.data.href,
    tone: parsed.data.tone,
    sort_order: parsed.data.sortOrder,
    is_published: parsed.data.isPublished,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "slug" });

  if (error) {
    console.error("[admin/content] home collection update failed", error.message);
    contentRedirect("error", "首頁選品尚未儲存，請確認資料庫 migration 已套用。 ");
  }

  revalidatePath("/");
  revalidatePath("/admin/content");
  contentRedirect("updated");
}
