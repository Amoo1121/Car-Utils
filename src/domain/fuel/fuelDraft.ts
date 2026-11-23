import type { FuelRecordDraft } from "./fuelService";

export type FuelPricingMode = "paid" | "discount";

export function fuelDiscount(draft: FuelRecordDraft) {
  if (!draft.paidAmount.trim()) return "";
  const total = Number(draft.volume) * Number(draft.pricePerUnit);
  if (!draft.volume.trim() || !draft.pricePerUnit.trim()) return "";
  return String(Number(Math.max(0, total - Number(draft.paidAmount)).toFixed(2)));
}

/** Only the payment can be derived; measured volume and posted price stay independent. */
export function updateFuelPricing(
  draft: FuelRecordDraft,
  field: "volume" | "pricePerUnit" | "paidAmount",
  value: string,
  mode: FuelPricingMode,
  discount: string,
): FuelRecordDraft {
  const next = { ...draft, [field]: value };
  if (field !== "paidAmount" && mode === "discount") next.paidAmount = paymentAfterDiscount(next, discount);
  return next;
}

export function paymentAfterDiscount(draft: FuelRecordDraft, discount: string) {
  if (!draft.volume.trim() || !draft.pricePerUnit.trim() || !discount.trim()) return "";
  const paid = Number(draft.volume) * Number(draft.pricePerUnit) - Number(discount);
  return Number.isFinite(paid) ? String(Number(paid.toFixed(2))) : "";
}

export function updateFuelLevelAfter(draft: FuelRecordDraft, value: string): FuelRecordDraft {
  return { ...draft, fuelLevelAfter: value, fullTank: value.trim() !== "" && Number(value) === 100 };
}

export function updateFuelFullTank(draft: FuelRecordDraft, fullTank: boolean): FuelRecordDraft {
  return {
    ...draft,
    fullTank,
    fuelLevelAfter: fullTank ? "100" : Number(draft.fuelLevelAfter) === 100 ? "" : draft.fuelLevelAfter,
  };
}
