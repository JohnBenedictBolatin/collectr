import type { Collectible } from "@/lib/types";

export type ItemFilters = {
  search: string;
  collectionId: string;
  category: string;
  condition: string;
  placement: string;
  sort: string;
};

export function filterAndSortItems(items: Collectible[], filters: ItemFilters) {
  const needle = filters.search.trim().toLocaleLowerCase();
  const result = items.filter((item) => {
    const searchable = [item.name, item.brand, item.franchise, ...item.tags].some((value) => value.toLocaleLowerCase().includes(needle));
    const matchesSearch = !needle || searchable;
    const matchesCollection = filters.collectionId === "all" || (filters.collectionId === "favorites" ? item.favorite : item.collectionIds.includes(filters.collectionId));
    const matchesCategory = filters.category === "All categories" || item.category === filters.category;
    const matchesCondition = filters.condition === "All conditions" || item.condition === filters.condition;
    const matchesPlacement = filters.placement === "All items" || (filters.placement === "Unplaced" ? !item.placement : Boolean(item.placement));
    return matchesSearch && matchesCollection && matchesCategory && matchesCondition && matchesPlacement;
  });
  return result.sort((a,b) => filters.sort === "Name A–Z" ? a.name.localeCompare(b.name) : filters.sort === "Acquisition date" ? (b.acquiredAt || "").localeCompare(a.acquiredAt || "") : b.createdAt.localeCompare(a.createdAt));
}

export function canPlaceItem(items: Collectible[], itemId: string, cabinetId: string, row: number, slot: number) {
  if (![row,slot].every((value) => Number.isInteger(value) && value >= 0 && value <= 11)) return false;
  return !items.some((item) => item.id !== itemId && item.placement?.cabinetId === cabinetId && item.placement.row === row && item.placement.slot === slot);
}
