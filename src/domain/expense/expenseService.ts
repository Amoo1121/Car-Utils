import type { ExpenseCategory, ExpenseRecord, PaymentMethod, Store, User } from "../store/types";
import {
  makeFallbackId,
  restoreEntity,
  softDeleteEntity,
  today,
  withCreatedTimestamps,
  withUpdatedTimestamp,
} from "../store/utils";

export type ExpenseRecordInput = Omit<ExpenseRecord, "id" | "userId">;

export type ExpenseCategoryMeta = {
  id: ExpenseCategory;
  label: string;
  /** Whether this category usually repeats (shows due-date fields by default). */
  recurring: boolean;
  /** Suggested interval used to prefill the next due date / odometer. */
  suggestedMonths?: number;
  suggestedKm?: number;
};

export const expenseCategories: ExpenseCategoryMeta[] = [
  { id: "maintenance", label: "保养", recurring: true, suggestedMonths: 12, suggestedKm: 10000 },
  { id: "insurance", label: "保险", recurring: true, suggestedMonths: 12 },
  { id: "inspection", label: "年检", recurring: true, suggestedMonths: 24 },
  { id: "repair", label: "维修", recurring: false },
  { id: "tire", label: "轮胎", recurring: true, suggestedKm: 50000 },
  { id: "battery", label: "电瓶", recurring: true, suggestedMonths: 36 },
  { id: "wiper", label: "雨刮", recurring: true, suggestedMonths: 12 },
  { id: "washer_fluid", label: "玻璃水", recurring: false },
  { id: "parking", label: "停车", recurring: false },
  { id: "etc", label: "通行费", recurring: false },
  { id: "ticket", label: "违章罚款", recurring: false },
  { id: "accessory", label: "改装配件", recurring: false },
  { id: "other", label: "其他", recurring: false },
];

export const paymentMethods: { id: PaymentMethod; label: string }[] = [
  { id: "wechat", label: "微信" },
  { id: "alipay", label: "支付宝" },
  { id: "credit_card", label: "信用卡" },
  { id: "cash", label: "现金" },
  { id: "fuel_card", label: "油卡" },
  { id: "other", label: "其他" },
];

export function expenseCategoryMeta(category: ExpenseCategory | undefined) {
  return expenseCategories.find((item) => item.id === category) ?? expenseCategories.at(-1)!;
}

export type ExpenseDraft = {
  date: string;
  category: ExpenseCategory;
  title: string;
  amount: string;
  odometer: string;
  vendor: string;
  paymentMethod: PaymentMethod | "";
  nextDueDate: string;
  nextDueOdometer: string;
  note: string;
};

export function createEmptyExpenseDraft(category: ExpenseCategory = "maintenance"): ExpenseDraft {
  return {
    date: today(),
    category,
    title: "",
    amount: "",
    odometer: "",
    vendor: "",
    paymentMethod: "",
    nextDueDate: "",
    nextDueOdometer: "",
    note: "",
  };
}

export function createExpenseDraft(record: ExpenseRecord): ExpenseDraft {
  return {
    date: record.date,
    category: record.category,
    title: record.title === expenseCategoryMeta(record.category).label ? "" : record.title,
    amount: String(record.amount),
    odometer: record.odometer != null && record.odometer > 0 ? String(record.odometer) : "",
    vendor: record.vendor ?? "",
    paymentMethod: record.paymentMethod ?? "",
    nextDueDate: record.nextDueDate ?? "",
    nextDueOdometer: record.nextDueOdometer != null ? String(record.nextDueOdometer) : "",
    note: record.note ?? "",
  };
}

export function validateExpenseDraft(draft: ExpenseDraft) {
  const errors: Partial<Record<keyof ExpenseDraft, string>> = {};
  const amount = Number(draft.amount);
  if (!draft.amount.trim() || !Number.isFinite(amount) || amount < 0) errors.amount = "请输入金额";
  if (!draft.date) errors.date = "请选择日期";
  if (draft.nextDueDate && draft.nextDueDate < draft.date) errors.nextDueDate = "下次日期不能早于本次";
  if (draft.nextDueOdometer && draft.odometer && Number(draft.nextDueOdometer) <= Number(draft.odometer)) {
    errors.nextDueOdometer = "下次里程应大于本次里程";
  }
  return errors;
}

export function buildExpenseRecord(vehicleId: string, draft: ExpenseDraft): ExpenseRecordInput {
  const meta = expenseCategoryMeta(draft.category);
  return {
    type: "expense",
    vehicleId,
    date: draft.date,
    category: draft.category,
    title: draft.title.trim() || meta.label,
    amount: Number(draft.amount),
    odometer: draft.odometer ? Number(draft.odometer) : undefined,
    vendor: draft.vendor.trim() || undefined,
    paymentMethod: draft.paymentMethod || undefined,
    nextDueDate: draft.nextDueDate || undefined,
    nextDueOdometer: draft.nextDueOdometer ? Number(draft.nextDueOdometer) : undefined,
    note: draft.note.trim() || undefined,
  };
}

type MutationOptions = { id?: string; timestamp?: number };

export function addExpenseRecordToStore(
  store: Store,
  currentUser: User | undefined,
  record: ExpenseRecordInput,
  options: MutationOptions = {},
) {
  if (!currentUser) return null;
  return {
    ...store,
    expenseRecords: [
      ...store.expenseRecords,
      withCreatedTimestamps({ ...record, id: options.id ?? makeFallbackId("expense"), userId: currentUser.id }, options.timestamp),
    ],
  };
}

export function updateExpenseRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  record: ExpenseRecordInput,
  options: MutationOptions = {},
) {
  if (!currentUser) return null;
  return {
    ...store,
    expenseRecords: store.expenseRecords.map((current) =>
      current.id === recordId && current.userId === currentUser.id
        ? withUpdatedTimestamp(
            { ...record, id: current.id, userId: current.userId, createdAt: current.createdAt, deletedAt: current.deletedAt },
            options.timestamp,
          )
        : current,
    ),
  };
}

export function softDeleteExpenseRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  options: MutationOptions = {},
) {
  if (!currentUser) return null;
  return {
    ...store,
    expenseRecords: store.expenseRecords.map((record) =>
      record.id === recordId && record.userId === currentUser.id ? softDeleteEntity(record, options.timestamp) : record,
    ),
  };
}

export function restoreExpenseRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  options: MutationOptions = {},
) {
  if (!currentUser) return null;
  return {
    ...store,
    expenseRecords: store.expenseRecords.map((record) =>
      record.id === recordId && record.userId === currentUser.id ? restoreEntity(record, options.timestamp) : record,
    ),
  };
}
