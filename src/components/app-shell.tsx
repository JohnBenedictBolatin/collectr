"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Armchair, ArrowDownWideNarrow, ArrowRight, BookOpen, Boxes, Check, ChevronDown, CircleHelp,
  ClipboardList, Clock3, Grid2X2, Heart, House, ImagePlus, LibraryBig, List, LogOut, MapPin,
  MoreHorizontal, PackagePlus, PanelsTopLeft, Plus, Search, Settings, ShieldCheck, SlidersHorizontal,
  Sparkles, Trash2, X,
} from "lucide-react";
import { Cole } from "@/components/cole";
import { canPlaceItem, filterAndSortItems } from "@/lib/collection-utils";
import { addCabinetRow, createCabinet, createCollection, createCollectible, deleteCollectible, duplicateCollectible, loadCollectiblePage, loadMySpaceSummary, moveCollectible, removeCabinet, removeCabinetRow, resizeCabinetSlots, saveProfileSettings, setCollectionMembership, setFavorite, signOut, updateCollectible } from "@/lib/actions";
import { demoItems, toTags, withDemoDefaults } from "@/lib/demo-data";
import { buildMySpaceData } from "@/lib/my-space-utils";
import { isValidCollectibleImage, MAX_ITEM_PHOTOS } from "@/lib/validation";
import { CATEGORIES, type AppData, type Cabinet, type Category, type Collectible, type MySpaceData, type ViewName } from "@/lib/types";

const DEMO_KEY = "collectr-demo-data-v1";
const DEMO_SETTINGS_KEY = "collectr-demo-settings-v1";
const photoPositions = ["0% 0%", "50% 0%", "100% 0%", "0% 100%", "50% 100%", "100% 100%"];
const shelfLocation = (item: Collectible, cabinets: Cabinet[]) => {
  const cabinet = cabinets.find((entry) => entry.id === item.placement?.cabinetId);
  return cabinet && item.placement ? `${cabinet.name} · ${String.fromCharCode(65 + item.placement.row)}${item.placement.slot + 1}` : "Unplaced";
};

type BadgeTone = "teal" | "orange" | "amber";
function IconBadge({ icon, tone, size = "regular" }: { icon: React.ReactNode; tone: BadgeTone; size?: "small" | "regular" }) {
  return <span className={`icon-badge icon-badge-${tone}${size === "small" ? " icon-badge-small" : ""}`} aria-hidden="true">{icon}</span>;
}

function Photo({ item, className = "thumb", title }: { item: Collectible; className?: string; title?: string }) {
  const hasSamplePhoto = item.samplePhotoIndex !== undefined;
  const style = item.imageUrl
    ? { backgroundImage: `url("${item.imageUrl}")`, backgroundPosition: "center" }
    : hasSamplePhoto
      ? { backgroundPosition: photoPositions[item.samplePhotoIndex! % photoPositions.length] }
      : undefined;
  return <span aria-label={title ?? item.name} role="img" className={`${className}${item.imageUrl ? " custom-photo" : !hasSamplePhoto ? " photo-missing" : ""}`} style={style}>{!item.imageUrl && !hasSamplePhoto && <PackagePlus aria-hidden="true" />}</span>;
}

async function compressPhoto(file: File): Promise<string> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the photo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.82);
  } finally { URL.revokeObjectURL(source); }
}

