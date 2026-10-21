import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  filterActive,
  type ExpenseCategory,
  type ExpenseRecord,
  type FuelRecord,
  type Store,
  type User,
  type Vehicle,
  type WashProduct,
  type WashRecord,
  type WashType,
} from "../shared/carData";
import { restoreExpenseRecordInStore, softDeleteExpenseRecordInStore } from "../domain/expense/expenseService";
import { restoreFuelRecordInStore, softDeleteFuelRecordInStore } from "../domain/fuel/fuelService";
import { restoreVehicleInStore, softDeleteVehicleInStore } from "../domain/vehicle/vehicleService";
import { restoreWashProductInStore, softDeleteWashProductInStore } from "../domain/wash/washProductService";
import { restoreWashRecordInStore, softDeleteWashRecordInStore } from "../domain/wash/washService";
import { useToast } from "../ui/Toast";
import type { Page } from "./router";
import type { Session } from "./session";
import type { ThemePreference } from "./theme";

export type EditorRequest =
  | { kind: "quick" }
  | { kind: "fuel"; recordId?: string }
  | { kind: "wash"; recordId?: string; washType?: WashType }
  | { kind: "expense"; recordId?: string; category?: ExpenseCategory; renewFromId?: string }
  | { kind: "vehicle"; vehicleId?: string }
  | { kind: "product"; productId?: string; mode?: "add" | "edit" | "replenish" };

export type RemovableKind = "fuel" | "wash" | "expense" | "vehicle" | "product";

type Mutation = (store: Store, user: User) => Store | null | undefined;

