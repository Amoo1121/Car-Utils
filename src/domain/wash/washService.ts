import type { Store, User, WashProductUsage, WashRecord, WashType } from "../store/types";
import {
  makeFallbackId,
  restoreEntity,
  softDeleteEntity,
  today,
  withCreatedTimestamps,
  withUpdatedTimestamp,
} from "../store/utils";

export type WashRecordInput = Omit<WashRecord, "id" | "userId">;

export type WashProductUsageDraft = {
  id: string;
  productId: string;
  name: string;
  category: string;
  step: string;
  purchasePrice: string;
  capacity: string;
  capacityUnit: WashProductUsage["capacityUnit"];
  usedAmount: string;
  usedUnit: WashProductUsage["usedUnit"];
  dilutionRatio: string;
  estimatedCost: string;
  note: string;
};

export type WashRecordDraft = {
  date: string;
  odometer: string;
  washType: WashType;
  shopName: string;
  location: string;
  items: string;
  minutes: string;
  laborCost: string;
  materialCost: string;
  waterElectricityCost: string;
  locationCost: string;
  cost: string;
  effectRating: string;
  nextSuggestedDate: string;
  notes: string;
  products: WashProductUsageDraft[];
};

export type WashMutationOptions = {
  id?: string;
  timestamp?: number;
};

export function createEmptyWashDraft(washType: WashType = "diy"): WashRecordDraft {
  return {
    date: today(),
    odometer: "",
    washType,
    shopName: "",
    location: "",
    items: "预洗, 正洗, 轮毂",
    minutes: "",
    laborCost: "",
    materialCost: "",
    waterElectricityCost: "",
    locationCost: "",
    cost: "",
    effectRating: "",
    nextSuggestedDate: "",
    notes: "",
    products: washType === "diy" ? [createEmptyWashProductUsageDraft()] : [],
  };
}

export function createEmptyWashProductUsageDraft(): WashProductUsageDraft {
  return {
    id: makeFallbackId("wash_product_usage"),
    productId: "",
    name: "",
    category: "预洗液",
    step: "预洗",
    purchasePrice: "",
    capacity: "",
    capacityUnit: "ml",
    usedAmount: "",
    usedUnit: "ml",
    dilutionRatio: "",
    estimatedCost: "",
    note: "",
  };
}

export function createWashDraft(record: WashRecord): WashRecordDraft {
  return {
    date: record.date,
    odometer: record.odometer != null ? String(record.odometer) : "",
    washType: record.washType ?? "diy",
    shopName: record.shopName ?? "",
    location: record.location ?? "",
    items: record.items.join(", "),
    minutes: record.minutes ? String(record.minutes) : "",
    laborCost: record.laborCost != null ? String(record.laborCost) : "",
    materialCost: record.materialCost != null ? String(record.materialCost) : "",
    waterElectricityCost: record.waterElectricityCost != null ? String(record.waterElectricityCost) : "",
    locationCost: record.locationCost != null ? String(record.locationCost) : "",
    cost: record.cost ? String(record.cost) : "",
    effectRating: record.effectRating ? String(record.effectRating) : "",
    nextSuggestedDate: record.nextSuggestedDate ?? "",
    notes: record.notes,
    products:
      record.products && record.products.length > 0
        ? record.products.map(createWashProductUsageDraft)
        : record.washType === "diy"
          ? [createEmptyWashProductUsageDraft()]
          : [],
  };
}

export function createWashProductUsageDraft(product: WashProductUsage): WashProductUsageDraft {
  return {
    id: product.id ?? makeFallbackId("wash_product_usage"),
    productId: product.productId ?? "",
    name: product.name,
    category: product.category ?? "其他",
    step: product.step ?? "其他",
    purchasePrice: product.purchasePrice != null ? String(product.purchasePrice) : "",
    capacity: product.capacity != null ? String(product.capacity) : "",
    capacityUnit: product.capacityUnit ?? "ml",
    usedAmount: product.usedAmount != null ? String(product.usedAmount) : "",
    usedUnit: product.usedUnit ?? "ml",
    dilutionRatio: product.dilutionRatio ?? "",
    estimatedCost: product.estimatedCost != null ? String(product.estimatedCost) : product.cost != null ? String(product.cost) : "",
    note: product.note ?? "",
  };
}