export function AppShell({ demo = false, initialData, initialMySpaceData, initialMySpaceError = "", displayName, reduceMascot = false }: { demo?: boolean; initialData: AppData; initialMySpaceData?: MySpaceData; initialMySpaceError?: string; displayName: string; reduceMascot?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initialData.items);
  const [collections, setCollections] = useState(initialData.collections);
  const [cabinets, setCabinets] = useState(initialData.cabinets);
  const [activeView, setActiveView] = useState<ViewName>("My Space");
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [selectedCabinet, setSelectedCabinet] = useState(initialMySpaceData?.featuredCabinet?.cabinet.id ?? initialData.cabinets[0]?.id ?? "");
  const [mySpaceData, setMySpaceData] = useState(initialMySpaceData);
  const [mySpaceLoading, setMySpaceLoading] = useState(false);
  const [mySpaceError, setMySpaceError] = useState(initialMySpaceError);
  const [pendingCabinetId, setPendingCabinetId] = useState("");
  const [retryCabinetId, setRetryCabinetId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [conditionFilter, setConditionFilter] = useState("All conditions");
  const [placementFilter, setPlacementFilter] = useState("All items");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Recently added");
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<Collectible | null>(null);
  const [showNewCabinet, setShowNewCabinet] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [detailItem, setDetailItem] = useState<Collectible | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [moreCollectionName, setMoreCollectionName] = useState("");
  const [reduceMascotLocal, setReduceMascotLocal] = useState(reduceMascot);
  const [nameLocal, setNameLocal] = useState(displayName);

  useEffect(() => {
    if (demo) {
      try {
        const saved = localStorage.getItem(DEMO_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<AppData>;
          const next = withDemoDefaults(parsed);
          const seededPhotos = new Map(demoItems.map((item) => [item.id, item.samplePhotoIndex]));
          setItems(next.items.map((item) => item.samplePhotoIndex === undefined && seededPhotos.has(item.id) ? { ...item, samplePhotoIndex: seededPhotos.get(item.id) } : item));
          setCollections(next.collections); setCabinets(next.cabinets);
        }
        const savedSettings = localStorage.getItem(DEMO_SETTINGS_KEY);
        if (savedSettings) {
          const settings = JSON.parse(savedSettings) as { displayName?: string; reduceMascot?: boolean };
          if (settings.displayName) setNameLocal(settings.displayName);
          if (typeof settings.reduceMascot === "boolean") setReduceMascotLocal(settings.reduceMascot);
        }
      } catch { setNotice("The saved demo could not be read. Your sample collection is ready again."); }
    }
    setHydrated(true);
  }, [demo]);

  useEffect(() => {
    if (!demo) {
      setItems(initialData.items); setCollections(initialData.collections); setCabinets(initialData.cabinets);
      setVisibleCount(Math.max(50, initialData.items.length));
      setMySpaceData(initialMySpaceData);
      setMySpaceError(initialMySpaceError);
      setSelectedCabinet((current) => initialMySpaceData?.cabinets.some((cabinet) => cabinet.id === current) ? current : initialMySpaceData?.featuredCabinet?.cabinet.id ?? initialData.cabinets[0]?.id ?? "");
    }
  }, [demo, initialData, initialMySpaceData, initialMySpaceError]);

  const featuredCabinetId = mySpaceData?.featuredCabinet?.cabinet.id ?? "";
  useEffect(() => {
    if (!demo && activeView === "My Space" && selectedCabinet && selectedCabinet !== featuredCabinetId) {
      void selectHomeCabinet(selectedCabinet);
    }
  }, [activeView, demo, selectedCabinet, featuredCabinetId]);

  useEffect(() => {
    if (!demo || !hydrated) return;
    try { localStorage.setItem(DEMO_KEY, JSON.stringify({ items, collections, cabinets })); }
    catch { setNotice("The browser ran out of room for the demo photo. Remove a large photo and try again."); }
  }, [demo, hydrated, items, collections, cabinets]);

  useEffect(() => {
    if (!notice && !error) return;
    const timer = window.setTimeout(() => { setNotice(""); setError(""); }, 4500);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

  const visibleItems = useMemo(() => filterAndSortItems(items, { search: query, collectionId: selectedCollection, category: categoryFilter, condition: conditionFilter, placement: placementFilter, sort }), [items, query, selectedCollection, categoryFilter, conditionFilter, placementFilter, sort]);
  const demoMySpaceData = useMemo(() => buildMySpaceData({ items, collections, cabinets }, selectedCabinet), [items, collections, cabinets, selectedCabinet]);
  const mySpaceViewData = demo ? demoMySpaceData : mySpaceData;

  const updateError = (value?: string) => { setError(value ?? ""); if (value) setNotice(""); };

  async function selectHomeCabinet(cabinetId: string) {
    if (demo) { setSelectedCabinet(cabinetId); setMySpaceError(""); return; }
    setPendingCabinetId(cabinetId); setRetryCabinetId(cabinetId); setMySpaceLoading(true); setMySpaceError("");
    try {
      const summary = await loadMySpaceSummary(cabinetId);
      setMySpaceData(summary);
      setSelectedCabinet(summary.featuredCabinet?.cabinet.id ?? summary.cabinets[0]?.id ?? "");
      setRetryCabinetId("");
    } catch {
      setMySpaceError("That shelf preview could not be loaded. Try again.");
    } finally {
      setPendingCabinetId(""); setMySpaceLoading(false);
    }
  }

  function openHomeCabinet(cabinetId: string) {
    setSelectedCabinet(cabinetId);
    setActiveView("Shelves");
  }

  function openHomeCollection(collectionId: string) {
    setSelectedCollection(collectionId);
    setCategoryFilter("All categories"); setConditionFilter("All conditions"); setPlacementFilter("All items"); setQuery("");
    setActiveView("Library");
  }

  function openLibrary() {
    setSelectedCollection("all"); setCategoryFilter("All categories"); setConditionFilter("All conditions"); setPlacementFilter("All items"); setQuery("");
    setActiveView("Library");
  }

  function submitGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedCollection("all"); setCategoryFilter("All categories"); setConditionFilter("All conditions"); setPlacementFilter("All items");
    setActiveView("Library");
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); updateError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const files = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length > MAX_ITEM_PHOTOS) { updateError("Choose up to five photos for one collectible."); setBusy(false); return; }
    if (files.some((file) => !isValidCollectibleImage(file))) { updateError("Photos must be JPG, PNG, or WebP files under 10 MB each."); setBusy(false); return; }
    if (!String(form.get("name") ?? "").trim()) { updateError("Add a name for this collectible."); setBusy(false); return; }

    if (!demo) {
      const result = await createCollectible(form);
      if ("error" in result) { updateError(result.error); setBusy(false); return; }
      setShowAdd(false); setBusy(false); setNotice("Collectible added to your library."); router.refresh(); return;
    }

    try {
      const category = String(form.get("category")) as Category;
      const photoUrls = await Promise.all(files.map(compressPhoto));
      const collectionIds = form.getAll("collectionIds").map(String);
      const detailEntries = Object.fromEntries([...form.entries()].filter(([key]) => key.startsWith("detail-")).map(([key,value]) => [key.slice(7), value]));
      const item: Collectible = {
        id: crypto.randomUUID(), name: String(form.get("name")).trim(), category, brand: String(form.get("brand") ?? "").trim(), franchise: String(form.get("franchise") ?? "").trim(),
        condition: String(form.get("condition") ?? "Not set"), tags: toTags(String(form.get("tags") ?? "")), notes: String(form.get("notes") ?? "").trim(), acquiredAt: String(form.get("acquiredAt") ?? ""),
        favorite: false, collectionIds, imageIndex: items.length % 6, imageUrl: photoUrls[0], photoUrls, details: detailEntries as Record<string,string>, createdAt: new Date().toISOString(),
      };
      setItems((current) => [item, ...current]); setShowAdd(false); setNotice("Added. Give it a shelf spot whenever you’re ready.");
    } catch { updateError("That photo could not be prepared. Try a JPG, PNG, or WebP image."); }
    finally { setBusy(false); }
  }

  async function toggleFavorite(item: Collectible) {
    updateError("");
    if (demo) { setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, favorite: !entry.favorite } : entry)); return; }
    const result = await setFavorite(item.id, !item.favorite);
    if ("error" in result) updateError(result.error); else router.refresh();
  }

  async function duplicateItem(item: Collectible) {
    updateError("");
    if (demo) {
      const duplicate: Collectible = { ...item, id: crypto.randomUUID(), name: `${item.name} (copy)`, favorite: false, placement: undefined, createdAt: new Date().toISOString() };
      setItems((current) => [duplicate,...current]); setDetailItem(null); setNotice("Duplicate added to your library. It still needs a shelf spot."); return;
    }
    const result = await duplicateCollectible(item.id);
    if ("error" in result) updateError(result.error); else { setDetailItem(null); setNotice("Duplicate added without a shelf spot."); router.refresh(); }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;
    const form = new FormData(event.currentTarget);
    if (!String(form.get("name") ?? "").trim()) { updateError("Add a name for this collectible."); return; }
    if (!demo) {
      const result = await updateCollectible(form);
      if ("error" in result) { updateError(result.error); return; }
      setEditingItem(null); setDetailItem(null); setNotice("Collectible updated."); router.refresh(); return;
    }
    const detailEntries = Object.fromEntries([...form.entries()].filter(([key]) => key.startsWith("detail-")).map(([key,value]) => [key.slice(7),value]));
    const patch: Partial<Collectible> = {
      name: String(form.get("name")).trim(), category: String(form.get("category")) as Category, brand: String(form.get("brand") ?? "").trim(), franchise: String(form.get("franchise") ?? "").trim(),
      condition: String(form.get("condition") ?? "Not set"), tags: toTags(String(form.get("tags") ?? "")), notes: String(form.get("notes") ?? "").trim(), acquiredAt: String(form.get("acquiredAt") ?? ""),
      collectionIds: form.getAll("collectionIds").map(String), details: detailEntries as Record<string,string>,
    };
    setItems((current) => current.map((item) => item.id === editingItem.id ? { ...item, ...patch } : item)); setEditingItem(null); setDetailItem(null); setNotice("Collectible updated.");
  }

  async function deleteItem(item: Collectible) {
    const accepted = window.confirm(`Remove “${item.name}” from your collection?`);
    if (!accepted) return;
    if (demo) { setItems((current) => current.filter((entry) => entry.id !== item.id)); setSelectedIds((current) => current.filter((id) => id !== item.id)); setDetailItem(null); setNotice("Collectible removed. Its collection memberships and shelf spot are clear."); return; }
    const result = await deleteCollectible(item.id);
    if ("error" in result) updateError(result.error); else { setDetailItem(null); setNotice("Collectible removed."); router.refresh(); }
  }

  async function moveItem(item: Collectible, cabinetId: string | null, row: number | null, slot: number | null) {
    updateError("");
    if (cabinetId && row !== null && slot !== null && !canPlaceItem(items,item.id,cabinetId,row,slot)) {
      updateError("That shelf spot is already taken. Choose an empty slot."); return;
    }
    if (demo) {
      setBusy(true);
      await new Promise((resolve) => window.setTimeout(resolve, 130));
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, placement: cabinetId && row !== null && slot !== null ? { cabinetId, row, slot, updatedAt: new Date().toISOString() } : undefined } : entry));
      setBusy(false); setNotice(cabinetId ? "Shelf spot saved." : "Moved to unplaced items."); return;
    }
    const result = await moveCollectible(item.id, cabinetId, row, slot, item.placement?.updatedAt);
    if ("error" in result) { updateError(result.error); router.refresh(); }
    else { setNotice(cabinetId ? "Shelf spot saved." : "Moved to unplaced items."); router.refresh(); }
  }

  async function addCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); updateError("");
    const name = moreCollectionName.trim();
    if (!name) { updateError("Give the collection a name."); return; }
    if (collections.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) { updateError("A collection already has that name."); return; }
    if (demo) { const entry = { id: crypto.randomUUID(), name }; setCollections((current) => [...current, entry]); setSelectedCollection(entry.id); setMoreCollectionName(""); setShowNewCollection(false); return; }
    const result = await createCollection(name);
    if ("error" in result) { updateError(result.error); return; }
    setMoreCollectionName(""); setShowNewCollection(false); setSelectedCollection(result.collection.id); router.refresh();
  }

  async function applyCollection(add: boolean) {
    if (!selectedCollection || selectedCollection === "all" || selectedCollection === "favorites" || !selectedIds.length) return;
    if (demo) {
      setItems((current) => current.map((item) => selectedIds.includes(item.id) ? { ...item, collectionIds: add ? [...new Set([...item.collectionIds, selectedCollection])] : item.collectionIds.filter((id) => id !== selectedCollection) } : item));
    } else {
      const result = await setCollectionMembership(selectedIds, selectedCollection, add);
      if ("error" in result) { updateError(result.error); return; }
      router.refresh();
    }
    setSelectedIds([]); setNotice(add ? "Selected items added to the collection." : "Selected items removed from the collection.");
  }

  async function addCabinet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("cabinetName") ?? "").trim();
    if (!name) { updateError("Give the cabinet a name."); return; }
    if (cabinets.some((cabinet) => cabinet.name.toLowerCase() === name.toLowerCase())) { updateError("A cabinet already has that name."); return; }
    if (demo) {
      const cabinet = { id: crypto.randomUUID(), name, rows: 1, slotsPerRow: 4 };
      setCabinets((current) => [...current, cabinet]); setSelectedCabinet(cabinet.id); setShowNewCabinet(false); setNotice("Cabinet added. Your new row is ready."); return;
    }
    const result = await createCabinet(name);
    if ("error" in result) { updateError(result.error); return; }
    setSelectedCabinet(result.cabinet.id); setShowNewCabinet(false); router.refresh();
  }

  async function addRow(cabinet: Cabinet) {
    if (cabinet.rows >= 12) { updateError("A cabinet can have up to twelve rows."); return; }
    if (demo) { setCabinets((current) => current.map((entry) => entry.id === cabinet.id ? { ...entry, rows: entry.rows + 1 } : entry)); return; }
    const result = await addCabinetRow(cabinet.id);
    if ("error" in result) updateError(result.error); else router.refresh();
  }

  async function changeSlotCount(cabinet: Cabinet, delta: number) {
    const count = cabinet.slotsPerRow + delta;
    if (count < 1 || count > 12) return;
    const displaced = delta < 0 ? items.filter((item) => item.placement?.cabinetId === cabinet.id && item.placement.slot >= count).length : 0;
    if (delta < 0 && !window.confirm(`Remove ${Math.abs(delta)} shelf spot${Math.abs(delta) === 1 ? "" : "s"} per row? ${displaced} item${displaced === 1 ? " will" : "s will"} become unplaced.`)) return;
    if (demo) {
      setCabinets((current) => current.map((entry) => entry.id === cabinet.id ? { ...entry, slotsPerRow: count } : entry));
      if (delta < 0) setItems((current) => current.map((item) => item.placement?.cabinetId === cabinet.id && item.placement.slot >= count ? { ...item, placement: undefined } : item));
      return;
    }
    const result = await resizeCabinetSlots(cabinet.id,count);
    if ("error" in result) updateError(result.error); else { setNotice(result.displaced ? `${result.displaced} item${result.displaced === 1 ? " was" : "s were"} moved to Unplaced items.` : "Shelf spots updated."); router.refresh(); }
  }

  async function loadMore() {
    setBusy(true);
    try {
      const nextPage = await loadCollectiblePage(visibleCount);
      setItems((current) => [...current, ...nextPage.items]);
      setCollections(nextPage.collections);
      setCabinets(nextPage.cabinets);
      setVisibleCount((count) => count + nextPage.items.length);
    } catch { updateError("More items could not be loaded. Refresh to try again."); }
    finally { setBusy(false); }
  }

  async function saveSettings() {
    if (demo) {
      try {
        localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify({ displayName: nameLocal.trim() || "Collector", reduceMascot: reduceMascotLocal }));
        setNameLocal((value) => value.trim() || "Collector");
        setNotice("Profile preferences saved in this browser.");
      } catch { updateError("Settings could not be saved in this browser."); }
      return;
    }
    const result = await saveProfileSettings(nameLocal, reduceMascotLocal);
    if ("error" in result) updateError(result.error);
    else { setNotice("Profile settings saved."); router.refresh(); }
  }

  async function deleteRow(cabinet: Cabinet, rowIndex: number) {
    const displaced = items.filter((item) => item.placement?.cabinetId === cabinet.id && item.placement.row === rowIndex).length;
    const accepted = window.confirm(`Remove row ${String.fromCharCode(65 + rowIndex)}? ${displaced} item${displaced === 1 ? " will" : "s will"} move to Unplaced items.`);
    if (!accepted) return;
    if (demo) {
      setItems((current) => current.map((item) => {
        if (item.placement?.cabinetId !== cabinet.id) return item;
        if (item.placement.row === rowIndex) return { ...item, placement: undefined };
        return item.placement.row > rowIndex ? { ...item, placement: { ...item.placement, row: item.placement.row - 1 } } : item;
      }));
      setCabinets((current) => current.map((entry) => entry.id === cabinet.id ? { ...entry, rows: Math.max(1, entry.rows - 1) } : entry));
      setNotice(`${displaced} item${displaced === 1 ? " was" : "s were"} moved to Unplaced items.`); return;
    }
    const result = await removeCabinetRow(cabinet.id, rowIndex);
    if ("error" in result) updateError(result.error); else { setNotice("Row removed; the remaining shelf items are safe."); router.refresh(); }
  }

  async function deleteCabinet(cabinet: Cabinet) {
    const displaced = items.filter((item) => item.placement?.cabinetId === cabinet.id).length;
    const accepted = window.confirm(`Delete “${cabinet.name}”? ${displaced} item${displaced === 1 ? " will" : "s will"} become unplaced and stay in your library.`);
    if (!accepted) return;
    if (demo) {
      setCabinets((current) => current.filter((entry) => entry.id !== cabinet.id));
      setItems((current) => current.map((item) => item.placement?.cabinetId === cabinet.id ? { ...item, placement: undefined } : item));
      setSelectedCabinet(cabinets.find((entry) => entry.id !== cabinet.id)?.id ?? ""); setNotice("Cabinet deleted; its items remain in your library."); return;
    }
    const result = await removeCabinet(cabinet.id);
    if ("error" in result) updateError(result.error); else router.refresh();
  }

  const placed = items.filter((item) => item.placement);
  const unplaced = items.filter((item) => !item.placement);
  const selectedCabinetData = cabinets.find((cabinet) => cabinet.id === selectedCabinet) ?? cabinets[0];
  const allSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.includes(item.id));
  const mascotClass = reduceMascotLocal ? " reduce-mascot" : "";

  return (
    <div className={`app-shell${mascotClass}`}>
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark"><span /></span><span>Collectr</span></div>
        <div className="side-divider" />
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={activeView === "My Space"} icon={<House />} tone="teal" label="My Space" onClick={() => setActiveView("My Space")} />
          <NavButton active={activeView === "Library"} icon={<LibraryBig />} tone="amber" label="Library" onClick={() => { setActiveView("Library"); setSelectedCollection("all"); }} count={items.length} />
          <NavButton active={activeView === "Shelves"} icon={<PanelsTopLeft />} tone="orange" label="Shelves" onClick={() => setActiveView("Shelves")} count={cabinets.length} />
        </nav>
        <div className="side-divider" />
        <div className="side-section-title">Quick filters</div>
        <div className="side-collections">
          <button className={`collection-side collection-shortcut${selectedCollection === "favorites" ? " selected" : ""}`} onClick={() => { setSelectedCollection("favorites"); setActiveView("Library"); }}><IconBadge icon={<Heart />} tone="amber" size="small" /><span>Starred items</span><span className="side-count">{items.filter((item) => item.favorite).length}</span></button>
        </div>
        <div className="side-section-title side-collection-heading">Your collections <button className="side-add" aria-label="Create a collection" onClick={() => setShowNewCollection(!showNewCollection)}><Plus size={14} /></button></div>
        <div className="side-collections">
          {collections.map((collection, index) => <button className={`collection-side collection-side-${["teal", "orange", "amber"][index % 3]}${selectedCollection === collection.id ? " selected" : ""}`} key={collection.id} onClick={() => { setSelectedCollection(collection.id); setActiveView("Library"); }}><span className="collection-dot" />{collection.name}<span className="side-count">{items.filter((item) => item.collectionIds.includes(collection.id)).length}</span></button>)}
        </div>
        {showNewCollection && activeView !== "My Space" && <form className="inline-create" onSubmit={addCollection}><label className="sr-only" htmlFor="new-collection">Collection name</label><input id="new-collection" value={moreCollectionName} onChange={(event) => setMoreCollectionName(event.target.value)} placeholder="New collection name" maxLength={80} /><button className="icon-button" aria-label="Save collection"><Check size={14} /></button></form>}
        <div className="sidebar-bottom">
          <NavButton active={activeView === "Settings"} icon={<Settings />} tone="teal" label="Settings" onClick={() => setActiveView("Settings")} />
          {demo && <div className="demo-status"><ShieldCheck /><span><strong>Local demo</strong>Saved in this browser.</span></div>}
          <div className="profile-row"><span className="profile-avatar"><CircleHelp /></span><span className="profile-text"><strong>{nameLocal}</strong><small>{demo ? "Your collection space" : "Private collection"}</small></span>{!demo && <form action={signOut}><button className="icon-button" aria-label="Sign out"><LogOut size={15} /></button></form>}</div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><span /></span><span>Collectr</span></div>
          <form className="global-search" role="search" onSubmit={submitGlobalSearch}><Search /><label className="sr-only" htmlFor="global-collection-search">Search your collection</label><input id="global-collection-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your collection…" /></form>
          <div className="topbar-spacer" />
          <button className="user-chip" aria-label="Open settings" onClick={() => setActiveView("Settings")}><Settings /></button>
          <button className="button button-primary" onClick={() => setShowAdd(true)}><Plus />Add collectible</button>
        </header>

        <div className="content-wrap">
          {error && <p className="workspace-error" role="alert">{error}</p>}
          {activeView === "Library" && <LibraryView items={visibleItems.slice(0, visibleCount)} allItems={visibleItems} collections={collections} cabinets={cabinets} unplaced={unplaced} query={query} setQuery={setQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} conditionFilter={conditionFilter} setConditionFilter={setConditionFilter} placementFilter={placementFilter} setPlacementFilter={setPlacementFilter} sort={sort} setSort={setSort} layout={layout} setLayout={setLayout} selectedIds={selectedIds} setSelectedIds={setSelectedIds} allSelected={allSelected} setAllSelected={() => setSelectedIds(allSelected ? [] : visibleItems.map((item) => item.id))} selectedCollection={selectedCollection} setSelectedCollection={setSelectedCollection} onAdd={() => setShowAdd(true)} onDetails={setDetailItem} onFavorite={toggleFavorite} onDelete={deleteItem} onOpenShelves={() => setActiveView("Shelves")} onApplyCollection={applyCollection} onMore={loadMore} hasMore={!demo && items.length >= visibleCount} totalCount={items.length} loadingMore={busy} />}
          {activeView === "My Space" && <MySpaceView data={mySpaceViewData} cabinets={cabinets} displayName={nameLocal} reduceMascot={reduceMascotLocal} loading={mySpaceLoading} loadingCabinetId={pendingCabinetId} error={mySpaceError} onRetry={() => selectHomeCabinet(retryCabinetId || selectedCabinet)} onSelectCabinet={selectHomeCabinet} onAdd={() => setShowAdd(true)} onCreateCabinet={() => setShowNewCabinet(true)} onCreateCollection={() => setShowNewCollection(true)} onDetails={setDetailItem} onOpenCabinet={openHomeCabinet} onOpenCollection={openHomeCollection} onBrowseLibrary={openLibrary} />}
          {activeView === "Shelves" && <ShelvesView cabinets={cabinets} items={items} selectedCabinet={selectedCabinetData?.id ?? ""} unplaced={unplaced} busy={busy} onSelectCabinet={setSelectedCabinet} onAddCabinet={() => setShowNewCabinet(true)} onAddRow={addRow} onChangeSlots={changeSlotCount} onRemoveRow={deleteRow} onDeleteCabinet={deleteCabinet} onMove={moveItem} onDetails={setDetailItem} />}
          {activeView === "Settings" && <SettingsView reduceMascot={reduceMascotLocal} onReduceMascot={setReduceMascotLocal} displayName={nameLocal} onName={setNameLocal} demo={demo} onSave={saveSettings} />}
        </div>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          <MobileNav active={activeView === "My Space"} icon={<House />} tone="teal" label="My Space" onClick={() => setActiveView("My Space")} />
          <MobileNav active={activeView === "Library"} icon={<BookOpen />} tone="amber" label="Library" onClick={() => setActiveView("Library")} />
          <button className="bottom-add" aria-label="Add collectible" onClick={() => setShowAdd(true)}><Plus /></button>
          <MobileNav active={activeView === "Shelves"} icon={<PanelsTopLeft />} tone="orange" label="Shelves" onClick={() => setActiveView("Shelves")} />
        </nav>
      </main>

      {showAdd && <AddDialog collections={collections} onClose={() => { setShowAdd(false); updateError(""); }} onSubmit={handleAdd} busy={busy} error={error} />}
      {showNewCollection && activeView === "My Space" && <NewCollectionDialog value={moreCollectionName} onChange={setMoreCollectionName} onClose={() => { setShowNewCollection(false); setMoreCollectionName(""); }} onSubmit={addCollection} error={error} />}
      {editingItem && <AddDialog key={editingItem.id} collections={collections} item={editingItem} onClose={() => { setEditingItem(null); updateError(""); }} onSubmit={handleEdit} busy={busy} error={error} />}
      {showNewCabinet && <NewCabinetDialog onClose={() => setShowNewCabinet(false)} onSubmit={addCabinet} error={error} />}
      {detailItem && <DetailDrawer item={items.find((item) => item.id === detailItem.id) ?? detailItem} collections={collections} cabinets={cabinets} onClose={() => setDetailItem(null)} onFavorite={toggleFavorite} onDelete={deleteItem} onMove={moveItem} onEdit={() => { setEditingItem(items.find((item) => item.id === detailItem.id) ?? detailItem); setDetailItem(null); }} onDuplicate={() => duplicateItem(items.find((item) => item.id === detailItem.id) ?? detailItem)} />}
      {(notice || error) && <div className="toast" role={error ? "alert" : "status"}>{error || notice}</div>}
    </div>
  );
}

