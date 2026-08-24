"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export async function signOutMember() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "請填寫姓名").max(80, "姓名不可超過 80 個字元"),
  phone: z.string().trim().regex(/^09[0-9]{8}$/, "請填寫有效的台灣手機號碼"),
});

const addressSchema = z.object({
  recipientName: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^09[0-9]{8}$/),
  postalCode: z.string().trim().min(3).max(10),
  city: z.string().trim().min(1).max(30),
  district: z.string().trim().min(1).max(30),
  addressLine: z.string().trim().min(1).max(160),
});

async function getMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount");
  return { supabase, user };
}

function accountError(kind: "profile" | "address"): never {
  redirect(`/account?status=${kind}_error`);
}

export async function updateProfileAction(formData: FormData) {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) accountError("profile");

  const { supabase, user } = await getMember();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.displayName, phone: parsed.data.phone }).eq("id", user.id);
  if (error) accountError("profile");
  revalidatePath("/account");
  redirect("/account?status=profile_saved");
}

export async function createAddressAction(formData: FormData) {
  const parsed = addressSchema.safeParse({
    recipientName: formData.get("recipientName"),
    phone: formData.get("phone"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    district: formData.get("district"),
    addressLine: formData.get("addressLine"),
  });
  if (!parsed.success) accountError("address");

  const { supabase, user } = await getMember();
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("profile_id", user.id);
  const shouldBeDefault = count === 0 || formData.get("isDefault") === "on";
  if (shouldBeDefault) await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id);

  const { error } = await supabase.from("addresses").insert({
    profile_id: user.id,
    recipient_name: parsed.data.recipientName,
    phone: parsed.data.phone,
    postal_code: parsed.data.postalCode,
    city: parsed.data.city,
    district: parsed.data.district,
    address_line: parsed.data.addressLine,
    is_default: shouldBeDefault,
  });
  if (error) accountError("address");
  revalidatePath("/account");
  redirect("/account?status=address_saved");
}

export async function setDefaultAddressAction(formData: FormData) {
  const addressId = z.string().uuid().safeParse(formData.get("addressId"));
  if (!addressId.success) accountError("address");
  const { supabase, user } = await getMember();
  await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", addressId.data).eq("profile_id", user.id);
  if (error) accountError("address");
  revalidatePath("/account");
  redirect("/account?status=address_saved");
}

export async function deleteAddressAction(formData: FormData) {
  const addressId = z.string().uuid().safeParse(formData.get("addressId"));
  if (!addressId.success) accountError("address");
  const { supabase, user } = await getMember();
  const { data: address } = await supabase.from("addresses").select("is_default").eq("id", addressId.data).eq("profile_id", user.id).maybeSingle();
  const { error } = await supabase.from("addresses").delete().eq("id", addressId.data).eq("profile_id", user.id);
  if (error) accountError("address");
  if (address?.is_default) {
    const { data: replacement } = await supabase.from("addresses").select("id").eq("profile_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (replacement) await supabase.from("addresses").update({ is_default: true }).eq("id", replacement.id).eq("profile_id", user.id);
  }
  revalidatePath("/account");
  redirect("/account?status=address_deleted");
}
