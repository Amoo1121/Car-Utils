import type { Store, User, WashProduct, WashProductPurchase } from "../store/types";
import {
  makeFallbackId,
  restoreEntity,
  softDeleteEntity,
  today,
  withCreatedTimestamps,
  withUpdatedTimestamp,
} from "../store/utils";
import type { WashProductUsageDraft } from "./washService";
import type { WashProductPreset } from "./washProductCatalog";

export type WashProductInput = Omit<WashProduct, "id" | "userId">;

export type WashProductDraft = {
  presetId: string;
  name: string;
  brand: string;
  category: string;
  purchaseDate: string;
  purchasePrice: string;
  capacity: string;
  capacityUnit: WashProductPurchase["capacityUnit"];
  note: string;
};

export type WashProductFormMode = {
  mode: "add" | "edit" | "replenish";
  productId: string;
};

export type WashProductSubmission =
  | { type: "add"; product: WashProductInput }
  | { type: "update"; productId: string; product: WashProductInput }
  | { type: "replenish"; productId: string; purchase: WashProductPurchase }
  | null;

export type WashProductMutationOptions = {
  id?: string;
  timestamp?: number;
};

export function createEmptyWashProductWarehouseDraft(): WashProductDraft {
  return {
    presetId: "",
    name: "",
    brand: "",
    category: "预洗液",
    purchaseDate: today(),
    purchasePrice: "",
    capacity: "",
    capacityUnit: "ml",
    note: "",
  };
}

export function applyWashProductPresetToDraft(draft: WashProductDraft, preset: WashProductPreset): WashProductDraft {
  return {
    ...draft,
    presetId: preset.id,
    name: preset.name,
    brand: preset.brand,
    category: preset.category,
    capacity: String(preset.defaultCapacity),
    capacityUnit: preset.capacityUnit,
  };
}

export function buildWashProductPurchase(draft: WashProductDraft): WashProductPurchase {
  return {
    id: makeFallbackId("wash_purchase"),
    date: draft.purchaseDate,
    purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
    capacity: draft.capacity ? Number(draft.capacity) : undefined,
    capacityUnit: draft.capacityUnit || undefined,
    note: draft.note.trim() || undefined,
  };
}

export function hasPurchaseDetails(purchase: WashProductPurchase) {
  return (
    (purchase.purchasePrice != null && purchase.purchasePrice > 0) ||
    (purchase.capacity != null && purchase.capacity > 0) ||
    Boolean(purchase.note?.trim())
  );
}

export function createWashProductDraftFromProduct(product: WashProduct, today: string): WashProductDraft {
  const latestPurchase = product.purchases.at(-1);
  return {
    presetId: product.presetId ?? "",
    name: product.name,
    brand: product.brand ?? "",
    category: product.category,
    purchaseDate: latestPurchase?.date ?? today,
    purchasePrice: latestPurchase?.purchasePrice != null ? String(latestPurchase.purchasePrice) : "",
    capacity: latestPurchase?.capacity != null ? String(latestPurchase.capacity) : "",
    capacityUnit: latestPurchase?.capacityUnit ?? "ml",
    note: product.note ?? latestPurchase?.note ?? "",
  };
}

export function createWashProductReplenishDraftFromProduct(product: WashProduct, today: string): WashProductDraft {
  const latestPurchase = product.purchases.at(-1);
  return {
    presetId: product.presetId ?? "",
    name: product.name,
    brand: product.brand ?? "",
    category: product.category,
    purchaseDate: today,
    purchasePrice: latestPurchase?.purchasePrice != null ? String(latestPurchase.purchasePrice) : "",
    capacity: latestPurchase?.capacity != null ? String(latestPurchase.capacity) : "",
    capacityUnit: latestPurchase?.capacityUnit ?? "ml",
    note: "",
  };
}