function NavButton({ active, icon, tone, label, onClick, count }: { active: boolean; icon: React.ReactNode; tone: BadgeTone; label: string; onClick: () => void; count?: number }) {
  return <button className={`side-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}><IconBadge icon={icon} tone={tone} /><span>{label}</span>{count !== undefined && <span className="side-count">{count}</span>}</button>;
}
function MobileNav({ active, icon, tone, label, onClick }: { active: boolean; icon: React.ReactNode; tone: BadgeTone; label: string; onClick: () => void }) {
  return <button className={`bottom-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}><IconBadge icon={icon} tone={tone} size="small" /><span>{label}</span></button>;
}

function LibraryView(props: {
  items: Collectible[]; allItems: Collectible[]; collections: AppData["collections"]; cabinets: Cabinet[]; unplaced: Collectible[]; query: string; setQuery: (v: string) => void;
  categoryFilter: string; setCategoryFilter: (v: string) => void; conditionFilter: string; setConditionFilter: (v: string) => void; placementFilter: string; setPlacementFilter: (v: string) => void;
  sort: string; setSort: (v: string) => void; layout: "grid" | "list"; setLayout: (v: "grid" | "list") => void; selectedIds: string[]; setSelectedIds: (v: string[] | ((c: string[]) => string[])) => void;
  allSelected: boolean; setAllSelected: () => void; selectedCollection: string; setSelectedCollection: (v: string) => void; onAdd: () => void; onDetails: (v: Collectible) => void; onFavorite: (v: Collectible) => void; onDelete: (v: Collectible) => void; onOpenShelves: () => void; onApplyCollection: (add: boolean) => void; onMore: () => void; hasMore: boolean; totalCount: number; loadingMore: boolean;
}) {
  const visibleConditions = [...new Set(props.allItems.map((item) => item.condition).filter((condition) => condition && condition !== "Not set"))];
  return <>
    <div className="page-heading"><div><h1>My Library</h1><p>{props.totalCount} collectible{props.totalCount === 1 ? "" : "s"} in your collection</p></div><div className="heading-actions"><button className="button button-primary" onClick={props.onAdd}><Plus />Add collectible</button></div></div>
    <div className="subnav-pills" aria-label="Collection filters">
      <button className={`filter-pill${props.selectedCollection === "all" ? " active" : ""}`} onClick={() => props.setSelectedCollection("all")}>All items <span>({props.totalCount})</span></button>
      <button className={`filter-pill${props.selectedCollection === "favorites" ? " active" : ""}`} onClick={() => props.setSelectedCollection("favorites")}><Heart size={12} /> Favorites</button>
      {props.collections.map((collection) => <button key={collection.id} className={`filter-pill${props.selectedCollection === collection.id ? " active" : ""}`} onClick={() => props.setSelectedCollection(collection.id)}>{collection.name}</button>)}
    </div>
    <div className="library-grid">
      <section className="catalog-column" aria-label="Collectibles">
        <div className="catalog-toolbar">
          <label className="field-search mobile-catalog-search"><Search /><span className="sr-only">Search library</span><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Find an item, brand, or tag…" /></label>
          <select className="select-control" aria-label="Filter by category" value={props.categoryFilter} onChange={(event) => props.setCategoryFilter(event.target.value)}><option>All categories</option>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select>
          <select className="select-control" aria-label="Filter by condition" value={props.conditionFilter} onChange={(event) => props.setConditionFilter(event.target.value)}><option>All conditions</option>{visibleConditions.map((value) => <option key={value}>{value}</option>)}</select>
          <select className="select-control" aria-label="Filter by shelf placement" value={props.placementFilter} onChange={(event) => props.setPlacementFilter(event.target.value)}><option>All items</option><option>Placed</option><option>Unplaced</option></select>
          <label className="toolbar-label"><ArrowDownWideNarrow size={13} /><span className="sr-only">Sort by</span><select className="select-control" value={props.sort} onChange={(event) => props.setSort(event.target.value)}><option>Recently added</option><option>Name A–Z</option><option>Acquisition date</option></select></label>
          <div className="view-toggle" aria-label="Layout"><button className={`icon-button${props.layout === "grid" ? " selected" : ""}`} aria-label="Show grid" aria-pressed={props.layout === "grid"} onClick={() => props.setLayout("grid")}><Grid2X2 /></button><button className={`icon-button${props.layout === "list" ? " selected" : ""}`} aria-label="Show list" aria-pressed={props.layout === "list"} onClick={() => props.setLayout("list")}><List /></button></div>
        </div>
        {!!props.selectedIds.length && <div className="selection-bar"><strong>{props.selectedIds.length} selected</strong>{props.selectedCollection !== "all" && props.selectedCollection !== "favorites" && <><button className="button button-quiet" onClick={() => props.onApplyCollection(true)}>Add to collection</button><button className="button button-quiet" onClick={() => props.onApplyCollection(false)}>Remove from collection</button></>}<button className="icon-button" aria-label="Clear selection" onClick={() => props.setSelectedIds([])}><X /></button></div>}
        {props.items.length === 0 ? <EmptyLibrary hasQuery={Boolean(props.query)} onAdd={props.onAdd} /> : props.layout === "list" ? <div className="table-scroll"><table className="items-table"><thead><tr><th className="check-cell"><input type="checkbox" checked={props.allSelected} onChange={props.setAllSelected} aria-label="Select all visible items" /></th><th>Item</th><th>Category</th><th>Collection</th><th>Condition</th><th>Shelf position</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{props.items.map((item) => <ItemRow key={item.id} item={item} collections={props.collections} cabinets={props.cabinets} selected={props.selectedIds.includes(item.id)} onSelect={(checked) => props.setSelectedIds((current) => checked ? [...current,item.id] : current.filter((id) => id !== item.id))} onDetails={() => props.onDetails(item)} onFavorite={() => props.onFavorite(item)} />)}</tbody></table></div> : <div className="cards-grid">{props.items.map((item) => <ItemCard key={item.id} item={item} collections={props.collections} cabinets={props.cabinets} selected={props.selectedIds.includes(item.id)} onSelect={(checked) => props.setSelectedIds((current) => checked ? [...current,item.id] : current.filter((id) => id !== item.id))} onDetails={() => props.onDetails(item)} onFavorite={() => props.onFavorite(item)} />)}</div>}
        {props.hasMore && <div className="pagination-row"><button className="button button-secondary" disabled={props.loadingMore} onClick={props.onMore}>{props.loadingMore ? "Loading…" : "Load 50 more items"} <ArrowRight /></button></div>}
      </section>
      <aside className="shelf-summary" aria-label="Shelf overview"><div className="summary-heading"><Armchair /><h2>My Shelves</h2><button className="icon-button" aria-label="Open shelves" onClick={props.onOpenShelves}><ArrowRight /></button></div>
        {props.cabinets.slice(0,2).map((cabinet) => <CabinetPreview key={cabinet.id} cabinet={cabinet} items={props.allItems} onOpen={props.onOpenShelves} />)}
        <div className="summary-foot"><span>{props.cabinets.length} cabinet{props.cabinets.length === 1 ? "" : "s"}</span><strong>{props.allItems.filter((item) => item.placement).length} placed</strong></div>
        <div className="unplaced-box"><div className="unplaced-box-head"><PackagePlus size={15} /><span>Unplaced items</span><span className="count-pill">{props.unplaced.length}</span></div><div className="unplaced-mini">{props.unplaced.slice(0,3).map((item) => <div key={item.id}><Photo item={item} /><div className="unplaced-mini-name">{item.name}</div></div>)}{props.unplaced.length === 0 && <span className="unplaced-mini-name">Everything has a spot.</span>}</div><button className="shelf-open-link" onClick={props.onOpenShelves}>Arrange a shelf <ArrowRight size={12} /></button></div>
      </aside>
    </div>
  </>;
}