export type WorkspaceValue = {
  session: Session;
  store: Store;
  user: User;
  /** Active, non-archived vehicles plus the selected one if it is archived. */
  vehicles: Vehicle[];
  allVehicles: Vehicle[];
  vehicle?: Vehicle;
  selectVehicle: (vehicleId: string) => void;
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
  expenseRecords: ExpenseRecord[];
  allFuelRecords: FuelRecord[];
  washProducts: WashProduct[];
  mutate: (mutation: Mutation, message?: string) => boolean;
  remove: (kind: RemovableKind, id: string, label: string) => void;
  restore: (kind: RemovableKind, id: string) => void;
  editor: EditorRequest | null;
  openEditor: (request: EditorRequest) => void;
  closeEditor: () => void;
  navigate: (page: Page, sub?: string, params?: Record<string, string | undefined>) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

const removers = {
  fuel: softDeleteFuelRecordInStore,
  wash: softDeleteWashRecordInStore,
  expense: softDeleteExpenseRecordInStore,
  vehicle: softDeleteVehicleInStore,
  product: softDeleteWashProductInStore,
} satisfies Record<RemovableKind, (store: Store, user: User, id: string) => Store | null>;

const restorers = {
  fuel: restoreFuelRecordInStore,
  wash: restoreWashRecordInStore,
  expense: restoreExpenseRecordInStore,
  vehicle: restoreVehicleInStore,
  product: restoreWashProductInStore,
} satisfies Record<RemovableKind, (store: Store, user: User, id: string) => Store | null>;

function vehicleStorageKey(userId: string) {
  return `car-utils-active-vehicle:${userId}`;
}

export function WorkspaceProvider({
  session,
  navigate,
  theme,
  setTheme,
  children,
}: {
  session: Session;
  navigate: WorkspaceValue["navigate"];
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  children: ReactNode;
}) {
  const toast = useToast();
  const { store, storeRef, commit } = session;
  const user = store.users.find((item) => item.id === store.currentUserId) ?? store.users[0];
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => {
    try {
      return user ? localStorage.getItem(vehicleStorageKey(user.id)) ?? "" : "";
    } catch {
      return "";
    }
  });
  const [editor, setEditor] = useState<EditorRequest | null>(null);

  const allVehicles = useMemo(
    () => filterActive(store.vehicles).filter((item) => item.userId === user?.id),
    [store.vehicles, user?.id],
  );
  const activeVehicles = useMemo(() => allVehicles.filter((item) => !item.isArchived), [allVehicles]);
  const vehicle =
    allVehicles.find((item) => item.id === selectedVehicleId) ??
    allVehicles.find((item) => item.id === user?.settings?.defaultVehicleId && !item.isArchived) ??
    activeVehicles[0] ??
    allVehicles[0];
  const vehicles = vehicle?.isArchived ? [vehicle, ...activeVehicles] : activeVehicles;

  const selectVehicle = useCallback(
    (vehicleId: string) => {
      setSelectedVehicleId(vehicleId);
      if (!user) return;
      try {
        localStorage.setItem(vehicleStorageKey(user.id), vehicleId);
      } catch {
        // Selection persistence is optional.
      }
    },
    [user],
  );

  const vehicleId = vehicle?.id;
  const byDateDesc = <T extends { date: string; createdAt?: number }>(a: T, b: T) =>
    b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0);

  const allFuelRecords = useMemo(
    () => store.fuelRecords.filter((record) => record.userId === user?.id),
    [store.fuelRecords, user?.id],
  );
  // Vehicle-scoped lists include soft-deleted entries; pages filter them as needed (e.g. recycle bin).
  const fuelRecords = useMemo(
    () => allFuelRecords.filter((record) => record.vehicleId === vehicleId).sort(byDateDesc),
    [allFuelRecords, vehicleId],
  );
  const washRecords = useMemo(
    () => store.washRecords.filter((record) => record.userId === user?.id && record.vehicleId === vehicleId).sort(byDateDesc),
    [store.washRecords, user?.id, vehicleId],
  );
  const expenseRecords = useMemo(
    () => store.expenseRecords.filter((record) => record.userId === user?.id && record.vehicleId === vehicleId).sort(byDateDesc),
    [store.expenseRecords, user?.id, vehicleId],
  );
  const washProducts = useMemo(
    () => store.washProducts.filter((product) => product.userId === user?.id).sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    [store.washProducts, user?.id],
  );

  const mutate = useCallback(
    (mutation: Mutation, message?: string) => {
      const current = storeRef.current;
      const currentUser = current.users.find((item) => item.id === current.currentUserId) ?? current.users[0];
      if (!currentUser) return false;
      const next = mutation(current, currentUser);
      if (!next) return false;
      commit(next);
      if (message) toast(message);
      return true;
    },
    [commit, storeRef, toast],
  );

  const restore = useCallback(
    (kind: RemovableKind, id: string) => {
      mutate((current, currentUser) => restorers[kind](current, currentUser, id), "已恢复");
    },
    [mutate],
  );

  const remove = useCallback(
    (kind: RemovableKind, id: string, label: string) => {
      const removed = mutate((current, currentUser) => removers[kind](current, currentUser, id));
      if (!removed) return;
      toast({
        message: `已删除「${label}」`,
        tone: "info",
        action: { label: "撤销", onClick: () => mutate((current, currentUser) => restorers[kind](current, currentUser, id)) },
      });
    },
    [mutate, toast],
  );

  // Keyboard shortcuts: N = quick add, F / W / E = specific editors.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (typing || event.metaKey || event.ctrlKey || event.altKey || editor || !vehicle) return;
      const map: Record<string, EditorRequest> = {
        n: { kind: "quick" },
        f: { kind: "fuel" },
        w: { kind: "wash" },
        e: { kind: "expense" },
      };
      const request = map[event.key.toLowerCase()];
      if (request) {
        event.preventDefault();
        setEditor(request);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, vehicle]);

  if (!user) return null;

  const value: WorkspaceValue = {
    session,
    store,
    user,
    vehicles,
    allVehicles,
    vehicle,
    selectVehicle,
    fuelRecords,
    washRecords,
    expenseRecords,
    allFuelRecords,
    washProducts,
    mutate,
    remove,
    restore,
    editor,
    openEditor: setEditor,
    closeEditor: () => setEditor(null),
    navigate,
    theme,
    setTheme,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