export function buildWashProductSubmission(
  formMode: WashProductFormMode,
  draft: WashProductDraft,
  currentProduct: WashProduct | undefined,
): WashProductSubmission {
  if (!draft.name.trim()) return null;

  const purchase = buildWashProductPurchase(draft);
  if (formMode.mode === "replenish" && formMode.productId) {
    return hasPurchaseDetails(purchase) ? { type: "replenish", productId: formMode.productId, purchase } : null;
  }

  if (formMode.mode === "edit" && formMode.productId) {
    if (!currentProduct) return null;

    const purchases = [...currentProduct.purchases];
    if (hasPurchaseDetails(purchase)) {
      if (purchases.length > 0) {
        purchases[purchases.length - 1] = { ...purchases[purchases.length - 1], ...purchase };
      } else {
        purchases.push(purchase);
      }
    } else if (purchases.length > 0) {
      purchases.pop();
    }

    return {
      type: "update",
      productId: currentProduct.id,
      product: {
        type: "washProduct",
        presetId: draft.presetId || undefined,
        name: draft.name.trim(),
        brand: draft.brand.trim() || undefined,
        category: draft.category,
        purchases,
        note: draft.note.trim() || undefined,
      },
    };
  }

  return {
    type: "add",
    product: {
      type: "washProduct",
      presetId: draft.presetId || undefined,
      name: draft.name.trim(),
      brand: draft.brand.trim() || undefined,
      category: draft.category,
      purchases: hasPurchaseDetails(purchase) ? [purchase] : [],
      note: draft.note.trim() || undefined,
    },
  };
}

export function buildWashProductFromUsageDraft(product: WashProductUsageDraft, date: string): WashProductInput | null {
  if (!product.name.trim()) return null;

  const purchasePrice = Number(product.purchasePrice);
  const capacity = Number(product.capacity);
  return {
    type: "washProduct",
    name: product.name.trim(),
    category: product.category || "其他",
    purchases:
      purchasePrice > 0 && capacity > 0
        ? [
            {
              id: makeFallbackId("wash_purchase"),
              date,
              purchasePrice,
              capacity,
              capacityUnit: product.capacityUnit ?? "ml",
            },
          ]
        : [],
  };
}

export function addWashProductToStore(
  store: Store,
  currentUser: User | undefined,
  product: WashProductInput,
  options: WashProductMutationOptions = {},
) {
  if (!currentUser) return null;

  const nextProduct = withCreatedTimestamps(
    {
      ...product,
      id: options.id ?? makeFallbackId("wash_product"),
      userId: currentUser.id,
    },
    options.timestamp,
  );

  return {
    store: {
      ...store,
      washProducts: [...store.washProducts, nextProduct],
    },
    product: nextProduct,
  };
}

export function addWashProductPurchaseToStore(
  store: Store,
  currentUser: User | undefined,
  productId: string,
  purchase: WashProductPurchase,
  options: WashProductMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washProducts: store.washProducts.map((product) =>
      product.id === productId && product.userId === currentUser.id
        ? withUpdatedTimestamp({ ...product, purchases: [...product.purchases, purchase] }, options.timestamp)
        : product,
    ),
  };
}

export function updateWashProductInStore(
  store: Store,
  currentUser: User | undefined,
  productId: string,
  product: WashProductInput,
  options: WashProductMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washProducts: store.washProducts.map((currentProduct) =>
      currentProduct.id === productId && currentProduct.userId === currentUser.id
        ? withUpdatedTimestamp(
            {
              ...product,
              id: currentProduct.id,
              userId: currentProduct.userId,
              createdAt: currentProduct.createdAt,
              deletedAt: currentProduct.deletedAt,
            },
            options.timestamp,
          )
        : currentProduct,
    ),
  };
}

export function softDeleteWashProductInStore(
  store: Store,
  currentUser: User | undefined,
  productId: string,
  options: WashProductMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washProducts: store.washProducts.map((product) =>
      product.id === productId && product.userId === currentUser.id ? softDeleteEntity(product, options.timestamp) : product,
    ),
  };
}

export function restoreWashProductInStore(
  store: Store,
  currentUser: User | undefined,
  productId: string,
  options: WashProductMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    washProducts: store.washProducts.map((product) =>
      product.id === productId && product.userId === currentUser.id ? restoreEntity(product, options.timestamp) : product,
    ),
  };
}