function ItemRow({ item, collections, cabinets, selected, onSelect, onDetails, onFavorite }: { item: Collectible; collections: AppData["collections"]; cabinets: Cabinet[]; selected: boolean; onSelect: (v: boolean) => void; onDetails: () => void; onFavorite: () => void }) {
  const memberNames = collections.filter((collection) => item.collectionIds.includes(collection.id)).map((collection) => collection.name);
  return <tr><td className="check-cell"><input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} aria-label={`Select ${item.name}`} /></td><td><button className="table-item table-item-button" onClick={onDetails}><Photo item={item} /><span className="table-item-name">{item.name}</span></button></td><td><span className="category-tag">{item.category}</span></td><td>{memberNames.length ? memberNames.slice(0,2).join(", ") : <span className="muted">—</span>}</td><td><span className="status-tag">{item.condition}</span></td><td><span className="location-tag"><MapPin size={11} />{shelfLocation(item,cabinets)}</span></td><td><div className="row-actions"><button className={`fav-button${item.favorite ? " is-fav" : ""}`} aria-label={item.favorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`} aria-pressed={item.favorite} onClick={onFavorite}><Heart /></button><button className="icon-button row-overflow" aria-label={`More actions for ${item.name}`} onClick={onDetails}><MoreHorizontal /></button></div></td></tr>;
}

function ItemCard({ item, collections, cabinets, selected, onSelect, onDetails, onFavorite }: { item: Collectible; collections: AppData["collections"]; cabinets: Cabinet[]; selected: boolean; onSelect: (v: boolean) => void; onDetails: () => void; onFavorite: () => void }) {
  const collection = collections.find((entry) => item.collectionIds.includes(entry.id));
  return <article className="item-card"><label className="card-select"><input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} aria-label={`Select ${item.name}`} /></label><button className="icon-button card-overflow" aria-label={`Open details for ${item.name}`} onClick={onDetails}><MoreHorizontal /></button><button className={`card-image${item.imageUrl ? " custom-photo" : ""}`} style={item.imageUrl ? { backgroundImage: `url("${item.imageUrl}")` } : { backgroundPosition: photoPositions[item.imageIndex % photoPositions.length] }} aria-label={`View ${item.name}`} onClick={onDetails} /><div className="card-body"><div className="card-title-row"><button className="card-title item-title-button" onClick={onDetails}>{item.name}</button></div><span className="card-meta">{item.brand || item.category}</span><div className="card-footer"><span className="category-tag">{item.category}</span>{collection && <span className="category-tag orange">{collection.name}</span>}<button className={`fav-button${item.favorite ? " is-fav" : ""}`} aria-label={item.favorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`} onClick={onFavorite}><Heart /></button><span className="location-tag"><MapPin size={10} />{shelfLocation(item,cabinets)}</span></div></div></article>;
}

