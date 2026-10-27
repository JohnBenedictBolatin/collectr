import { z } from "zod";
import { CATEGORIES } from "@/lib/types";

export const collectibleInput = z.object({
  name: z.string().trim().min(1, "Add a name for this collectible.").max(120),
  category: z.enum(CATEGORIES),
  brand: z.string().trim().max(100).default(""),
  franchise: z.string().trim().max(100).default(""),
  condition: z.string().trim().max(60).default("Not set"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().trim().max(2000).default(""),
  acquiredAt: z.string().max(10).default(""),
  details: z.record(z.string(), z.union([z.string(), z.boolean()])).default({}),
});

export const cabinetNameInput = z.string().trim().min(1, "Give your cabinet a name.").max(80);

export function isValidCollectibleImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024;
}

export const MAX_ITEM_PHOTOS = 5;
