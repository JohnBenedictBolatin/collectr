import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import { canPlaceItem, filterAndSortItems } from "@/lib/collection-utils";

describe("collection search and shelf placement", () => {
  it("searches across item names, brands, franchises, and tags without changing shelf positions", () => {
    const results = filterAndSortItems(demoData.items, {
      search: "astronaut", collectionId: "all", category: "All categories", condition: "All conditions", placement: "All items", sort: "Name A–Z",
    });
    expect(results.map((item) => item.id)).toEqual(["i-moon"]);
    expect(results[0].placement).toEqual(demoData.items[0].placement);
  });

  it("keeps collection membership independent from a physical shelf filter", () => {
    const results = filterAndSortItems(demoData.items, {
      search: "", collectionId: "c-cosmos", category: "All categories", condition: "All conditions", placement: "Unplaced", sort: "Name A–Z",
    });
    expect(results.map((item) => item.id)).toEqual([]);
    const favorites = filterAndSortItems(demoData.items, {
      search: "", collectionId: "favorites", category: "All categories", condition: "All conditions", placement: "Placed", sort: "Name A–Z",
    });
    expect(favorites.map((item) => item.id)).toEqual(["i-cloud", "i-moon"]);
  });

  it("rejects an occupied slot while allowing the same item to keep its current slot", () => {
    expect(canPlaceItem(demoData.items,"i-pocket","cab-living",0,0)).toBe(false);
    expect(canPlaceItem(demoData.items,"i-moon","cab-living",0,0)).toBe(true);
    expect(canPlaceItem(demoData.items,"i-pocket","cab-living",12,0)).toBe(false);
  });
});