function CabinetPreview({ cabinet, items, onOpen }: { cabinet: Cabinet; items: Collectible[]; onOpen: () => void }) {
  return <button className="cabinet-preview" onClick={onOpen}><span className="cabinet-preview-head"><span>{cabinet.name}</span><small>{items.filter((item) => item.placement?.cabinetId === cabinet.id).length} items</small></span>{Array.from({ length: Math.min(cabinet.rows,2) }, (_,row) => <span className="preview-row" key={row}>{Array.from({ length: cabinet.slotsPerRow },(_,slot) => { const item = items.find((entry) => entry.placement?.cabinetId === cabinet.id && entry.placement.row === row && entry.placement.slot === slot); return <span key={slot} className={`preview-slot${item ? "" : " empty"}`} style={item && !item.imageUrl ? { backgroundPosition: photoPositions[item.imageIndex % photoPositions.length] } : item?.imageUrl ? { backgroundImage: `url("${item.imageUrl}")`, backgroundSize: "cover" } : undefined} />; })}</span>)}</button>;
}

function EmptyLibrary({ hasQuery, onAdd }: { hasQuery: boolean; onAdd: () => void }) {
  return <div className="empty-state"><Cole pose={hasQuery ? "point" : "welcome"} className="empty-cole" /><div className="empty-icon"><Boxes /></div><h2>{hasQuery ? "No collectibles found" : "A shelf is waiting"}</h2><p>{hasQuery ? "Try another name, brand, collection, or tag." : "Start with one piece. Add its name now and fill in the details whenever you like."}</p>{!hasQuery && <button className="button button-primary" onClick={onAdd}><Plus />Add your first collectible</button>}</div>;
}

