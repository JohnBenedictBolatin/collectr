import "server-only";
import type { AppData, Cabinet, Category, Collectible, MySpaceData } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAccountData(userId: string, offset = 0, limit = 50): Promise<AppData> {
  const supabase = await createSupabaseServerClient();
  const [itemsResult, collectionsResult, cabinetsResult, rowsResult] = await Promise.all([
    supabase.from("items").select("id,name,category,brand,franchise,condition,tags,notes,acquired_at,is_favorite,details,created_at").eq("owner_id", userId).order("created_at", { ascending: false }).range(offset, offset + limit - 1),
    supabase.from("collections").select("id,name,description").eq("owner_id", userId).order("name"),
    supabase.from("cabinets").select("id,name").eq("owner_id", userId).order("created_at"),
    supabase.from("cabinet_rows").select("id,cabinet_id,row_index,slots_count").eq("owner_id", userId).order("row_index"),
  ]);

  for (const result of [itemsResult, collectionsResult, cabinetsResult, rowsResult]) {
    if (result.error) throw new Error("Your collection could not be loaded. Refresh to try again.");
  }
  const itemRows = itemsResult.data ?? [];
  const ids = itemRows.map((item) => item.id);
  const [membershipsResult, placementsResult, photosResult] = ids.length
    ? await Promise.all([
        supabase.from("item_collections").select("item_id,collection_id").eq("owner_id", userId).in("item_id", ids),
        supabase.from("placements").select("item_id,row_id,slot_index,updated_at,cabinet_rows!inner(cabinet_id,row_index)").eq("owner_id", userId).in("item_id", ids),
        supabase.from("item_photos").select("item_id,storage_path,sort_order").eq("owner_id", userId).in("item_id", ids).order("sort_order"),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  if (membershipsResult.error || placementsResult.error || photosResult.error) throw new Error("Some collection details could not be loaded.");

  const urls = await Promise.all((photosResult.data ?? []).map(async (photo) => {
    const { data } = await supabase.storage.from("collectible-photos").createSignedUrl(photo.storage_path, 3600);
    return [photo.item_id, data?.signedUrl] as const;
  }));
  const firstPhoto = new Map<string, string>();
  urls.forEach(([id, url]) => { if (url && !firstPhoto.has(id)) firstPhoto.set(id, url); });
  const itemCollectionIds = new Map<string, string[]>();
  (membershipsResult.data ?? []).forEach((row) => itemCollectionIds.set(row.item_id, [...(itemCollectionIds.get(row.item_id) ?? []), row.collection_id]));
  const placementByItem = new Map((placementsResult.data ?? []).map((row) => {
    const cabinetRow = Array.isArray(row.cabinet_rows) ? row.cabinet_rows[0] : row.cabinet_rows;
    return [row.item_id, { cabinetId: cabinetRow.cabinet_id, row: cabinetRow.row_index, slot: row.slot_index, updatedAt: row.updated_at }];
  }));

  const items: Collectible[] = itemRows.map((row, index) => ({
    id: row.id, name: row.name, category: row.category as Category, brand: row.brand ?? "", franchise: row.franchise ?? "",
    condition: row.condition ?? "Not set", tags: row.tags ?? [], notes: row.notes ?? "", acquiredAt: row.acquired_at ?? "",
    favorite: row.is_favorite, collectionIds: itemCollectionIds.get(row.id) ?? [], imageIndex: index % 6,
    photoUrls: urls.filter(([id]) => id === row.id).map(([, url]) => url).filter((url): url is string => Boolean(url)),
    imageUrl: firstPhoto.get(row.id), details: row.details ?? {}, placement: placementByItem.get(row.id), createdAt: row.created_at,
  }));

  const cabinets = (cabinetsResult.data ?? []).map((cabinet) => {
    const rows = (rowsResult.data ?? []).filter((row) => row.cabinet_id === cabinet.id);
    return { id: cabinet.id, name: cabinet.name, rows: rows.length, slotsPerRow: Math.max(1, ...rows.map((row) => row.slots_count)) };
  });
  return {
    items,
    collections: (collectionsResult.data ?? []).map(({ id, name, description }) => ({ id, name, description: description ?? "" })),
    cabinets,
  };
}

export async function getMySpaceData(userId: string, selectedCabinetId?: string): Promise<MySpaceData> {
  const supabase = await createSupabaseServerClient();
  const itemFields = "id,name,category,brand,franchise,condition,tags,notes,acquired_at,is_favorite,details,created_at";
  const [recentResult, collectionsResult, cabinetsResult, rowsResult] = await Promise.all([
    supabase.from("items").select(itemFields).eq("owner_id", userId).order("created_at", { ascending: false }).limit(4),
    supabase.from("collections").select("id,name,description").eq("owner_id", userId).order("name").limit(3),
    supabase.from("cabinets").select("id,name").eq("owner_id", userId).order("created_at"),
    supabase.from("cabinet_rows").select("id,cabinet_id,row_index,slots_count").eq("owner_id", userId).order("row_index"),
  ]);
  if ([recentResult, collectionsResult, cabinetsResult, rowsResult].some((result) => result.error)) {
    throw new Error("Your home summary could not be loaded.");
  }

  const cabinetRows = rowsResult.data ?? [];
  const cabinets: Cabinet[] = (cabinetsResult.data ?? []).map((cabinet) => {
    const rows = cabinetRows.filter((row) => row.cabinet_id === cabinet.id);
    return { id: cabinet.id, name: cabinet.name, rows: rows.length, slotsPerRow: Math.max(1, ...rows.map((row) => row.slots_count)) };
  });
  const selectedCabinet = cabinets.find((cabinet) => cabinet.id === selectedCabinetId) ?? cabinets[0];
  const visibleRows = selectedCabinet
    ? cabinetRows.filter((row) => row.cabinet_id === selectedCabinet.id).slice(0, 2)
    : [];

  const [collectionMembershipResults, cabinetCounts, shelfPlacements] = await Promise.all([
    Promise.all((collectionsResult.data ?? []).map((collection) =>
      supabase.from("item_collections").select("item_id", { count: "exact" }).eq("owner_id", userId).eq("collection_id", collection.id).order("created_at", { ascending: false }).limit(3),
    )),
    Promise.all(cabinets.map((cabinet) =>
      supabase.from("placements").select("item_id,cabinet_rows!inner(cabinet_id)", { count: "exact", head: true }).eq("owner_id", userId).eq("cabinet_rows.cabinet_id", cabinet.id),
    )),
    visibleRows.length
      ? supabase.from("placements").select("item_id,row_id,slot_index").eq("owner_id", userId).in("row_id", visibleRows.map((row) => row.id))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (collectionMembershipResults.some((result) => result.error) || cabinetCounts.some((result) => result.error) || shelfPlacements.error) {
    throw new Error("Your home summary could not be loaded.");
  }

  const recentRows = recentResult.data ?? [];
  const recentIds = recentRows.map((item) => item.id);
  const collectionItemIds = collectionMembershipResults.flatMap((result) => (result.data ?? []).map((row) => row.item_id));
  const shelfItemIds = (shelfPlacements.data ?? []).map((placement) => placement.item_id);
  const itemIds = [...new Set([...recentIds, ...collectionItemIds, ...shelfItemIds])];
  const [itemsResult, membershipsResult, placementsResult, photosResult] = itemIds.length
    ? await Promise.all([
        supabase.from("items").select(itemFields).eq("owner_id", userId).in("id", itemIds),
        supabase.from("item_collections").select("item_id,collection_id").eq("owner_id", userId).in("item_id", itemIds),
        supabase.from("placements").select("item_id,row_id,slot_index,updated_at,cabinet_rows!inner(cabinet_id,row_index)").eq("owner_id", userId).in("item_id", itemIds),
        supabase.from("item_photos").select("item_id,storage_path").eq("owner_id", userId).in("item_id", itemIds).eq("sort_order", 0),
      ])
    : [
        { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null },
      ];
  if ([itemsResult, membershipsResult, placementsResult, photosResult].some((result) => result.error)) {
    throw new Error("Some home summary details could not be loaded.");
  }

  const photoRows = photosResult.data ?? [];
  const signedPhotos = await Promise.all(photoRows.map(async (photo) => {
    const { data } = await supabase.storage.from("collectible-photos").createSignedUrl(photo.storage_path, 3600);
    return [photo.item_id, data?.signedUrl] as const;
  }));
  const photoByItem = new Map(signedPhotos.filter((photo): photo is readonly [string, string] => Boolean(photo[1])));
  const membershipsByItem = new Map<string, string[]>();
  (membershipsResult.data ?? []).forEach((membership) => membershipsByItem.set(membership.item_id, [...(membershipsByItem.get(membership.item_id) ?? []), membership.collection_id]));
  const placementByItem = new Map((placementsResult.data ?? []).map((row) => {
    const cabinetRow = Array.isArray(row.cabinet_rows) ? row.cabinet_rows[0] : row.cabinet_rows;
    return [row.item_id, { cabinetId: cabinetRow.cabinet_id, row: cabinetRow.row_index, slot: row.slot_index, updatedAt: row.updated_at }];
  }));
  const itemById = new Map<string, Collectible>((itemsResult.data ?? []).map((row, index) => [row.id, {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    brand: row.brand ?? "",
    franchise: row.franchise ?? "",
    condition: row.condition ?? "Not set",
    tags: row.tags ?? [],
    notes: row.notes ?? "",
    acquiredAt: row.acquired_at ?? "",
    favorite: row.is_favorite,
    collectionIds: membershipsByItem.get(row.id) ?? [],
    imageIndex: index % 6,
    imageUrl: photoByItem.get(row.id),
    photoUrls: photoByItem.has(row.id) ? [photoByItem.get(row.id)!] : [],
    details: row.details ?? {},
    placement: placementByItem.get(row.id),
    createdAt: row.created_at,
  }]));

  const collections = (collectionsResult.data ?? []).map((collection, index) => {
    const memberResult = collectionMembershipResults[index];
    const previewItems = (memberResult.data ?? []).map(({ item_id }) => itemById.get(item_id)).filter((item): item is Collectible => Boolean(item));
    return {
      collection: { id: collection.id, name: collection.name, description: collection.description ?? "" },
      itemCount: memberResult.count ?? 0,
      items: previewItems,
    };
  });
  const cabinetCountsById = new Map(cabinets.map((cabinet, index) => [cabinet.id, cabinetCounts[index].count ?? 0]));
  const featuredCabinet = selectedCabinet ? {
    cabinet: selectedCabinet,
    placedCount: cabinetCountsById.get(selectedCabinet.id) ?? 0,
    rows: visibleRows.map((row) => ({
      index: row.row_index,
      slots: Array.from({ length: row.slots_count }, (_, slotIndex) => {
        const placement = (shelfPlacements.data ?? []).find((entry) => entry.row_id === row.id && entry.slot_index === slotIndex);
        return placement ? itemById.get(placement.item_id) ?? null : null;
      }),
    })),
  } : undefined;

  return {
    recentItems: recentIds.map((id) => itemById.get(id)).filter((item): item is Collectible => Boolean(item)),
    collections,
    cabinets,
    featuredCabinet,
  };
}
