export const CATEGORIES = ["Funko Pop", "Action Figure", "Card", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Placement = {
  cabinetId: string;
  row: number;
  slot: number;
  updatedAt?: string;
};

export type Collectible = {
  id: string;
  name: string;
  category: Category;
  brand: string;
  franchise: string;
  condition: string;
  tags: string[];
  notes: string;
  acquiredAt: string;
  favorite: boolean;
  collectionIds: string[];
  imageIndex: number;
  samplePhotoIndex?: number;
  imageUrl?: string;
  photoUrls: string[];
  details: Record<string, string | boolean>;
  placement?: Placement;
  createdAt: string;
};

export type Collection = { id: string; name: string; description?: string };
export type Cabinet = { id: string; name: string; rows: number; slotsPerRow: number };
export type AppData = { items: Collectible[]; collections: Collection[]; cabinets: Cabinet[] };

export type CabinetPreviewRow = { index: number; slots: (Collectible | null)[] };
export type CabinetPreview = { cabinet: Cabinet; placedCount: number; rows: CabinetPreviewRow[] };
export type CollectionPreview = { collection: Collection; itemCount: number; items: Collectible[] };
export type MySpaceData = {
  recentItems: Collectible[];
  collections: CollectionPreview[];
  cabinets: Cabinet[];
  featuredCabinet?: CabinetPreview;
};

export type ViewName = "My Space" | "Library" | "Shelves" | "Settings";
