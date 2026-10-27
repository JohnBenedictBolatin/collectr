import { describe, expect, it } from "vitest";
import type { AppData, Collectible } from "@/lib/types";
import { buildMySpaceData } from "@/lib/my-space-utils";

function makeInventory(size: number): AppData {
  const items: Collectible[] = Array.from({ length: size }, (_, index) => ({
    id: `item-${index}`,
    name: `Collectible ${index}`,
    category: index % 2 ? "Card" : "Action Figure",
    brand: "Sample brand",
    franchise: "Sample series",
    condition: "Good",
    tags: [],
    notes: "",
    acquiredAt: "",
    favorite: false,
    collectionIds: ["collection-alpha"],
    imageIndex: index % 6,
    photoUrls: [],
    details: {},
    placement: index < 24 ? { cabinetId: "cabinet-main", row: Math.floor(index / 12), slot: index % 12 } : undefined,
    createdAt: new Date(Date.UTC(2024, 0, index + 1)).toISOString(),
  }));
  return {
    items,
    collections: [
      { id: "collection-zulu", name: "Zulu" },
      { id: "collection-alpha", name: "Alpha" },
      { id: "collection-bravo", name: "Bravo" },
      { id: "collection-extra", name: "Extra" },
    ],
    cabinets: [{ id: "cabinet-main", name: "Display cabinet", rows: 3, slotsPerRow: 12 }],
  };
}

describe("My Space summary", () => {
  it("keeps complete counts and shelf positions for a 500-item collection", () => {
    const summary = buildMySpaceData(makeInventory(500), "cabinet-main");

    expect(summary.recentItems.map((item) => item.id)).toEqual(["item-499", "item-498", "item-497", "item-496"]);
    expect(summary.collections.map(({ collection }) => collection.name)).toEqual(["Alpha", "Bravo", "Extra"]);
    expect(summary.collections[0].itemCount).toBe(500);
    expect(summary.collections[0].items).toHaveLength(3);
    expect(summary.featuredCabinet?.placedCount).toBe(24);
    expect(summary.featuredCabinet?.rows).toHaveLength(2);
    expect(summary.featuredCabinet?.rows[1].slots[11]?.id).toBe("item-23");
  });

  it("returns a clean empty summary when there are no collections or cabinets", () => {
    const summary = buildMySpaceData({ items: [], collections: [], cabinets: [] });

    expect(summary.recentItems).toEqual([]);
    expect(summary.collections).toEqual([]);
    expect(summary.featuredCabinet).toBeUndefined();
  });
});
