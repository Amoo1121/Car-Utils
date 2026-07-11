import type { WashProduct, WashRecord } from "../store/types";
import { isDeleted } from "../store/utils";
import { convertWashAmount } from "../wash/washService";

export type WashOverviewStats = {
  washCost: number;
  recordCount: number;
  averageCost: number;
};

export type WashProductInventoryStats = {
  hasCapacity: boolean;
  unit: string;
  purchased: number;
  used: number;
  remaining: number;
};

export function calculateWashOverview(washRecords: WashRecord[]): WashOverviewStats {
  const activeRecords = washRecords.filter((record) => !isDeleted(record));
  const washCost = activeRecords.reduce((sum, record) => sum + record.cost, 0);
  return {
    washCost,
    recordCount: activeRecords.length,
    averageCost: activeRecords.length > 0 ? washCost / activeRecords.length : 0,
  };
}

export function calculateWashProductInventory(
  product: WashProduct,
  washRecords: WashRecord[],
): WashProductInventoryStats {
  const firstCapacityPurchase = product.purchases.find((purchase) => purchase.capacity != null && purchase.capacity > 0);
  const unit = firstCapacityPurchase?.capacityUnit ?? "ml";
  const purchased = product.purchases.reduce(
    (sum, purchase) => sum + convertWashAmount(purchase.capacity ?? 0, purchase.capacityUnit ?? unit),
    0,
  );
  const used = washRecords
    .filter((record) => !isDeleted(record))
    .reduce((sum, record) => {
      const recordUsed = (record.products ?? [])
        .filter((usage) => usage.productId === product.id)
        .reduce((usageSum, usage) => usageSum + convertWashAmount(usage.usedAmount ?? 0, usage.usedUnit), 0);
      return sum + recordUsed;
    }, 0);
  const remainingBase = Math.max(purchased - used, 0);
  const displayUnit = unit === "L" || unit === "kg" ? unit : unit;
  const divisor = unit === "L" || unit === "kg" ? 1000 : 1;

  return {
    hasCapacity: purchased > 0,
    unit: displayUnit,
    purchased: purchased / divisor,
    used: used / divisor,
    remaining: remainingBase / divisor,
  };
}
