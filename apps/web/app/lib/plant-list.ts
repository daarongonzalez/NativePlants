/**
 * The saved plant list. Sign-in screens wait until after V1, so the list lives
 * in this browser's local storage: nothing is sent to our servers.
 *
 * The list changes through the pure functions below (tested on their own),
 * and pages read it with useSavedList(), which stays in step across tabs.
 */
import { useSyncExternalStore } from "react";
import type { PlanPlant } from "@np/shared";

export const LIST_KEY = "nativo.plantList.v1";
const CHANGE_EVENT = "nativo:plant-list";
export const MAX_QUANTITY = 999;

/** A plant as saved: enough to print and take to a nursery, even if the catalogue changes. */
export interface SavedPlant {
  id: string;
  commonName: string;
  scientificName: string;
  matureHeightCm: number;
  matureWidthCm: number;
  plantForm: PlanPlant["plantForm"];
  staysUnder24In: boolean | null;
  reviewStatus: PlanPlant["reviewStatus"];
  quantity: number;
  savedAt: string;
}

const clampQty = (n: number) => Math.max(1, Math.min(MAX_QUANTITY, Math.round(n)));

function toSaved(plant: PlanPlant, quantity: number, now: string): SavedPlant {
  return {
    id: plant.id,
    commonName: plant.commonName,
    scientificName: plant.scientificName,
    matureHeightCm: plant.matureHeightCm,
    matureWidthCm: plant.matureWidthCm,
    plantForm: plant.plantForm,
    staysUnder24In: plant.staysUnder24In,
    reviewStatus: plant.reviewStatus,
    quantity: clampQty(quantity),
    savedAt: now,
  };
}

/** Add one plant. If it is already there, the list is unchanged. */
export function addPlant(list: SavedPlant[], plant: PlanPlant, now = new Date().toISOString()): SavedPlant[] {
  if (list.some((p) => p.id === plant.id)) return list;
  return [...list, toSaved(plant, 1, now)];
}

/**
 * Save the plants from a checked plan with the counts the plan needs. A plant
 * already on the list takes the plan's count, so saving the same plan twice
 * does not double it.
 */
export function savePlanPlants(
  list: SavedPlant[],
  items: { plant: PlanPlant; count: number }[],
  now = new Date().toISOString(),
): SavedPlant[] {
  const next = list.slice();
  for (const { plant, count } of items) {
    const i = next.findIndex((p) => p.id === plant.id);
    if (i === -1) next.push(toSaved(plant, count, now));
    else next[i] = { ...next[i]!, quantity: clampQty(count) };
  }
  return next;
}

export const removePlant = (list: SavedPlant[], id: string) => list.filter((p) => p.id !== id);

export const setQuantity = (list: SavedPlant[], id: string, quantity: number) =>
  list.map((p) => (p.id === id ? { ...p, quantity: clampQty(quantity) } : p));

export const totalPlants = (list: SavedPlant[]) => list.reduce((n, p) => n + p.quantity, 0);

/** Reads what storage holds, dropping anything that is not a saved plant. Never throws. */
export function parseList(raw: string | null): SavedPlant[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (p): p is SavedPlant =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as SavedPlant).id === "string" &&
        typeof (p as SavedPlant).commonName === "string" &&
        typeof (p as SavedPlant).quantity === "number",
    );
  } catch {
    return [];
  }
}

/* ---- Browser storage ------------------------------------------------------------ */

const EMPTY: SavedPlant[] = [];
let cachedRaw: string | null = null;
let cachedList: SavedPlant[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(LIST_KEY);
  } catch {
    // Private windows and blocked storage: behave as an empty list.
    return null;
  }
}

function snapshot(): SavedPlant[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parseList(raw);
  }
  return cachedList;
}

/** Writes the list. Returns false when the browser refuses storage, so the page can say so. */
export function writeList(list: SavedPlant[]): boolean {
  try {
    if (list.length === 0) window.localStorage.removeItem(LIST_KEY);
    else window.localStorage.setItem(LIST_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** Apply a change to the stored list. */
export function updateList(change: (list: SavedPlant[]) => SavedPlant[]): boolean {
  return writeList(change(snapshot()));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === LIST_KEY || e.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The saved list, kept in step with storage and other tabs. Returns
 * `ready: false` during the server render and the first paint, so pages do not
 * flash "your list is empty" before the browser has been read.
 */
export function useSavedList(): { list: SavedPlant[]; ready: boolean } {
  const list = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return { list, ready };
}

const noopSubscribe = () => () => {};