function MySpaceView({ data, cabinets, displayName, reduceMascot, loading, loadingCabinetId, error, onRetry, onSelectCabinet, onAdd, onCreateCabinet, onCreateCollection, onDetails, onOpenCabinet, onOpenCollection, onBrowseLibrary }: {
  data?: MySpaceData;
  cabinets: Cabinet[];
  displayName: string;
  reduceMascot: boolean;
  loading: boolean;
  loadingCabinetId: string;
  error: string;
  onRetry: () => void;
  onSelectCabinet: (id: string) => void;
  onAdd: () => void;
  onCreateCabinet: () => void;
  onCreateCollection: () => void;
  onDetails: (item: Collectible) => void;
  onOpenCabinet: (id: string) => void;
  onOpenCollection: (id: string) => void;
  onBrowseLibrary: () => void;
}) {
  const recent = data?.recentItems ?? [];
  const featured = data?.featuredCabinet;
  const cabinetOptions = data?.cabinets ?? cabinets;
  const cabinetSelectValue = loadingCabinetId || featured?.cabinet.id || cabinetOptions[0]?.id || "";

  return <div className="myspace-home">
    <section className="myspace-hero" aria-labelledby="myspace-title">
      <div className="myspace-hero-copy"><span className="myspace-hero-label">My Space</span><h1 id="myspace-title">Welcome back, {displayName}.</h1><p>Your collection. In its place.</p></div>
      {!reduceMascot && <div className="myspace-hero-art" aria-hidden="true"><span className="myspace-hero-burst" /><span className="myspace-hero-plinth" /><span className="myspace-hero-nook"><Cole pose="welcome" className="myspace-cole" /></span></div>}
    </section>
    {data && error && <div className="myspace-load-error" role="alert"><span>{error}</span><button className="button button-secondary" onClick={onRetry}>Retry</button></div>}
    {!data && <div className="myspace-summary-state" role={error ? "alert" : "status"}><p>{error || (loading ? "Loading your collection room…" : "Your home summary is ready when you are.")}</p>{error && <button className="button button-secondary" onClick={onRetry}>Retry summary</button>}</div>}
    {data && <>
    <div className="myspace-primary-grid">
      <section className="home-shelf-panel" aria-labelledby="featured-shelf-title">
        <div className="home-panel-heading">
          <div className="home-panel-title"><IconBadge icon={<Armchair />} tone="teal" /><div><h2 id="featured-shelf-title">Your cabinet</h2>{featured && <p>{featured.placedCount} displayed {featured.placedCount === 1 ? "piece" : "pieces"}</p>}</div></div>
          {cabinetOptions.length > 0 && <label className="home-cabinet-select"><span className="sr-only">Choose a cabinet to preview</span><select className="select-control" value={cabinetSelectValue} onChange={(event) => onSelectCabinet(event.target.value)} disabled={loading}><option value="" disabled>Select cabinet</option>{cabinetOptions.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.name}</option>)}</select></label>}
        </div>
        {!featured ? <div className="home-shelf-empty"><p>{cabinetOptions.length ? "This cabinet is ready for its first shelf row." : "Create a cabinet to give your collection a place to live."}</p><button className="button button-primary" onClick={onCreateCabinet}><Plus />Create a cabinet</button></div> : <>
          <div className="home-cabinet-frame">
            <div className="home-shelf-scroll" tabIndex={0} aria-label={`${featured.cabinet.name}, shelf preview`}>
              {featured.rows.length ? featured.rows.map((row) => <div className="home-shelf-row" key={row.index} style={{ "--slot-count": row.slots.length } as React.CSSProperties}>
                <span className="home-shelf-row-label">{String.fromCharCode(65 + row.index)}</span>
                {row.slots.map((item, slot) => {
                  const position = `${String.fromCharCode(65 + row.index)}${slot + 1}`;
                  return item
                    ? <button className="home-shelf-slot home-shelf-slot-filled" key={position} onClick={() => onDetails(item)} aria-label={`Open ${item.name} at position ${position}`}><Photo item={item} className="home-slot-photo" /><span className="home-slot-name" title={item.name}>{item.name}</span><small>{position}</small></button>
                    : <button className="home-shelf-slot home-shelf-slot-empty" key={position} onClick={() => onOpenCabinet(featured.cabinet.id)} aria-label={`Empty position ${position}; open this cabinet`}><span className="home-slot-position">{position}</span><Plus /><span>Place an item</span></button>;
                })}
              </div>) : <div className="home-shelf-empty"><p>This cabinet has no rows yet.</p><button className="button button-secondary" onClick={() => onOpenCabinet(featured.cabinet.id)}>Open cabinet</button></div>}
            </div>
          </div>
          <div className="home-shelf-footer"><span>{loading ? "Updating preview…" : featured.cabinet.rows > 2 ? `Showing 2 of ${featured.cabinet.rows} rows` : `Showing ${featured.cabinet.rows} ${featured.cabinet.rows === 1 ? "row" : "rows"}`}</span><button className="button button-primary" onClick={() => onOpenCabinet(featured.cabinet.id)}>Open cabinet <ArrowRight /></button></div>
        </>}
      </section>
      <section className="home-recent-panel" aria-labelledby="recently-added-title">
        <div className="home-panel-heading"><div className="home-panel-title"><IconBadge icon={<Clock3 />} tone="orange" /><h2 id="recently-added-title">Recently added</h2></div></div>
        {recent.length ? <div className="home-recent-list">{recent.map((item) => <button className="home-recent-row" key={item.id} onClick={() => onDetails(item)}><Photo item={item} className="home-recent-photo" /><span className="home-recent-copy"><strong title={item.name}>{item.name}</strong><small>{item.category} · {shelfLocation(item, cabinets)}</small></span><ArrowRight className="home-recent-arrow" size={17} /></button>)}</div> : <div className="home-recent-empty"><p>Your newest pieces will appear here.</p><button className="button button-secondary" onClick={onAdd}><Plus />Add a collectible</button></div>}
        <div className="home-recent-footer"><button className="button button-secondary" onClick={onBrowseLibrary}>View library <ArrowRight /></button></div>
      </section>
    </div>
    <section className="home-collections" aria-labelledby="home-collections-title">
      <div className="home-panel-heading"><div className="home-panel-title"><IconBadge icon={<Boxes />} tone="amber" /><h2 id="home-collections-title">Your collections</h2></div>{data?.collections.length ? <button className="button button-quiet" onClick={onBrowseLibrary}>Browse library <ArrowRight /></button> : null}</div>
      {data?.collections.length ? <div className="home-collection-list">{data.collections.map(({ collection, itemCount, items }, index) => <button className={`home-collection-row home-collection-${["orange", "teal", "amber"][index % 3]}`} key={collection.id} onClick={() => onOpenCollection(collection.id)}><span className="home-collection-copy"><strong title={collection.name}>{collection.name}</strong><small>{itemCount} {itemCount === 1 ? "item" : "items"}</small></span><span className="home-collection-photos">{items.length ? items.map((item) => <Photo key={item.id} item={item} className="home-collection-photo" />) : <span className="home-collection-empty-icon"><PackagePlus /></span>}</span><ArrowRight className="home-recent-arrow" size={17} /></button>)}</div> : <div className="home-collections-empty"><p>Your named collections will have a place here.</p><button className="button button-secondary" onClick={onCreateCollection}><Plus />Create a collection</button></div>}
    </section>
    </>}
  </div>;
}

