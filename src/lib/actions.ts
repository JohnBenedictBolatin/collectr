"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cabinetNameInput, collectibleInput, isValidCollectibleImage, MAX_ITEM_PHOTOS } from "@/lib/validation";

function formText(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }

async function signedInClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in to update your collection.");
  return { supabase, user };
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: formText(formData, "email"), password: formText(formData, "password") });
  if (error) return { error: "That email and password did not work. Check them and try again." };
  revalidatePath("/");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  const { error } = await supabase.auth.signUp({ email: formText(formData, "email"), password: formText(formData, "password"), options: { emailRedirectTo: `${siteUrl}/auth/callback`, data: { display_name: formText(formData, "displayName") || "Collector" } } });
  if (error) return { error: error.message.includes("already") ? "An account already uses that email. Sign in instead." : "We could not create the account. Check the details and try again." };
  return { message: "Check your email for a verification link to finish creating your account." };
}

export async function sendPasswordReset(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(formText(formData, "email"), { redirectTo: `${siteUrl}/auth/reset-password` });
  if (error) return { error: "We could not send a reset email. Check the address and try again." };
  return { message: "If an account matches that email, a password reset link is on its way." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createCollectible(formData: FormData) {
  const { supabase, user } = await signedInClient();
  let details: unknown = {};
  try { details = JSON.parse(formText(formData, "details") || "{}"); } catch { return { error: "Some extra item details could not be read." }; }
  const parsed = collectibleInput.safeParse({
    name: formText(formData, "name"), category: formText(formData, "category"), brand: formText(formData, "brand"),
    franchise: formText(formData, "franchise"), condition: formText(formData, "condition") || "Not set",
    tags: formText(formData, "tags").split(",").map((v) => v.trim()).filter(Boolean), notes: formText(formData, "notes"),
    acquiredAt: formText(formData, "acquiredAt"), details,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the item details." };
  const collectionIds = formData.getAll("collectionIds").map(String);
  const photos = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (photos.length > MAX_ITEM_PHOTOS) return { error: "Choose up to five photos for one collectible." };
  if (photos.some((file) => !isValidCollectibleImage(file))) return { error: "Photos must be JPG, PNG, or WebP files under 10 MB each." };

  const { data: item, error } = await supabase.from("items").insert({ owner_id: user.id, name: parsed.data.name, category: parsed.data.category, brand: parsed.data.brand, franchise: parsed.data.franchise, condition: parsed.data.condition, tags: parsed.data.tags, notes: parsed.data.notes, acquired_at: parsed.data.acquiredAt || null, details: parsed.data.details }).select("id").single();
  if (error || !item) return { error: "We could not save that collectible. Try again." };
  if (collectionIds.length) {
    const { error: membershipError } = await supabase.from("item_collections").insert([...new Set(collectionIds)].map((collection_id) => ({ owner_id: user.id, item_id: item.id, collection_id })));
    if (membershipError) { await supabase.from("items").delete().eq("id", item.id); return { error: "The collectible was not added to those collections. Check the selections and try again." }; }
  }

  const savedPaths: string[] = [];
  for (const [sort_order, file] of photos.entries()) {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storage_path = `${user.id}/${item.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("collectible-photos").upload(storage_path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      if (savedPaths.length) await supabase.storage.from("collectible-photos").remove(savedPaths);
      await supabase.from("items").delete().eq("id", item.id);
      return { error: "The photo upload did not finish. The collectible was not saved; try again." };
    }
    savedPaths.push(storage_path);
    const { error: photoError } = await supabase.from("item_photos").insert({ owner_id: user.id, item_id: item.id, storage_path, sort_order });
    if (photoError) {
      await supabase.storage.from("collectible-photos").remove([...savedPaths]);
      await supabase.from("items").delete().eq("id", item.id);
      return { error: "We could not attach that photo. The collectible was not saved; try again." };
    }
  }
  revalidatePath("/");
  return { success: true };
}

export async function setFavorite(itemId: string, favorite: boolean) {
  const { supabase, user } = await signedInClient();
  const { error } = await supabase.from("items").update({ is_favorite: favorite }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return { error: "That update did not save. Try again." };
  revalidatePath("/");
  return { success: true };
}

export async function deleteCollectible(itemId: string) {
  const { supabase, user } = await signedInClient();
  const { data: photos } = await supabase.from("item_photos").select("storage_path").eq("owner_id", user.id).eq("item_id", itemId);
  if (photos?.length) await supabase.storage.from("collectible-photos").remove(photos.map(({ storage_path }) => storage_path));
  const { error } = await supabase.from("items").delete().eq("id", itemId).eq("owner_id", user.id);
  if (error) return { error: "That collectible was not deleted. Try again." };
  revalidatePath("/");
  return { success: true };
}

export async function updateCollectible(formData: FormData) {
  const { supabase, user } = await signedInClient();
  let details: unknown = {};
  try { details = JSON.parse(formText(formData, "details") || "{}"); } catch { return { error: "Some extra item details could not be read." }; }
  const parsed = collectibleInput.safeParse({
    name: formText(formData, "name"), category: formText(formData, "category"), brand: formText(formData, "brand"), franchise: formText(formData, "franchise"),
    condition: formText(formData, "condition") || "Not set", tags: formText(formData, "tags").split(",").map((value) => value.trim()).filter(Boolean),
    notes: formText(formData, "notes"), acquiredAt: formText(formData, "acquiredAt"), details,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the item details." };
  const itemId = formText(formData, "itemId");
  const { error } = await supabase.from("items").update({ name: parsed.data.name, category: parsed.data.category, brand: parsed.data.brand, franchise: parsed.data.franchise, condition: parsed.data.condition, tags: parsed.data.tags, notes: parsed.data.notes, acquired_at: parsed.data.acquiredAt || null, details: parsed.data.details }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return { error: "Those changes could not be saved. Try again." };
  const originalCollectionIds = formData.getAll("originalCollectionIds").map(String);
  const nextCollectionIds = formData.getAll("collectionIds").map(String);
  const addIds = nextCollectionIds.filter((id) => !originalCollectionIds.includes(id));
  const removeIds = originalCollectionIds.filter((id) => !nextCollectionIds.includes(id));
  if (addIds.length) await supabase.from("item_collections").upsert(addIds.map((collection_id) => ({ owner_id: user.id, item_id: itemId, collection_id })), { onConflict: "item_id,collection_id", ignoreDuplicates: true });
  if (removeIds.length) await supabase.from("item_collections").delete().eq("owner_id", user.id).eq("item_id", itemId).in("collection_id", removeIds);
  revalidatePath("/");
  return { success: true };
}

export async function duplicateCollectible(itemId: string) {
  const { supabase, user } = await signedInClient();
  const { data: original, error } = await supabase.from("items").select("name,category,brand,franchise,condition,tags,notes,acquired_at,details").eq("owner_id", user.id).eq("id", itemId).single();
  if (error || !original) return { error: "That collectible could not be duplicated." };
  const { data: copy, error: copyError } = await supabase.from("items").insert({ ...original, owner_id: user.id, name: `${original.name} (copy)`, is_favorite: false }).select("id").single();
  if (copyError || !copy) return { error: "The duplicate could not be saved." };
  const { data: memberships } = await supabase.from("item_collections").select("collection_id").eq("owner_id", user.id).eq("item_id", itemId);
  if (memberships?.length) await supabase.from("item_collections").insert(memberships.map(({ collection_id }) => ({ owner_id: user.id, item_id: copy.id, collection_id })));
  revalidatePath("/");
  return { success: true };
}

export async function createCollection(name: string) {
  const { supabase, user } = await signedInClient();
  const parsed = cabinetNameInput.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the collection name." };
  const { data, error } = await supabase.from("collections").insert({ owner_id: user.id, name: parsed.data }).select("id,name,description").single();
  if (error || !data) return { error: "That collection name could not be saved." };
  revalidatePath("/");
  return { collection: data };
}

export async function setCollectionMembership(itemIds: string[], collectionId: string, add: boolean) {
  const { supabase, user } = await signedInClient();
  const ids = [...new Set(itemIds)].slice(0, 500);
  if (!ids.length) return { success: true };
  const result = add
    ? await supabase.from("item_collections").upsert(ids.map((item_id) => ({ owner_id: user.id, item_id, collection_id: collectionId })), { onConflict: "item_id,collection_id", ignoreDuplicates: true })
    : await supabase.from("item_collections").delete().eq("owner_id", user.id).eq("collection_id", collectionId).in("item_id", ids);
  if (result.error) return { error: "The collection changes did not save. Try again." };
  revalidatePath("/");
  return { success: true };
}

export async function createCabinet(name: string) {
  const { supabase, user } = await signedInClient();
  const parsed = cabinetNameInput.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the cabinet name." };
  const { data, error } = await supabase.from("cabinets").insert({ owner_id: user.id, name: parsed.data }).select("id,name").single();
  if (error || !data) return { error: "That cabinet could not be created." };
  const { error: rowError } = await supabase.from("cabinet_rows").insert({ owner_id: user.id, cabinet_id: data.id, row_index: 0, slots_count: 4 });
  if (rowError) { await supabase.from("cabinets").delete().eq("id", data.id); return { error: "The cabinet was not created. Try again." }; }
  revalidatePath("/");
  return { cabinet: { ...data, rows: 1, slotsPerRow: 4 } };
}

export async function addCabinetRow(cabinetId: string) {
  const { supabase, user } = await signedInClient();
  const { data: rows, error } = await supabase.from("cabinet_rows").select("row_index,slots_count").eq("owner_id", user.id).eq("cabinet_id", cabinetId).order("row_index");
  if (error) return { error: "Cabinet rows could not be loaded." };
  const row_index = rows?.length ?? 0;
  if (row_index >= 12) return { error: "A cabinet can have up to twelve rows." };
  const { error: insertError } = await supabase.from("cabinet_rows").insert({ owner_id: user.id, cabinet_id: cabinetId, row_index, slots_count: rows?.[0]?.slots_count ?? 4 });
  if (insertError) return { error: "The new row could not be added." };
  revalidatePath("/");
  return { success: true };
}

export async function removeCabinetRow(cabinetId: string, rowIndex: number) {
  const { supabase, user } = await signedInClient();
  const { data: row } = await supabase.from("cabinet_rows").select("id").eq("owner_id", user.id).eq("cabinet_id", cabinetId).eq("row_index", rowIndex).maybeSingle();
  if (!row) return { error: "That shelf row no longer exists." };
  const { error } = await supabase.from("cabinet_rows").delete().eq("id", row.id).eq("owner_id", user.id);
  if (error) return { error: "The shelf row could not be removed." };
  const { data: remaining } = await supabase.from("cabinet_rows").select("id,row_index").eq("owner_id", user.id).eq("cabinet_id", cabinetId).order("row_index");
  for (const [row_index, value] of (remaining ?? []).entries()) await supabase.from("cabinet_rows").update({ row_index }).eq("id", value.id);
  revalidatePath("/");
  return { success: true };
}

export async function removeCabinet(cabinetId: string) {
  const { supabase, user } = await signedInClient();
  const { error } = await supabase.from("cabinets").delete().eq("id", cabinetId).eq("owner_id", user.id);
  if (error) return { error: "The cabinet could not be removed." };
  revalidatePath("/");
  return { success: true };
}

export async function resizeCabinetSlots(cabinetId: string, slotsCount: number) {
  const { supabase } = await signedInClient();
  const { data, error } = await supabase.rpc("resize_cabinet_slots", { p_cabinet_id: cabinetId, p_slots_count: slotsCount });
  if (error) return { error: "Shelf positions could not be changed." };
  revalidatePath("/");
  return { success: true, displaced: Number(data ?? 0) };
}

export async function moveCollectible(itemId: string, cabinetId: string | null, row: number | null, slot: number | null, expectedUpdatedAt?: string) {
  const { supabase } = await signedInClient();
  const { error } = await supabase.rpc("move_item", { p_item_id: itemId, p_cabinet_id: cabinetId, p_row_index: row, p_slot_index: slot, p_expected_updated_at: expectedUpdatedAt ?? null });
  if (error) {
    return { error: error.message.includes("SLOT_OCCUPIED") ? "That shelf spot is already taken. Choose another empty slot." : error.message.includes("STALE_PLACEMENT") ? "Your shelf changed in another session. Refresh to see the latest layout." : "That move did not save. Your item is still in its previous spot." };
  }
  revalidatePath("/");
  return { success: true };
}

export async function loadCollectiblePage(offset: number) {
  const { user } = await signedInClient();
  const { getAccountData } = await import("@/lib/server-data");
  return getAccountData(user.id, Math.max(0, Math.floor(offset)), 50);
}

export async function loadMySpaceSummary(cabinetId?: string) {
  const { user } = await signedInClient();
  const { getMySpaceData } = await import("@/lib/server-data");
  return getMySpaceData(user.id, cabinetId);
}

export async function saveProfileSettings(displayName: string, reduceMascot: boolean) {
  const { supabase, user } = await signedInClient();
  const name = displayName.trim().slice(0, 80) || "Collector";
  const { error } = await supabase.from("profiles").update({ display_name: name, reduce_mascot: reduceMascot }).eq("id", user.id);
  if (error) return { error: "Those profile settings could not be saved." };
  revalidatePath("/");
  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const password = formText(formData, "password");
  if (password.length < 8 || password.length > 128) return { error: "Use a password between 8 and 128 characters." };
  const { supabase } = await signedInClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "The password could not be updated. Request a fresh reset link and try again." };
  redirect("/");
}