export function buildWashRecord(vehicleId: string, draft: WashRecordDraft): WashRecordInput {
  const products = draft.washType === "diy" ? buildWashProductUsages(draft.products) : [];
  const estimatedProductCost = products.reduce((sum, product) => sum + (product.estimatedCost ?? product.cost ?? 0), 0);
  const materialCost = draft.materialCost ? Number(draft.materialCost) : estimatedProductCost || undefined;
  const resolvedCost = draft.cost ? Number(draft.cost) : resolveWashCost(draft);

  return {
    vehicleId,
    date: draft.date,
    odometer: draft.odometer ? Number(draft.odometer) : undefined,
    items: draft.items
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    minutes: Number(draft.minutes || 0),
    cost: resolvedCost,
    notes: draft.notes,
    washType: draft.washType,
    shopName: draft.shopName.trim() || undefined,
    location: draft.location.trim() || undefined,
    laborCost: draft.laborCost ? Number(draft.laborCost) : undefined,
    materialCost,
    waterElectricityCost: draft.waterElectricityCost ? Number(draft.waterElectricityCost) : undefined,
    locationCost: draft.locationCost ? Number(draft.locationCost) : undefined,
    products,
    effectRating: draft.effectRating ? (Number(draft.effectRating) as WashRecord["effectRating"]) : undefined,
    nextSuggestedDate: draft.nextSuggestedDate || undefined,
  };
}

export function buildWashProductUsages(products: WashProductUsageDraft[]): WashProductUsage[] {
  return products
    .filter((product) => product.name.trim())
    .map((product) => {
      const estimatedCost = product.estimatedCost ? Number(product.estimatedCost) : estimateWashProductCost(product) || undefined;
      return {
        id: product.id,
        productId: product.productId || undefined,
        name: product.name.trim(),
        category: product.category,
        step: product.step,
        purchasePrice: product.purchasePrice ? Number(product.purchasePrice) : undefined,
        capacity: product.capacity ? Number(product.capacity) : undefined,
        capacityUnit: product.capacityUnit,
        usedAmount: product.usedAmount ? Number(product.usedAmount) : undefined,
        usedUnit: product.usedUnit,
        dilutionRatio: product.dilutionRatio.trim() || undefined,
        estimatedCost,
        cost: estimatedCost,
        note: product.note.trim() || undefined,
      };
    });
}

export function resolveWashCost(draft: WashRecordDraft) {
  if (draft.cost) return Number(draft.cost);

  const productCost = draft.products.reduce((sum, product) => {
    const cost = product.estimatedCost ? Number(product.estimatedCost) : estimateWashProductCost(product);
    return sum + cost;
  }, 0);

  return (
    Number(draft.laborCost || 0) +
    Number(draft.materialCost || 0) +
    Number(draft.waterElectricityCost || 0) +
    Number(draft.locationCost || 0) +
    productCost
  );
}

export function estimateWashProductCost(product: WashProductUsageDraft) {
  const purchasePrice = Number(product.purchasePrice);
  const capacity = Number(product.capacity);
  const usedAmount = Number(product.usedAmount);
  const capacityBase = convertWashAmount(capacity, product.capacityUnit);
  const usedBase = convertWashAmount(usedAmount, product.usedUnit);

  if (purchasePrice <= 0 || capacityBase <= 0 || usedBase <= 0) return 0;
  return (purchasePrice / capacityBase) * usedBase;
}

export function convertWashAmount(amount: number, unit: WashProductUsage["capacityUnit"] | WashProductUsage["usedUnit"]) {
  if (!Number.isFinite(amount)) return 0;
  if (unit === "L" || unit === "kg") return amount * 1000;
  return amount;
}

export function addWashRecordToStore(
  store: Store,
  currentUser: User | undefined,
  record: WashRecordInput,
  options: WashMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washRecords: [
      ...store.washRecords,
      withCreatedTimestamps(
        {
          ...record,
          id: options.id ?? makeFallbackId("wash"),
          userId: currentUser.id,
        },
        options.timestamp,
      ),
    ],
  };
}

export function updateWashRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  record: WashRecordInput,
  options: WashMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washRecords: store.washRecords.map((currentRecord) =>
      currentRecord.id === recordId && currentRecord.userId === currentUser.id
        ? withUpdatedTimestamp(
            {
              ...record,
              id: currentRecord.id,
              userId: currentRecord.userId,
              createdAt: currentRecord.createdAt,
              deletedAt: currentRecord.deletedAt,
            },
            options.timestamp,
          )
        : currentRecord,
    ),
  };
}

export function softDeleteWashRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  options: WashMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washRecords: store.washRecords.map((record) =>
      record.id === recordId && record.userId === currentUser.id ? softDeleteEntity(record, options.timestamp) : record,
    ),
  };
}

export function restoreWashRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  options: WashMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washRecords: store.washRecords.map((record) =>
      record.id === recordId && record.userId === currentUser.id ? restoreEntity(record, options.timestamp) : record,
    ),
  };
}