function ShelvesView({ cabinets, items, selectedCabinet, unplaced, busy, onSelectCabinet, onAddCabinet, onAddRow, onChangeSlots, onRemoveRow, onDeleteCabinet, onMove, onDetails }: { cabinets: Cabinet[]; items: Collectible[]; selectedCabinet: string; unplaced: Collectible[]; busy: boolean; onSelectCabinet: (id: string) => void; onAddCabinet: () => void; onAddRow: (cabinet: Cabinet) => void; onChangeSlots: (cabinet: Cabinet,delta: number) => void; onRemoveRow: (cabinet: Cabinet,row: number) => void; onDeleteCabinet: (cabinet: Cabinet) => void; onMove: (item: Collectible,cabinetId: string|null,row: number|null,slot: number|null) => void; onDetails: (item: Collectible) => void }) {
  const [draggedId, setDraggedId] = useState("");
  const cabinet = cabinets.find((entry) => entry.id === selectedCabinet) ?? cabinets[0];
  return <><div className="page-heading"><div><h1>My Shelves</h1><p>Keep the real places behind your collection easy to remember.</p></div><div className="heading-actions"><button className="button button-primary" onClick={onAddCabinet}><Plus />Add cabinet</button></div></div>
    <div className="subnav-pills" aria-label="Cabinets">{cabinets.map((entry) => <button key={entry.id} className={`filter-pill${cabinet?.id === entry.id ? " active" : ""}`} onClick={() => onSelectCabinet(entry.id)}>{entry.name}</button>)}</div>
    {!cabinet ? <div className="empty-state"><Cole pose="point" /><div className="empty-icon"><Armchair /></div><h2>Your first cabinet</h2><p>Create a cabinet and choose how many rows and spots it needs.</p><button className="button button-primary" onClick={onAddCabinet}><Plus />Add cabinet</button></div> : <>
      <section className="cabinet-full"><div className="cabinet-full-head"><span className="cabinet-card-icon"><Armchair /></span><h2>{cabinet.name}</h2><span className="save-state">{busy ? <><Clock3 />Saving…</> : <><Check />All changes saved</>}</span></div>
        <div className="cabinet-grid">{Array.from({ length: cabinet.rows },(_,row) => <div className="shelf-row-view" key={row} style={{ "--slots": cabinet.slotsPerRow } as React.CSSProperties} onDragOver={(event) => event.preventDefault()}>
          <p className="shelf-row-label">Row {String.fromCharCode(65+row)}</p>
          {Array.from({ length: cabinet.slotsPerRow },(_,slot) => { const item = items.find((entry) => entry.placement?.cabinetId === cabinet.id && entry.placement.row === row && entry.placement.slot === slot); return <div key={slot} className={`shelf-slot${draggedId ? " drop-target" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const moved = items.find((entry) => entry.id === (event.dataTransfer.getData("text/plain") || draggedId)); if (moved) onMove(moved,cabinet.id,row,slot); setDraggedId(""); }}><span className="slot-code">{String.fromCharCode(65+row)}{slot+1}</span>{item ? <div className="slot-card" draggable onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.setData("text/plain",item.id); event.dataTransfer.effectAllowed="move"; }} onDragEnd={() => setDraggedId("")}><button className={`card-image${item.imageUrl ? " custom-photo" : ""}`} style={item.imageUrl ? { backgroundImage: `url("${item.imageUrl}")` } : { backgroundPosition: photoPositions[item.imageIndex % photoPositions.length] }} aria-label={`Open ${item.name}`} onClick={() => onDetails(item)} /><span className="slot-item-name" title={item.name}>{item.name}</span><select className="select-control slot-move-select" aria-label={`Move ${item.name} to a different spot`} value={`${cabinet.id}:${row}:${slot}`} onChange={(event) => { const [targetCabinet,targetRow,targetSlot] = event.target.value.split(":"); if (targetCabinet === "unplaced") onMove(item,null,null,null); else onMove(item,targetCabinet,Number(targetRow),Number(targetSlot)); }}><option value={`${cabinet.id}:${row}:${slot}`}>Move to…</option><option value="unplaced">Unplaced items</option>{cabinets.flatMap((entry) => Array.from({ length: entry.rows },(_,r) => Array.from({ length: entry.slotsPerRow },(_,s) => <option key={`${entry.id}:${r}:${s}`} value={`${entry.id}:${r}:${s}`}>{entry.name} · {String.fromCharCode(65+r)}{s+1}{items.some((other) => other.id !== item.id && other.placement?.cabinetId === entry.id && other.placement.row === r && other.placement.slot === s) ? " (occupied)" : ""}</option>)))}</select></div> : <button className="slot-add" aria-label={`Place an item in ${String.fromCharCode(65+row)}${slot+1}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const moved = items.find((entry) => entry.id === (event.dataTransfer.getData("text/plain") || draggedId)); if (moved) onMove(moved,cabinet.id,row,slot); setDraggedId(""); }} onClick={() => { if (unplaced[0]) onMove(unplaced[0],cabinet.id,row,slot); }}><Plus /></button>}</div>; })}
          {cabinet.rows > 1 && <button className="button button-quiet row-delete" onClick={() => onRemoveRow(cabinet,row)}><Trash2 size={12} />Remove row</button>}
        </div>)}</div>
        <div className="cabinet-actions"><button className="button button-secondary button-quiet" disabled={cabinet.rows >= 12} onClick={() => onAddRow(cabinet)}><Plus />Add a row</button><button className="button button-secondary button-quiet" disabled={cabinet.slotsPerRow >= 12} onClick={() => onChangeSlots(cabinet,1)}><Plus />Add a position</button><button className="button button-secondary button-quiet" disabled={cabinet.slotsPerRow <= 1} onClick={() => onChangeSlots(cabinet,-1)}><Trash2 />Remove a position</button><button className="button button-secondary button-quiet" onClick={() => onDeleteCabinet(cabinet)}><Trash2 />Delete cabinet</button></div>
      </section>
      </>}
    <section className="tray-panel"><div className="tray-heading"><PackagePlus /><h2>Unplaced items</h2><span className="count-pill">{unplaced.length}</span><span className="muted">Drag one to an empty shelf spot, or pick its Move to menu.</span></div>{unplaced.length ? <div className="tray-grid">{unplaced.map((item) => <button className="tray-item" key={item.id} draggable onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.setData("text/plain",item.id); event.dataTransfer.effectAllowed="move"; }} onDragEnd={() => setDraggedId("")} onClick={() => onDetails(item)}><Photo item={item} /><strong>{item.name}</strong><span className="category-tag">{item.category}</span></button>)}</div> : <p className="quiet-empty">Everything has a shelf spot for now.</p>}</section>
  </>;
}

function SettingsView({ reduceMascot, onReduceMascot, displayName, onName, demo, onSave }: { reduceMascot: boolean; onReduceMascot: (value: boolean) => void; displayName: string; onName: (value: string) => void; demo: boolean; onSave: () => void }) {
  return <><div className="page-heading"><div><h1>Settings</h1><p>Small choices that make your collection space feel like yours.</p></div><div className="heading-actions"><button className="button button-primary" onClick={onSave}><Check />Save settings</button></div></div><div className="settings-layout"><section className="settings-card"><h2>Your profile</h2><label className="form-field">Display name<input value={displayName} onChange={(event) => onName(event.target.value)} maxLength={80} /></label><h2 className="settings-subheading">Experience</h2><p>Cole is a friendly helper in onboarding, useful empty states, and small celebrations. You can quiet the mascot when you want a calmer view.</p><label className="settings-row"><span>Reduce mascot appearances</span><input type="checkbox" checked={reduceMascot} onChange={(event) => onReduceMascot(event.target.checked)} /><span className="sr-only">Reduce Cole appearances</span></label><p>Motion follows your device’s reduced-motion preference.</p></section><section className="settings-card"><h2>Collection privacy</h2><p>{demo ? "This preview stores your changes in this browser only. To create a private account, configure Supabase Auth and storage using the project README." : "Your inventory and photos are private to your account. They do not become public collection pages."}</p><div className="settings-row"><span>{demo ? "Preview mode" : "Account access"}</span><span className="location-tag">{demo ? "This browser" : "Private"}</span></div></section></div></>;
}

