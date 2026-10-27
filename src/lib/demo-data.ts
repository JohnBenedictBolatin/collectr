import type { AppData, Cabinet, Collectible, Collection } from "@/lib/types";

const today = "2026-10-28";
export const demoCollections: Collection[] = [
  { id: "c-favorites", name: "Favorites", description: "The pieces I reach for first" },
  { id: "c-cosmos", name: "Cosmic shelf", description: "Little things from far away" },
  { id: "c-cards", name: "Trading cards", description: "Cards worth keeping close" },
];

export const demoCabinets: Cabinet[] = [
  { id: "cab-living", name: "Living room display", rows: 2, slotsPerRow: 4 },
  { id: "cab-study", name: "Study cabinet", rows: 1, slotsPerRow: 4 },
];

export const demoItems: Collectible[] = [
  { id: "i-moon", name: "Moon Ranger", category: "Funko Pop", brand: "Vinyl Orbit", franchise: "Cosmic Tales", condition: "Like new", tags: ["astronaut", "favorite"], notes: "First figure from the series.", acquiredAt: "2025-06-12", favorite: true, collectionIds: ["c-favorites", "c-cosmos"], imageIndex: 0, samplePhotoIndex: 0, photoUrls: [], details: { popNumber: "042", edition: "Special edition" }, placement: { cabinetId: "cab-living", row: 0, slot: 0 }, createdAt: today },
  { id: "i-atlas", name: "Atlas Scout", category: "Action Figure", brand: "Field Unit", franchise: "Open Sky", condition: "Very good", tags: ["1:12 scale"], notes: "Comes with the small map accessory.", acquiredAt: "2025-08-02", favorite: false, collectionIds: ["c-cosmos"], imageIndex: 1, samplePhotoIndex: 1, photoUrls: [], details: { figureLine: "Trailblazers", scale: "1:12" }, placement: { cabinetId: "cab-living", row: 0, slot: 1 }, createdAt: today },
  { id: "i-cloud", name: "Cloud Dragon #018", category: "Card", brand: "Mythic Atlas", franchise: "Skybound", condition: "Near mint", tags: ["foil"], notes: "Pulled from my first set box.", acquiredAt: "2025-10-19", favorite: true, collectionIds: ["c-favorites", "c-cards"], imageIndex: 2, samplePhotoIndex: 2, photoUrls: [], details: { cardGame: "Skybound", setName: "High Clouds", cardNumber: "018", graded: false }, placement: { cabinetId: "cab-living", row: 0, slot: 2 }, createdAt: today },
  { id: "i-turtle", name: "Nomad Turtle", category: "Other", brand: "Little Planet", franchise: "Tales from Home", condition: "Good", tags: ["plush"], notes: "A desk companion.", acquiredAt: "2025-04-09", favorite: false, collectionIds: ["c-favorites"], imageIndex: 3, samplePhotoIndex: 3, photoUrls: [], details: {}, placement: { cabinetId: "cab-living", row: 1, slot: 0 }, createdAt: today },
  { id: "i-shuttle", name: "Starliner Shuttle", category: "Other", brand: "Orbital Models", franchise: "Flight Deck", condition: "Like new", tags: ["model"], notes: "Built from the small display kit.", acquiredAt: "2026-02-18", favorite: false, collectionIds: ["c-cosmos"], imageIndex: 4, samplePhotoIndex: 4, photoUrls: [], details: {}, placement: { cabinetId: "cab-study", row: 0, slot: 0 }, createdAt: today },
  { id: "i-pocket", name: "Pocket Pixel", category: "Other", brand: "Retro Pocket", franchise: "Games", condition: "Good", tags: ["handheld", "keepsake"], notes: "Kept from my first console collection.", acquiredAt: "2024-12-04", favorite: false, collectionIds: [], imageIndex: 5, samplePhotoIndex: 5, photoUrls: [], details: {}, createdAt: today },
];

export const demoData: AppData = { items: demoItems, collections: demoCollections, cabinets: demoCabinets };

export function withDemoDefaults(saved: Partial<AppData> | null): AppData {
  if (!saved) return structuredClone(demoData);
  return {
    items: saved.items ?? structuredClone(demoItems),
    collections: saved.collections ?? structuredClone(demoCollections),
    cabinets: saved.cabinets ?? structuredClone(demoCabinets),
  };
}

export function toTags(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}
