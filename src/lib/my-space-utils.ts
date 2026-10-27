import type { AppData, CabinetPreview, MySpaceData } from "@/lib/types";

export function buildMySpaceData(data: AppData, selectedCabinetId?: string): MySpaceData {
  const collections = [...data.collections]
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 3)
    .map((collection) => {
      const members = data.items
        .filter((item) => item.collectionIds.includes(collection.id))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return { collection, itemCount: members.length, items: members.slice(0, 3) };
    });

  const cabinets = data.cabinets;
  const selectedCabinet = cabinets.find((cabinet) => cabinet.id === selectedCabinetId) ?? cabinets[0];
  let featuredCabinet: CabinetPreview | undefined;

  if (selectedCabinet) {
    const rows = Array.from({ length: Math.min(selectedCabinet.rows, 2) }, (_, index) => ({
      index,
      slots: Array.from({ length: selectedCabinet.slotsPerRow }, (_, slot) =>
        data.items.find((item) => item.placement?.cabinetId === selectedCabinet.id && item.placement.row === index && item.placement.slot === slot) ?? null,
      ),
    }));
    featuredCabinet = {
      cabinet: selectedCabinet,
      placedCount: data.items.filter((item) => item.placement?.cabinetId === selectedCabinet.id).length,
      rows,
    };
  }

  return {
    recentItems: [...data.items].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 4),
    collections,
    cabinets,
    featuredCabinet,
  };
}