function AddDialog({ collections, item, onClose, onSubmit, busy, error }: { collections: AppData["collections"]; item?: Collectible; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string }) {
  const [category, setCategory] = useState<Category>(item?.category ?? "Funko Pop");
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="add-title"><div className="dialog-head"><div><h2 id="add-title">{item ? "Edit collectible" : "Add collectible"}</h2><p>{item ? "Update its details, collection, and shelf notes." : "Start with a name and type. The rest can wait."}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X /></button></div><form onSubmit={onSubmit}>
    {item && <><input type="hidden" name="itemId" value={item.id} />{item.collectionIds.map((id) => <input type="hidden" name="originalCollectionIds" value={id} key={id} />)}</>}
    <div className="form-grid"><label className="form-field full">Name<input name="name" required autoFocus maxLength={120} defaultValue={item?.name} placeholder="What are you adding?" /></label><label className="form-field">Category<select name="category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label><label className="form-field">Condition<select name="condition" defaultValue={item?.condition ?? "Not set"}><option>Not set</option><option>Like new</option><option>Very good</option><option>Good</option><option>Fair</option><option>Needs repair</option></select></label>
    <label className="form-field">Brand<input name="brand" maxLength={100} defaultValue={item?.brand} placeholder="Maker or publisher" /></label><label className="form-field">Franchise<input name="franchise" maxLength={100} defaultValue={item?.franchise} placeholder="Series or universe" /></label>
    {category === "Funko Pop" && <><label className="form-field">Pop number<input name="detail-popNumber" maxLength={32} defaultValue={String(item?.details.popNumber ?? "")} placeholder="Optional" /></label><label className="form-field">Edition<input name="detail-edition" maxLength={60} defaultValue={String(item?.details.edition ?? "")} placeholder="Standard, exclusive…" /></label></>}
    {category === "Action Figure" && <><label className="form-field">Figure line<input name="detail-figureLine" maxLength={60} defaultValue={String(item?.details.figureLine ?? "")} placeholder="Optional" /></label><label className="form-field">Scale<input name="detail-scale" maxLength={30} defaultValue={String(item?.details.scale ?? "")} placeholder="1:12, 6 inch…" /></label></>}
    {category === "Card" && <><label className="form-field">Card game<input name="detail-cardGame" maxLength={60} defaultValue={String(item?.details.cardGame ?? "")} placeholder="Optional" /></label><label className="form-field">Set<input name="detail-setName" maxLength={80} defaultValue={String(item?.details.setName ?? "")} placeholder="Set name" /></label><label className="form-field">Card number<input name="detail-cardNumber" maxLength={32} defaultValue={String(item?.details.cardNumber ?? "")} placeholder="Set number" /></label><label className="form-field">Graded?<select name="detail-graded" defaultValue={String(item?.details.graded ?? false)}><option value="false">No</option><option value="true">Yes</option></select></label></>}
    <label className="form-field">Acquired on<input name="acquiredAt" type="date" defaultValue={item?.acquiredAt} /></label><label className="form-field">Tags<input name="tags" maxLength={400} defaultValue={item?.tags.join(", ")} placeholder="space, signed, display" /></label>
    <label className="form-field full">Collections<div className="check-collection-list">{collections.map((collection) => <label className="check-collection" key={collection.id}><input type="checkbox" name="collectionIds" value={collection.id} defaultChecked={item?.collectionIds.includes(collection.id)} />{collection.name}</label>)}</div></label>
    {!item && <label className="form-field full">Photos<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { if (event.currentTarget.files && event.currentTarget.files.length > MAX_ITEM_PHOTOS) event.currentTarget.setCustomValidity("Choose up to five photos."); else event.currentTarget.setCustomValidity(""); }} /><span className="form-hint">JPG, PNG, or WebP · up to 5 photos · 10 MB each. The first is the cover.</span></label>}
    <label className="form-field full">Notes<textarea name="notes" maxLength={2000} defaultValue={item?.notes} placeholder="The small story that makes this piece yours…" /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{item ? <Check /> : <Plus />}{busy ? "Saving…" : item ? "Save changes" : "Add to my library"}</button></div>
  </form></section></div>;
}

function NewCollectionDialog({ value, onChange, onClose, onSubmit, error }: { value: string; onChange: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string }) {
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog cabinet-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-title"><div className="dialog-head"><div><h2 id="collection-title">Create a collection</h2><p>Give a group of pieces a name of its own.</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X /></button></div><form onSubmit={onSubmit}><label className="form-field">Collection name<input value={value} onChange={(event) => onChange(event.target.value)} required maxLength={80} autoFocus placeholder="Miniature worlds" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary"><Plus />Create collection</button></div></form></section></div>;
}

function NewCabinetDialog({ onClose, onSubmit, error }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string }) {
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog cabinet-dialog" role="dialog" aria-modal="true" aria-labelledby="cabinet-title"><div className="dialog-head"><div><h2 id="cabinet-title">Add a cabinet</h2><p>Give the display a name you’ll recognize.</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X /></button></div><form onSubmit={onSubmit}><label className="form-field">Cabinet name<input name="cabinetName" required maxLength={80} autoFocus placeholder="Living room display" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary"><Plus />Create cabinet</button></div></form></section></div>;
}

function DetailDrawer({ item, collections, cabinets, onClose, onFavorite, onDelete, onMove, onEdit, onDuplicate }: { item: Collectible; collections: AppData["collections"]; cabinets: Cabinet[]; onClose: () => void; onFavorite: (item: Collectible) => void; onDelete: (item: Collectible) => void; onMove: (item: Collectible,cabinetId: string|null,row: number|null,slot: number|null) => void; onEdit: () => void; onDuplicate: () => void }) {
  return <><button className="drawer-scrim" aria-label="Close item details" onClick={onClose} /><aside className="detail-drawer" aria-labelledby="detail-title"><div className="drawer-head"><h2 id="detail-title">{item.name}</h2><button className="icon-button" aria-label="Close item details" onClick={onClose}><X /></button></div><Photo item={item} className="detail-photo" /><span className="category-tag">{item.category}</span><button className={`fav-button${item.favorite ? " is-fav" : ""}`} aria-pressed={item.favorite} onClick={() => onFavorite(item)}><Heart /> {item.favorite ? "Favorite" : "Add to favorites"}</button><dl className="detail-list"><DetailRow label="Brand" value={item.brand} /><DetailRow label="Franchise" value={item.franchise} /><DetailRow label="Condition" value={item.condition} /><DetailRow label="Acquired" value={item.acquiredAt} /><DetailRow label="Collections" value={collections.filter((collection) => item.collectionIds.includes(collection.id)).map((collection) => collection.name).join(", ")} /><DetailRow label="Shelf spot" value={shelfLocation(item,cabinets)} /></dl>{item.tags.length > 0 && <div className="detail-row"><span>Tags</span><span>{item.tags.join(", ")}</span></div>}{item.notes && <p className="detail-note">{item.notes}</p>}
    <label className="form-field drawer-move">Move to shelf<select className="select-control" value={item.placement ? `${item.placement.cabinetId}:${item.placement.row}:${item.placement.slot}` : "unplaced"} onChange={(event) => { const value = event.target.value; if (value === "unplaced") onMove(item,null,null,null); else { const [cabinetId,row,slot] = value.split(":"); onMove(item,cabinetId,Number(row),Number(slot)); } }}><option value="unplaced">Unplaced items</option>{cabinets.flatMap((cabinet) => Array.from({ length:cabinet.rows },(_,row) => Array.from({ length:cabinet.slotsPerRow },(_,slot) => <option key={`${cabinet.id}:${row}:${slot}`} value={`${cabinet.id}:${row}:${slot}`}>{cabinet.name} · {String.fromCharCode(65+row)}{slot+1}</option>)))}</select></label>
    <div className="drawer-actions"><button className="button button-secondary" onClick={onDuplicate}><PanelsTopLeft />Duplicate</button><button className="button button-secondary" onClick={onEdit}>Edit details</button><button className="button button-warn" onClick={() => onDelete(item)}><Trash2 />Delete item</button></div></aside></>;
}
function DetailRow({ label, value }: { label: string; value: string }) { return value ? <div className="detail-row"><dt>{label}</dt><dd>{value}</dd></div> : null; }
