import {
  Car,
  Cloud,
  Database,
  Download,
  Droplets,
  Fuel,
  Info,
  Plus,
  RefreshCw,
  Sparkles,
  Smartphone,
  Upload,
  Wrench,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  DATA_SCHEMA_VERSION,
  countStoreItems,
  createStoreBackup,
  emptyStore,
  filterActive,
  filterDeleted,
  fuelGrades,
  matchesFuelDateFilter,
  matchesFuelQuery,
  mergeStores,
  normalizeStore,
  normalizeEmail,
  parseStoreBackup,
  recordCost,
  today,
  vehiclePresets,
  withCreatedTimestamps,
  withUpdatedTimestamp,
  type EnergyType,
  type FuelDateFilter,
  type FuelRecord,
  type Store,
  type StoreCounts,
  type User,
  type Vehicle,
  type WashRecord,
  type WashProductUsage,
  type WashProduct,
  type WashProductPurchase,
  type WashType,
} from "./shared/carData";
import {
  loadCloudSyncConfig,
  saveCloudSyncConfig,
  syncStoreWithCloud,
  validateCloudSyncConfig,
  type CloudSyncConfig,
} from "./shared/cloudSync";
import { storeRepository } from "./repositories/hybridStoreRepository";
import type { PersistenceStatusSnapshot } from "./repositories/storeRepository";
import {
  addVehicleToStore,
  archiveVehicleInStore,
  restoreVehicleInStore,
  softDeleteVehicleInStore,
  unarchiveVehicleInStore,
  updateVehicleInStore,
} from "./domain/vehicle/vehicleService";
import {
  addFuelRecordToStore,
  buildFuelRecord,
  createEmptyFuelDraft,
  createFuelDraft,
  resolveFuelDraftPaidAmount,
  restoreFuelRecordInStore,
  softDeleteFuelRecordInStore,
  updateFuelRecordInStore,
  type FuelRecordDraft,
} from "./domain/fuel/fuelService";
import {
  addWashRecordToStore,
  buildWashRecord,
  createEmptyWashDraft,
  createEmptyWashProductUsageDraft,
  createWashDraft,
  estimateWashProductCost,
  resolveWashCost,
  restoreWashRecordInStore,
  softDeleteWashRecordInStore,
  updateWashRecordInStore,
  type WashProductUsageDraft,
  type WashRecordDraft,
} from "./domain/wash/washService";
import {
  addWashProductPurchaseToStore,
  addWashProductToStore,
  buildWashProductFromUsageDraft,
  buildWashProductSubmission,
  createEmptyWashProductWarehouseDraft,
  createWashProductDraftFromProduct,
  createWashProductReplenishDraftFromProduct,
  restoreWashProductInStore,
  softDeleteWashProductInStore,
  updateWashProductInStore,
  type WashProductDraft,
  type WashProductFormMode,
} from "./domain/wash/washProductService";
import {
  calculateFuelInsights,
  calculateFuelOverview,
  type ChartPoint,
  type StationSummary,
} from "./domain/analytics/fuelAnalytics";
import { calculateWashOverview, calculateWashProductInventory } from "./domain/analytics/washAnalytics";
import { FuelStationField } from "./features/fuel/FuelStationField";
import { AppNavigation, appTabTitles, type AppTab } from "./app/navigation/AppNavigation";

type FuelSubTab = "analytics" | "record" | "history";
type WashSubTab = "record" | "warehouse" | "history";

function saveStore(store: Store) {
  void storeRepository.save(store);
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function PersistenceStatusBanner({ snapshot }: { snapshot: PersistenceStatusSnapshot }) {
  const content = getPersistenceStatusContent(snapshot);
  const updatedAt = new Date(snapshot.updatedAt).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <p className={`persistence-status ${content.tone}`} aria-live="polite" title={snapshot.error?.message}>
      <span>{content.label}</span>
      <small>{updatedAt}</small>
    </p>
  );
}

function getPersistenceStatusContent(snapshot: PersistenceStatusSnapshot) {
  switch (snapshot.status) {
    case "backend_connected":
      return { tone: "ok", label: "SQLite 已连接" };
    case "backend_empty_importing_legacy":
      return { tone: "warning", label: "本地后端为空，正在导入浏览器旧数据..." };
    case "backend_persisted":
      return { tone: "ok", label: "SQLite 已保存，浏览器备份已更新" };
    case "backend_unavailable_using_local_backup":
      return { tone: "warning", label: "本地后端不可用，当前使用浏览器备份。" };
    case "save_failed_local_backup_only":
      return { tone: "error", label: "保存到后端失败，已暂存到浏览器备份。" };
  }
}

export function App() {
  const [store, setStore] = useState<Store>(() => normalizeStore(emptyStore));
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatusSnapshot | null>(() =>
    storeRepository.getPersistenceStatus(),
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentUser = store.users.find((user) => user.id === store.currentUserId);

  useEffect(() => {
    let isMounted = true;
    const unsubscribePersistenceStatus = storeRepository.subscribePersistenceStatus((snapshot) => {
      if (isMounted) setPersistenceStatus(snapshot);
    });

    storeRepository
      .load()
      .then((result) => {
        if (!isMounted) return;
        setStore(result.store);
      })
      .catch((error) => {
        console.warn("Failed to load Car Utils store.", error);
        if (!isMounted) return;
        setStore(normalizeStore(emptyStore));
      })
      .finally(() => {
        if (isMounted) setIsStoreLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribePersistenceStatus();
    };
  }, []);

  function commit(next: Store) {
    setStore(next);
    saveStore(next);
  }

  function login(name: string, email: string) {
    const trimmedEmail = normalizeEmail(email);
    const normalizedStore = normalizeStore(store);
    const existingUser = normalizedStore.users.find((user) => normalizeEmail(user.email) === trimmedEmail);
    const user =
      existingUser ??
      withCreatedTimestamps({
        id: makeId("user"),
        name: name.trim() || trimmedEmail.split("@")[0] || "车主",
        email: trimmedEmail,
      } satisfies User);

    const users = existingUser ? normalizedStore.users : [...normalizedStore.users, user];
    commit({ ...normalizedStore, users, currentUserId: user.id });
  }

  function logout() {
    commit({ ...store, currentUserId: undefined });
    setSelectedVehicleId("");
  }

  function addVehicle(vehicle: Omit<Vehicle, "id" | "userId">) {
    const result = addVehicleToStore(store, currentUser, vehicle);
    if (!result) return;
    commit(result.store);
    setSelectedVehicleId(result.vehicle.id);
    setActiveTab("overview");
  }

  function updateVehicle(vehicleId: string, vehicle: Omit<Vehicle, "id" | "userId">) {
    const nextStore = updateVehicleInStore(store, currentUser, vehicleId, vehicle);
    if (!nextStore) return;
    commit(nextStore);
    setSelectedVehicleId(vehicleId);
  }

  function archiveVehicle(vehicleId: string) {
    const nextStore = archiveVehicleInStore(store, currentUser, vehicleId);
    if (!nextStore) return;
    commit(nextStore);
    if (selectedVehicleId === vehicleId) setSelectedVehicleId("");
  }

  function unarchiveVehicle(vehicleId: string) {
    const nextStore = unarchiveVehicleInStore(store, currentUser, vehicleId);
    if (!nextStore) return;
    commit(nextStore);
    setSelectedVehicleId(vehicleId);
  }

  function deleteVehicle(vehicleId: string) {
    const nextStore = softDeleteVehicleInStore(store, currentUser, vehicleId);
    if (!nextStore) return;
    commit(nextStore);
    if (selectedVehicleId === vehicleId) setSelectedVehicleId("");
  }

  function restoreVehicle(vehicleId: string) {
    const nextStore = restoreVehicleInStore(store, currentUser, vehicleId);
    if (!nextStore) return;
    commit(nextStore);
    setSelectedVehicleId(vehicleId);
  }

  function addFuelRecord(record: Omit<FuelRecord, "id" | "userId">) {
    const nextStore = addFuelRecordToStore(store, currentUser, record);
    if (!nextStore) return;
    commit(nextStore);
  }

  function updateFuelRecord(recordId: string, record: Omit<FuelRecord, "id" | "userId">) {
    const nextStore = updateFuelRecordInStore(store, currentUser, recordId, record);
    if (!nextStore) return;
    commit(nextStore);
  }

  function deleteFuelRecord(recordId: string) {
    const nextStore = softDeleteFuelRecordInStore(store, currentUser, recordId);
    if (!nextStore) return;
    commit(nextStore);
  }

  function restoreFuelRecord(recordId: string) {
    const nextStore = restoreFuelRecordInStore(store, currentUser, recordId);
    if (!nextStore) return;
    commit(nextStore);
  }

  function addWashRecord(record: Omit<WashRecord, "id" | "userId">) {
    const nextStore = addWashRecordToStore(store, currentUser, record);
    if (!nextStore) return;
    commit(nextStore);
  }

  function updateWashRecord(recordId: string, record: Omit<WashRecord, "id" | "userId">) {
    const nextStore = updateWashRecordInStore(store, currentUser, recordId, record);
    if (!nextStore) return;
    commit(nextStore);
  }

  function deleteWashRecord(recordId: string) {
    const nextStore = softDeleteWashRecordInStore(store, currentUser, recordId);
    if (!nextStore) return;
    commit(nextStore);
  }

  function restoreWashRecord(recordId: string) {
    const nextStore = restoreWashRecordInStore(store, currentUser, recordId);
    if (!nextStore) return;
    commit(nextStore);
  }

  function addWashProduct(product: Omit<WashProduct, "id" | "userId">) {
    const result = addWashProductToStore(store, currentUser, product);
    if (!result) return undefined;
    commit(result.store);
    return result.product;
  }

  function addWashProductPurchase(productId: string, purchase: WashProductPurchase) {
    const nextStore = addWashProductPurchaseToStore(store, currentUser, productId, purchase);
    if (!nextStore) return;
    commit(nextStore);
  }

  function updateWashProduct(productId: string, product: Omit<WashProduct, "id" | "userId">) {
    const nextStore = updateWashProductInStore(store, currentUser, productId, product);
    if (!nextStore) return;
    commit(nextStore);
  }

  function deleteWashProduct(productId: string) {
    const nextStore = softDeleteWashProductInStore(store, currentUser, productId);
    if (!nextStore) return;
    commit(nextStore);
  }

  function restoreWashProduct(productId: string) {
    const nextStore = restoreWashProductInStore(store, currentUser, productId);
    if (!nextStore) return;
    commit(nextStore);
  }

  function replaceStore(nextStore: Store) {
    const next = normalizeStore(nextStore);
    commit(next);
    if (selectedVehicleId && !filterActive(next.vehicles).some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId("");
    }
    return countStoreItems(next);
  }

  function importStore(importedStore: Store) {
    return replaceStore(mergeStores(store, importedStore));
  }

  if (isStoreLoading) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <h1>Car Utils</h1>
          <p>正在加载本地数据...</p>
          {persistenceStatus && <PersistenceStatusBanner snapshot={persistenceStatus} />}
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  const userVehicles = filterActive(store.vehicles).filter((vehicle) => vehicle.userId === currentUser.id);
  const activeUserVehicles = userVehicles.filter((vehicle) => !vehicle.isArchived);
  const deletedUserVehicles = filterDeleted(store.vehicles)
    .filter((vehicle) => vehicle.userId === currentUser.id)
    .sort((a, b) => a.nickname.localeCompare(b.nickname));
  const activeVehicleId = selectedVehicleId || activeUserVehicles[0]?.id || userVehicles[0]?.id || "";
  const activeVehicle = userVehicles.find((vehicle) => vehicle.id === activeVehicleId);
  const userFuelRecords = filterActive(store.fuelRecords).filter((record) => record.userId === currentUser.id);
  const fuelRecords = userFuelRecords
    .filter((record) => record.vehicleId === activeVehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const deletedFuelRecords = filterDeleted(store.fuelRecords)
    .filter((record) => record.userId === currentUser.id && record.vehicleId === activeVehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const userWashRecords = filterActive(store.washRecords).filter((record) => record.userId === currentUser.id);
  const washRecords = userWashRecords
    .filter((record) => record.vehicleId === activeVehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const deletedWashRecords = filterDeleted(store.washRecords)
    .filter((record) => record.userId === currentUser.id && record.vehicleId === activeVehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const washProducts = filterActive(store.washProducts)
    .filter((product) => product.userId === currentUser.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const deletedWashProducts = filterDeleted(store.washProducts)
    .filter((product) => product.userId === currentUser.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const vehicleSwitcherVehicles =
    activeVehicle && activeVehicle.isArchived
      ? [activeVehicle, ...activeUserVehicles.filter((vehicle) => vehicle.id !== activeVehicle.id)]
      : activeUserVehicles;

  return (
    <main className={navCollapsed ? "app-shell nav-collapsed" : "app-shell"}>
      <AppNavigation
        activeTab={activeTab}
        collapsed={navCollapsed}
        mobileOpen={mobileNavOpen}
        onChange={setActiveTab}
        onCloseMobile={() => setMobileNavOpen(false)}
        onLogout={logout}
        onOpenMobile={() => setMobileNavOpen(true)}
        onToggleCollapsed={() => setNavCollapsed((current) => !current)}
        userName={currentUser.name}
      />

      <section className="workspace">
        <div className="content">
          <header className="page-header">
            <div>
              <p className="eyebrow">Workspace</p>
              <h1>{appTabTitles[activeTab]}</h1>
            </div>
            <div className="page-header-actions">
              <ActiveVehicleSwitcher
                activeTab={activeTab}
                activeVehicleId={activeVehicleId}
                onManageVehicles={() => setActiveTab("vehicles")}
                onSelect={setSelectedVehicleId}
                vehicles={vehicleSwitcherVehicles}
              />
              {persistenceStatus && <PersistenceStatusBanner snapshot={persistenceStatus} />}
            </div>
          </header>

          {activeVehicle || activeTab === "vehicles" || activeTab === "sync" ? (
            <>
              {activeTab === "overview" && activeVehicle && (
                <>
                  <Dashboard vehicle={activeVehicle} fuelRecords={fuelRecords} washRecords={washRecords} />
                  <Records fuelRecords={fuelRecords} washRecords={washRecords} />
                </>
              )}
              {activeTab === "fuel" && activeVehicle && (
                <FuelTab
                  vehicle={activeVehicle}
                  fuelRecords={fuelRecords}
                  stationRecords={userFuelRecords}
                  deletedFuelRecords={deletedFuelRecords}
                  onAdd={addFuelRecord}
                  onUpdate={updateFuelRecord}
                  onDelete={deleteFuelRecord}
                  onRestore={restoreFuelRecord}
                />
              )}
              {activeTab === "wash" && activeVehicle && (
                <WashTab
                  deletedWashRecords={deletedWashRecords}
                  deletedWashProducts={deletedWashProducts}
                  onAddWash={addWashRecord}
                  onCreateProduct={addWashProduct}
                  onDeleteProduct={deleteWashProduct}
                  onDeleteWash={deleteWashRecord}
                  onReplenishProduct={addWashProductPurchase}
                  onRestoreProduct={restoreWashProduct}
                  onRestoreWash={restoreWashRecord}
                  onUpdateProduct={updateWashProduct}
                  onUpdateWash={updateWashRecord}
                  vehicle={activeVehicle}
                  washProducts={washProducts}
                  washRecords={washRecords}
                />
              )}
              {activeTab === "vehicles" && (
                <VehicleManager
                  activeVehicleId={activeVehicleId}
                  deletedVehicles={deletedUserVehicles}
                  fuelRecords={userFuelRecords}
                  onArchive={archiveVehicle}
                  onAdd={addVehicle}
                  onDelete={deleteVehicle}
                  onRestore={restoreVehicle}
                  onSelect={setSelectedVehicleId}
                  onUnarchive={unarchiveVehicle}
                  onUpdate={updateVehicle}
                  vehicles={userVehicles}
                  washRecords={userWashRecords}
                />
              )}
              {activeTab === "sync" && <DataSyncPanel store={store} onImport={importStore} onReplace={replaceStore} />}
            </>
          ) : (
            <div className="blank-state">
              <Wrench size={42} />
              <h2>先绑定你的第一台车</h2>
              <p>添加品牌、型号、能源类型和车牌后，加油和洗车数据都会按车辆独立统计。</p>
              <div className="blank-actions">
                <button className="primary-button" type="button" onClick={() => setActiveTab("vehicles")}>
                  添加车辆
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveTab("sync")}>
                  导入已有数据
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ActiveVehicleSwitcher({
  activeTab,
  activeVehicleId,
  onManageVehicles,
  onSelect,
  vehicles,
}: {
  activeTab: AppTab;
  activeVehicleId: string;
  onManageVehicles: () => void;
  onSelect: (id: string) => void;
  vehicles: Vehicle[];
}) {
  if (activeTab === "vehicles" || activeTab === "sync") return null;
  if (vehicles.length === 0) return null;

  return (
    <div className="vehicle-switcher">
      <div className="vehicle-context-icon" aria-hidden="true">
        <Car size={21} />
      </div>
      <label>
        <span>当前车辆</span>
        <select value={activeVehicleId} onChange={(event) => onSelect(event.target.value)}>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.nickname} · {vehicle.brand} {vehicle.model}
            </option>
          ))}
        </select>
      </label>
      <button className="ghost-button vehicle-manage-button" type="button" onClick={onManageVehicles}>
        <Wrench size={16} />
        管理车辆
      </button>
    </div>
  );
}

function FuelTab({
  vehicle,
  fuelRecords,
  stationRecords,
  deletedFuelRecords,
  onAdd,
  onUpdate,
  onDelete,
  onRestore,
}: {
  vehicle: Vehicle;
  fuelRecords: FuelRecord[];
  stationRecords: FuelRecord[];
  deletedFuelRecords: FuelRecord[];
  onAdd: (record: Omit<FuelRecord, "id" | "userId">) => void;
  onUpdate: (recordId: string, record: Omit<FuelRecord, "id" | "userId">) => void;
  onDelete: (recordId: string) => void;
  onRestore: (recordId: string) => void;
}) {
  const [activeFuelTab, setActiveFuelTab] = useState<FuelSubTab>("record");
  const [dateFilter, setDateFilter] = useState<FuelDateFilter>("all");
  const [query, setQuery] = useState("");
  const filteredFuelRecords = useMemo(
    () =>
      fuelRecords.filter(
        (record) => matchesFuelDateFilter(record, dateFilter) && matchesFuelQuery(record, query),
      ),
    [dateFilter, fuelRecords, query],
  );
  const filteredDeletedFuelRecords = useMemo(
    () =>
      deletedFuelRecords.filter(
        (record) => matchesFuelDateFilter(record, dateFilter) && matchesFuelQuery(record, query),
      ),
    [dateFilter, deletedFuelRecords, query],
  );

  return (
    <section className="tab-stack">
      <SubTabBar
        activeTab={activeFuelTab}
        tabs={[
          { id: "record", label: "记录加油" },
          { id: "analytics", label: "数据分析" },
          { id: "history", label: "历史记录" },
        ]}
        onChange={(tab) => setActiveFuelTab(tab as FuelSubTab)}
      />
      {activeFuelTab === "record" && (
        <FuelRecordWorkspace fuelRecords={fuelRecords} stationRecords={stationRecords} vehicle={vehicle} onAdd={onAdd} />
      )}
      {activeFuelTab === "analytics" && (
        <>
          <FuelFilters
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            query={query}
            onQueryChange={setQuery}
            visibleCount={filteredFuelRecords.length}
            totalCount={fuelRecords.length}
          />
          <FuelInsights vehicle={vehicle} fuelRecords={filteredFuelRecords} />
        </>
      )}
      {activeFuelTab === "history" && (
        <>
          <FuelFilters
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            query={query}
            onQueryChange={setQuery}
            visibleCount={filteredFuelRecords.length}
            totalCount={fuelRecords.length}
          />
        <FuelRecordsPanel
          emptyText="没有符合筛选条件的加油记录"
          deletedFuelRecords={filteredDeletedFuelRecords}
          fuelRecords={filteredFuelRecords}
          stationRecords={stationRecords}
          limit={50}
          onDelete={onDelete}
          onRestore={onRestore}
          onUpdate={onUpdate}
        />
        </>
      )}
    </section>
  );
}

function FuelRecordWorkspace({
  fuelRecords,
  stationRecords,
  vehicle,
  onAdd,
}: {
  fuelRecords: FuelRecord[];
  stationRecords: FuelRecord[];
  vehicle: Vehicle;
  onAdd: (record: Omit<FuelRecord, "id" | "userId">) => void;
}) {
  const monthKey = today().slice(0, 7);
  const monthRecords = useMemo(
    () => fuelRecords.filter((record) => record.date.startsWith(monthKey)),
    [fuelRecords, monthKey],
  );
  const monthSummary = useMemo(() => {
    const cost = monthRecords.reduce((sum, record) => sum + recordCost(record), 0);
    const volume = monthRecords.reduce((sum, record) => sum + record.volume, 0);
    return {
      count: monthRecords.length,
      cost,
      volume,
      averageUnitPrice: volume > 0 ? cost / volume : 0,
    };
  }, [monthRecords]);
  const insights = useMemo(
    () => calculateFuelInsights(vehicle, fuelRecords),
    [fuelRecords, vehicle.energyType, vehicle.tankSize],
  );

  return (
    <div className="fuel-record-workspace">
      <FuelForm fuelRecords={stationRecords} vehicle={vehicle} onAdd={onAdd} />
      <div className="fuel-entry-context">
        <section className="panel fuel-month-panel">
          <div className="panel-heading-row">
            <div>
              <div className="section-title compact">
                <Fuel size={17} />
                <span>本月概览</span>
              </div>
              <p className="filter-count">{monthKey.replace("-", " 年 ")} 月</p>
            </div>
          </div>
          <div className="fuel-quick-stats">
            <QuickStat label="加油次数" value={`${monthSummary.count} 次`} />
            <QuickStat label="总花费" value={money(monthSummary.cost)} />
            <QuickStat label="总加油量" value={`${number(monthSummary.volume, 1)} L`} />
            <QuickStat label="实付均价" value={`${number(monthSummary.averageUnitPrice, 2)} 元/L`} />
          </div>
        </section>

        <section className="panel fuel-quick-trend">
          <div className="section-title">
            <Droplets size={17} />
            <span>油费趋势</span>
          </div>
          <MiniLineChart title="单次实付金额" unit="元" points={insights.costPoints} digits={0} />
        </section>

        <FuelRecordsPanel fuelRecords={fuelRecords} limit={4} />
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="fuel-quick-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SubTabBar({
  activeTab,
  onChange,
  tabs,
}: {
  activeTab: string;
  onChange: (tab: string) => void;
  tabs: { id: string; label: string }[];
}) {
  return (
    <div className="module-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "module-tab active" : "module-tab"}
          key={tab.id}
          role="tab"
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function FuelFilters({
  dateFilter,
  onDateFilterChange,
  query,
  onQueryChange,
  visibleCount,
  totalCount,
}: {
  dateFilter: FuelDateFilter;
  onDateFilterChange: (filter: FuelDateFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  visibleCount: number;
  totalCount: number;
}) {
  const filters: { id: FuelDateFilter; label: string }[] = [
    { id: "all", label: "全部" },
    { id: "month", label: "本月" },
    { id: "year", label: "本年" },
  ];

  return (
    <section className="panel fuel-filter-panel">
      <div>
        <div className="section-title compact">
          <Fuel size={17} />
          <span>加油数据筛选</span>
        </div>
        <p className="filter-count">
          显示 {visibleCount} / {totalCount} 条记录
        </p>
      </div>
      <div className="filter-controls">
        <div className="segmented-buttons" aria-label="日期筛选">
          {filters.map((filter) => (
            <button
              className={dateFilter === filter.id ? "filter-button active" : "filter-button"}
              key={filter.id}
              type="button"
              onClick={() => onDateFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <span>搜索</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="加油站、油品、日期、金额..."
          />
        </label>
        {(dateFilter !== "all" || query.trim()) && (
          <button
            className="ghost-button clear-filter-button"
            type="button"
            onClick={() => {
              onDateFilterChange("all");
              onQueryChange("");
            }}
          >
            清除筛选
          </button>
        )}
      </div>
    </section>
  );
}

function DataSyncPanel({
  store,
  onImport,
  onReplace,
}: {
  store: Store;
  onImport: (store: Store) => StoreCounts;
  onReplace: (store: Store) => StoreCounts;
}) {
  const counts = countStoreItems(store);
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>(() => loadCloudSyncConfig());
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; text: string }>({
    type: "idle",
    text: "可以继续用 JSON 备份，也可以配置 CloudBase 云同步。云同步会先拉取云端并合并，再回写云端。",
  });

  function updateCloudConfig<Key extends keyof CloudSyncConfig>(key: Key, value: CloudSyncConfig[Key]) {
    setCloudConfig((current) => ({ ...current, [key]: value }));
  }

  function saveCloudConfigOnly() {
    saveCloudSyncConfig(cloudConfig);
    const validationError = validateCloudSyncConfig(cloudConfig);
    setStatus({
      type: validationError ? "idle" : "success",
      text: validationError ? `配置已保存。${validationError}` : "CloudBase 配置已保存，可以在手机和电脑上使用同一套配置同步。",
    });
  }

  async function runCloudSync() {
    const validationError = validateCloudSyncConfig(cloudConfig);
    if (validationError) {
      setStatus({ type: "error", text: validationError });
      return;
    }

    saveCloudSyncConfig(cloudConfig);
    setIsCloudSyncing(true);
    setStatus({ type: "idle", text: "正在连接 CloudBase，拉取云端数据并合并本机记录..." });

    try {
      const result = await syncStoreWithCloud(store, cloudConfig);
      const mergedCounts = onReplace(result.mergedStore);
      setStatus({
        type: "success",
        text: `${result.remoteFound ? "已与云端数据合并" : "已创建新的云端同步文档"}，本机现在共有 ${formatCounts(mergedCounts)}。同步文档：${result.documentId}`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        text: error instanceof Error ? error.message : "云同步失败，请检查 CloudBase 配置、域名白名单和网络状态。",
      });
    } finally {
      setIsCloudSyncing(false);
    }
  }

  function exportData() {
    const backup = createStoreBackup(store);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `car-utils-backup-${today()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus({
      type: "success",
      text: `已生成 schema v${DATA_SCHEMA_VERSION} 备份：${formatCounts(counts)}。`,
    });
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const importedStore = parseStoreBackup(await file.text());
      const incomingCounts = countStoreItems(importedStore);
      const mergedCounts = onImport(importedStore);
      setStatus({
        type: "success",
        text: `已导入 ${file.name}，读到 ${formatCounts(incomingCounts)}；合并后本机共有 ${formatCounts(mergedCounts)}。`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        text: error instanceof Error ? error.message : "导入失败，请确认文件是 Car Utils 的 JSON 备份。",
      });
    } finally {
      input.value = "";
    }
  }

  return (
    <section className="tab-stack">
      <section className="panel sync-hero">
        <div>
          <p className="eyebrow">Multi-device Sync</p>
          <h2>把本机账本同步到手机和云端</h2>
          <p>
            JSON 备份适合手动迁移；CloudBase 同步适合出门记录。同步前会先合并本机和云端数据，不会简单覆盖已有记录。
          </p>
        </div>
        <span className="sync-badge">Schema v{DATA_SCHEMA_VERSION}</span>
      </section>

      <p className={`status-banner sync-status ${status.type}`} aria-live="polite">
        {status.text}
      </p>

      <div className="sync-grid">
        <section className="panel sync-card">
          <div className="section-title">
            <Database size={17} />
            <span>本机数据</span>
          </div>
          <div className="data-count-grid">
            <DataCount label="账户" value={counts.users} />
            <DataCount label="车辆" value={counts.vehicles} />
            <DataCount label="加油" value={counts.fuelRecords} />
            <DataCount label="洗车" value={counts.washRecords} />
            <DataCount label="耗材" value={counts.washProducts} />
            <DataCount label="费用" value={counts.expenseRecords} />
          </div>
          <div className="sync-actions">
            <button className="primary-button icon-text-button" type="button" onClick={exportData}>
              <Download size={16} />
              导出备份
            </button>
            <label className="secondary-button icon-text-button file-button">
              <Upload size={16} />
              导入并合并
              <input type="file" accept="application/json,.json" onChange={importData} />
            </label>
          </div>
          <p className="sync-note">
            导入会按记录 ID 合并；如果同一条记录两边都改过，会优先保留更新时间更晚的一条。
          </p>
        </section>

        <section className="panel sync-card">
          <div className="section-title">
            <Cloud size={17} />
            <span>CloudBase 云同步</span>
          </div>
          <form
            className="cloud-sync-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runCloudSync();
            }}
          >
            <label>
              环境 ID
              <input
                value={cloudConfig.envId}
                onChange={(event) => updateCloudConfig("envId", event.target.value)}
                placeholder="car-utils-sync-d8gc5l3xlb8350cdf"
              />
            </label>
            <label>
              地域
              <select value={cloudConfig.region} onChange={(event) => updateCloudConfig("region", event.target.value)}>
                <option value="ap-shanghai">上海 ap-shanghai</option>
                <option value="ap-guangzhou">广州 ap-guangzhou</option>
                <option value="ap-beijing">北京 ap-beijing</option>
                <option value="ap-singapore">新加坡 ap-singapore</option>
              </select>
            </label>
            <label className="wide-field">
              同步密钥
              <input
                type="password"
                value={cloudConfig.syncKey}
                onChange={(event) => updateCloudConfig("syncKey", event.target.value)}
                placeholder="电脑和手机填写同一个密钥"
              />
            </label>
            <label>
              集合名
              <input
                value={cloudConfig.collectionName}
                onChange={(event) => updateCloudConfig("collectionName", event.target.value)}
                placeholder="car_utils_sync"
              />
            </label>
            <label>
              Access Key（可选）
              <input
                type="password"
                value={cloudConfig.accessKey ?? ""}
                onChange={(event) => updateCloudConfig("accessKey", event.target.value)}
                placeholder="没有可留空，使用匿名登录"
              />
            </label>
          </form>
          <div className="sync-actions">
            <button className="primary-button icon-text-button" type="button" onClick={runCloudSync} disabled={isCloudSyncing}>
              <RefreshCw size={16} />
              {isCloudSyncing ? "同步中..." : "立即同步"}
            </button>
            <button className="secondary-button" type="button" onClick={saveCloudConfigOnly}>
              保存配置
            </button>
          </div>
          <p className="sync-note">
            首次同步会创建加密云端文档；之后手机和电脑使用同一个环境 ID、集合名和同步密钥即可合并数据。
          </p>
        </section>

        <section className="panel sync-card">
          <div className="section-title">
            <Smartphone size={17} />
            <span>iPhone 移动端使用</span>
          </div>
          <div className="sync-roadmap">
            <div>
              <strong>1. 使用 CloudBase 托管域名</strong>
              <span>当前已部署到 CloudBase 静态网站托管，出门直接打开这个 HTTPS 地址。</span>
            </div>
            <div>
              <strong>2. 首次确认访问</strong>
              <span>默认测试域名会出现 CloudBase 风险提醒，点“确定访问”后进入应用。</span>
            </div>
            <div>
              <strong>3. 添加到主屏幕</strong>
              <span>在 iPhone Safari 打开部署地址，使用分享菜单添加到主屏幕，之后就能像 App 一样启动。</span>
            </div>
          </div>
          <p className="sync-note">LAN 地址只适合本机开发；日常出门请使用 CloudBase 托管域名。</p>
        </section>
      </div>
    </section>
  );
}

function DataCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="data-count">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatCounts(counts: StoreCounts) {
  return `${counts.users} 个账户、${counts.vehicles} 台车、${counts.fuelRecords} 条加油、${counts.washRecords} 条洗车、${counts.washProducts} 个耗材、${counts.expenseRecords} 条费用`;
}

function LoginScreen({ onLogin }: { onLogin: (name: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    onLogin(name, email);
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-mark">
          <Car size={32} />
        </div>
        <p className="eyebrow">Car Utils</p>
        <h1>把车辆花费和护理记录管起来</h1>
        <form onSubmit={submit} className="stack">
          <label>
            昵称
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 Dylan" />
          </label>
          <label>
            邮箱
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className="primary-button" type="submit">
            登录 / 创建本地账户
          </button>
        </form>
      </section>
    </main>
  );
}

type VehicleDraft = Omit<Vehicle, "id" | "userId">;

function createEmptyVehicleDraft(): VehicleDraft {
  return {
    nickname: "",
    brand: "",
    model: "",
    year: new Date().getFullYear().toString(),
    plate: "",
    energyType: "汽油",
    tankSize: 55,
    batterySize: undefined,
    currentOdometer: undefined,
    vin: "",
    note: "",
  };
}

function createVehicleDraft(vehicle: Vehicle): VehicleDraft {
  return {
    type: "vehicle",
    nickname: vehicle.nickname ?? "",
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    year: vehicle.year ?? "",
    plate: vehicle.plate ?? "",
    energyType: vehicle.energyType ?? "汽油",
    tankSize: vehicle.tankSize,
    batterySize: vehicle.batterySize,
    currentOdometer: vehicle.currentOdometer,
    vin: vehicle.vin ?? "",
    note: vehicle.note ?? "",
    presetId: vehicle.presetId,
    isArchived: vehicle.isArchived,
  };
}

function VehicleManager({
  activeVehicleId,
  deletedVehicles,
  fuelRecords,
  onAdd,
  onArchive,
  onDelete,
  onRestore,
  onSelect,
  onUnarchive,
  onUpdate,
  vehicles,
  washRecords,
}: {
  activeVehicleId: string;
  deletedVehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  onAdd: (vehicle: VehicleDraft) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onSelect: (id: string) => void;
  onUnarchive: (id: string) => void;
  onUpdate: (vehicleId: string, vehicle: VehicleDraft) => void;
  vehicles: Vehicle[];
  washRecords: WashRecord[];
}) {
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [vehicleView, setVehicleView] = useState<"active" | "archived" | "deleted">("active");
  const editingVehicle = vehicles.find((vehicle) => vehicle.id === editingVehicleId);
  const activeVehicles = vehicles.filter((vehicle) => !vehicle.isArchived);
  const archivedVehicles = vehicles.filter((vehicle) => vehicle.isArchived);
  const visibleVehicles =
    vehicleView === "deleted" ? deletedVehicles : vehicleView === "archived" ? archivedVehicles : activeVehicles;

  function startEditing(vehicleId: string) {
    setEditingVehicleId(vehicleId);
    onSelect(vehicleId);
  }

  function countRecords(vehicleId: string) {
    return {
      fuel: fuelRecords.filter((record) => record.vehicleId === vehicleId).length,
      wash: washRecords.filter((record) => record.vehicleId === vehicleId).length,
    };
  }

  function confirmDelete(vehicle: Vehicle) {
    const counts = countRecords(vehicle.id);
    const confirmed = window.confirm(
      `确定删除车辆“${vehicle.nickname}”吗？这台车下有 ${counts.fuel} 条加油记录、${counts.wash} 条洗车记录。删除后车辆默认隐藏，历史记录仍会保留，可以在“已删除”里恢复。`,
    );
    if (confirmed) {
      if (editingVehicleId === vehicle.id) setEditingVehicleId("");
      onDelete(vehicle.id);
    }
  }

  return (
    <section className="tab-layout">
      <VehicleForm
        key={editingVehicle?.id ?? "new-vehicle"}
        initialVehicle={editingVehicle}
        mode={editingVehicle ? "edit" : "create"}
        onCancel={editingVehicle ? () => setEditingVehicleId("") : undefined}
        onSubmit={(vehicle) => {
          if (editingVehicle) {
            onUpdate(editingVehicle.id, vehicle);
            setEditingVehicleId("");
          } else {
            onAdd(vehicle);
          }
        }}
      />
      <VehicleSummary
        activeVehicleId={activeVehicleId}
        activeCount={activeVehicles.length}
        archivedCount={archivedVehicles.length}
        deletedCount={deletedVehicles.length}
        editingVehicleId={editingVehicleId}
        onArchive={onArchive}
        onDelete={confirmDelete}
        onEdit={startEditing}
        onRestore={onRestore}
        onSelect={onSelect}
        onUnarchive={onUnarchive}
        onViewChange={(view) => {
          setVehicleView(view);
          setEditingVehicleId("");
        }}
        vehicleView={vehicleView}
        vehicles={visibleVehicles}
      />
    </section>
  );
}

function VehicleForm({
  initialVehicle,
  mode,
  onCancel,
  onSubmit,
}: {
  initialVehicle?: Vehicle;
  mode: "create" | "edit";
  onCancel?: () => void;
  onSubmit: (vehicle: VehicleDraft) => void;
}) {
  const [presetKey, setPresetKey] = useState("");
  const [vehicle, setVehicle] = useState<VehicleDraft>(() =>
    initialVehicle ? createVehicleDraft(initialVehicle) : createEmptyVehicleDraft(),
  );

  function applyPreset(key: string) {
    setPresetKey(key);
    const preset = vehiclePresets.find((item) => `${item.brand} ${item.model}` === key);
    if (!preset) return;

    setVehicle((current) => ({
      ...current,
      nickname: current.nickname || preset.model,
      brand: preset.brand,
      model: preset.model,
      energyType: preset.energyType,
      tankSize: preset.tankSize,
      batterySize: preset.batterySize,
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!vehicle.nickname.trim() || !vehicle.brand.trim() || !vehicle.model.trim()) return;
    onSubmit(vehicle);
    setPresetKey("");
    if (mode === "create") setVehicle(createEmptyVehicleDraft());
  }

  return (
    <form className="panel stack fuel-entry-form" onSubmit={submit}>
      <div className="section-title">
        <Plus size={17} />
        <span>{mode === "edit" ? "编辑车辆" : "添加车辆"}</span>
      </div>
      <label>
        型号预设
        <select value={presetKey} onChange={(event) => applyPreset(event.target.value)}>
          <option value="">手动填写</option>
          {vehiclePresets.map((preset) => (
            <option key={`${preset.brand} ${preset.model}`} value={`${preset.brand} ${preset.model}`}>
              {preset.brand} {preset.model}
            </option>
          ))}
        </select>
      </label>
      <label>
        车辆昵称
        <input
          required
          value={vehicle.nickname}
          onChange={(event) => setVehicle({ ...vehicle, nickname: event.target.value })}
          placeholder="通勤车 / 家用 SUV"
        />
      </label>
      <div className="two-cols">
        <label>
          品牌
          <input
            required
            value={vehicle.brand}
            onChange={(event) => setVehicle({ ...vehicle, brand: event.target.value })}
            placeholder="Toyota"
          />
        </label>
        <label>
          型号
          <input
            required
            value={vehicle.model}
            onChange={(event) => setVehicle({ ...vehicle, model: event.target.value })}
            placeholder="Camry"
          />
        </label>
      </div>
      <div className="two-cols">
        <label>
          年款
          <input value={vehicle.year} onChange={(event) => setVehicle({ ...vehicle, year: event.target.value })} />
        </label>
        <label>
          能源
          <select
            value={vehicle.energyType}
            onChange={(event) => {
              const energyType = event.target.value as EnergyType;
              setVehicle({
                ...vehicle,
                energyType,
                tankSize: energyType === "纯电" ? undefined : vehicle.tankSize || 55,
                batterySize:
                  energyType === "纯电" || energyType === "混动" || energyType === "增程"
                    ? vehicle.batterySize
                    : undefined,
              });
            }}
          >
            <option>汽油</option>
            <option>柴油</option>
            <option>混动</option>
            <option>纯电</option>
            <option>增程</option>
          </select>
        </label>
      </div>
      {vehicle.energyType !== "纯电" && (
        <label>
          油箱容量 L
          <input
            type="number"
            min="0"
            step="0.1"
            value={vehicle.tankSize ?? ""}
            onChange={(event) =>
              setVehicle({ ...vehicle, tankSize: event.target.value ? Number(event.target.value) : undefined })
            }
            placeholder="例如 55"
          />
        </label>
      )}
      {(vehicle.energyType === "纯电" || vehicle.energyType === "混动" || vehicle.energyType === "增程") && (
        <label>
          电池容量 kWh
          <input
            type="number"
            min="0"
            step="0.1"
            value={vehicle.batterySize ?? ""}
            onChange={(event) =>
              setVehicle({ ...vehicle, batterySize: event.target.value ? Number(event.target.value) : undefined })
            }
            placeholder="例如 60"
          />
        </label>
      )}
      <div className="two-cols">
        <label>
          车牌
          <input value={vehicle.plate} onChange={(event) => setVehicle({ ...vehicle, plate: event.target.value })} />
        </label>
        <label>
          当前总里程 km
          <input
            type="number"
            min="0"
            step="0.1"
            value={vehicle.currentOdometer ?? ""}
            onChange={(event) =>
              setVehicle({ ...vehicle, currentOdometer: event.target.value ? Number(event.target.value) : undefined })
            }
            placeholder="可选"
          />
        </label>
      </div>
      <label>
        VIN
        <input value={vehicle.vin ?? ""} onChange={(event) => setVehicle({ ...vehicle, vin: event.target.value })} />
      </label>
      <label>
        备注
        <input value={vehicle.note ?? ""} onChange={(event) => setVehicle({ ...vehicle, note: event.target.value })} />
      </label>
      <div className="form-actions">
        <button className="secondary-button" type="submit">
          {mode === "edit" ? "保存车辆" : "添加车辆"}
        </button>
        {onCancel && (
          <button className="ghost-button" type="button" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
}

function VehicleSummary({
  vehicles,
  activeVehicleId,
  activeCount,
  archivedCount,
  deletedCount,
  editingVehicleId,
  onArchive,
  onDelete,
  onEdit,
  onRestore,
  onSelect,
  onUnarchive,
  onViewChange,
  vehicleView,
}: {
  vehicles: Vehicle[];
  activeVehicleId: string;
  activeCount: number;
  archivedCount: number;
  deletedCount: number;
  editingVehicleId: string;
  onArchive: (id: string) => void;
  onDelete: (vehicle: Vehicle) => void;
  onEdit: (id: string) => void;
  onRestore: (id: string) => void;
  onSelect: (id: string) => void;
  onUnarchive: (id: string) => void;
  onViewChange: (view: "active" | "archived" | "deleted") => void;
  vehicleView: "active" | "archived" | "deleted";
}) {
  return (
    <section className="panel">
      <div className="panel-heading-row">
        <div className="section-title">
          <Car size={17} />
          <span>已绑定车辆</span>
        </div>
        <div className="segmented-buttons compact" aria-label="车辆状态">
          <button
            className={vehicleView === "active" ? "filter-button active" : "filter-button"}
            type="button"
            onClick={() => onViewChange("active")}
          >
            正常 {activeCount}
          </button>
          <button
            className={vehicleView === "archived" ? "filter-button active" : "filter-button"}
            type="button"
            onClick={() => onViewChange("archived")}
          >
            归档 {archivedCount}
          </button>
          <button
            className={vehicleView === "deleted" ? "filter-button active" : "filter-button"}
            type="button"
            onClick={() => onViewChange("deleted")}
          >
            已删除 {deletedCount}
          </button>
        </div>
      </div>
      <div className="vehicle-summary-list">
        {vehicles.map((vehicle) => (
          <div
            className={
              vehicle.id === editingVehicleId
                ? "summary-row editing"
                : vehicle.id === activeVehicleId
                  ? "summary-row active"
                  : "summary-row"
            }
            key={vehicle.id}
          >
            <button className="summary-main" type="button" onClick={() => onSelect(vehicle.id)}>
              <strong>{vehicle.nickname}</strong>
              <span>
                {vehicle.brand} {vehicle.model} · {vehicle.year || "未填年款"} · {vehicle.energyType}
                {vehicle.energyType !== "纯电" && vehicle.tankSize ? ` · ${vehicle.tankSize}L油箱` : ""}
                {vehicle.batterySize ? ` · ${vehicle.batterySize}kWh电池` : ""}
                {vehicle.currentOdometer != null ? ` · ${vehicle.currentOdometer}km` : ""}
                {vehicle.plate ? ` · ${vehicle.plate}` : ""}
              </span>
            </button>
            <div className="summary-actions">
              {vehicleView === "deleted" ? (
                <button className="text-button" type="button" onClick={() => onRestore(vehicle.id)}>
                  恢复
                </button>
              ) : (
                <>
                  <button className="text-button" type="button" onClick={() => onEdit(vehicle.id)}>
                    编辑
                  </button>
                  {vehicleView === "archived" ? (
                    <button className="text-button" type="button" onClick={() => onUnarchive(vehicle.id)}>
                      启用
                    </button>
                  ) : (
                    <button className="text-button" type="button" onClick={() => onArchive(vehicle.id)}>
                      归档
                    </button>
                  )}
                  <button className="text-button danger" type="button" onClick={() => onDelete(vehicle)}>
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {vehicles.length === 0 && (
          <p className="empty">
            {vehicleView === "deleted"
              ? "暂无已删除车辆。"
              : vehicleView === "archived"
                ? "暂无归档车辆。"
                : "还没有绑定车辆。"}
          </p>
        )}
      </div>
    </section>
  );
}

function Dashboard({
  vehicle,
  fuelRecords,
  washRecords,
}: {
  vehicle: Vehicle;
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
}) {
  const stats = useMemo(() => {
    return {
      ...calculateFuelOverview(fuelRecords),
      washCost: calculateWashOverview(washRecords).washCost,
    };
  }, [fuelRecords, washRecords]);

  return (
    <section className="hero-band">
      <div>
        <p className="eyebrow">当前车辆</p>
        <h2>
          {vehicle.nickname}
          <span>
            {vehicle.brand} {vehicle.model}
          </span>
        </h2>
        <p className="muted">
          {vehicle.year} · {vehicle.energyType}
          {vehicle.plate ? ` · ${vehicle.plate}` : ""}
        </p>
      </div>
      <div className="stats-grid">
        <StatCard icon={<Fuel size={20} />} label="加油总花费" value={money(stats.fuelCost)} />
        <StatCard icon={<Droplets size={20} />} label="累计加油" value={`${number(stats.fuelVolume)} L`} />
        <StatCard icon={<Sparkles size={20} />} label="洗车总花费" value={money(stats.washCost)} />
        <StatCard icon={<Car size={20} />} label="估算油耗" value={`${number(stats.avgConsumption)} L/100km`} />
      </div>
    </section>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

const washTypeOptions: { id: WashType; label: string }[] = [
  { id: "diy", label: "DIY 洗车" },
  { id: "shop_basic", label: "店内普洗" },
  { id: "shop_detailing", label: "店内精洗" },
  { id: "machine", label: "机器洗车" },
  { id: "other", label: "其他" },
];

const washStepOptions = ["预洗", "正洗", "轮毂", "轮胎", "内饰", "玻璃", "去污", "打蜡/保护", "收水", "其他"];

const productCategoryOptions = [
  "预洗液",
  "正洗液",
  "洗车液",
  "轮毂清洁",
  "轮胎养护",
  "玻璃清洁",
  "内饰清洁",
  "蜡/封体",
  "毛巾/工具",
  "其他",
];

function FuelInsights({ vehicle, fuelRecords }: { vehicle: Vehicle; fuelRecords: FuelRecord[] }) {
  const insights = useMemo(
    () => calculateFuelInsights(vehicle, fuelRecords),
    [fuelRecords, vehicle.energyType, vehicle.tankSize],
  );

  return (
    <section className="fuel-insights">
      <div className="panel insight-panel">
        <div className="section-title">
          <Fuel size={17} />
          <span>加油趋势</span>
        </div>
        <div className="chart-grid">
          <MiniLineChart title="实付单价趋势" unit="元/L" points={insights.pricePoints} digits={2} />
          <MiniLineChart title="单次实付金额" unit="元" points={insights.costPoints} digits={0} />
        </div>
      </div>

      <div className="panel insight-panel">
        <div className="section-title">
          <Info size={17} />
          <span>油品耐跑参考</span>
        </div>
        {insights.canCompareStations ? (
          <>
            <p className="analysis-note">
              使用“上一笔加油后油位到下一笔加油前油位”和总里程估算区间消耗，按上一笔加油站与油品归因；数值越高表示同样一升油跑得越远。路况、天气和驾驶方式仍会影响结果。
            </p>
            <div className="station-performance-list">
              {insights.stationPerformances.map((station) => (
                <div className="station-performance-row" key={`${station.station}-${station.grade}`}>
                  <div>
                    <strong>
                      {station.station} · {station.grade}
                    </strong>
                    <span>
                      {station.intervals} 段可信区间 · {station.recordCount} 次加油
                    </span>
                  </div>
                  <div>
                    <strong>{number(station.avgKmPerLiter, 2)} km/L</strong>
                    <span>
                      {station.relativeToAverage >= 0 ? "+" : ""}
                      {number(station.relativeToAverage, 1)}% · {number(station.avgConsumption, 2)} L/100km
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="empty">
            暂不做油品耐跑判断。需要至少两组“加油站 + 油品”各有 2 段可信区间；可信区间需要两笔总里程、上一笔加油后油位、下一笔加油前油位{insights.hasTankSize ? "" : "，以及车辆油箱容量"}。
          </p>
        )}

        <StationSummaryList summaries={insights.stationSummaries} />
      </div>
    </section>
  );
}

function MiniLineChart({
  title,
  unit,
  points,
  digits,
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
  digits: number;
}) {
  const validPoints = points.filter((point) => Number.isFinite(point.value));
  const latest = validPoints.at(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (validPoints.length < 2) {
    return (
      <div className="chart-card">
        <div className="chart-header">
          <span>{title}</span>
          <strong>-</strong>
        </div>
        <div className="chart-empty">至少 2 条记录后显示趋势</div>
      </div>
    );
  }

  const min = Math.min(...validPoints.map((point) => point.value));
  const max = Math.max(...validPoints.map((point) => point.value));
  const range = max - min || 1;
  const width = 320;
  const height = 160;
  const left = 22;
  const right = 304;
  const top = 22;
  const bottom = 124;
  const coordinates = validPoints.map((point, index) => {
    const x = validPoints.length === 1 ? left : left + ((right - left) * index) / (validPoints.length - 1);
    const y = bottom - ((point.value - min) / range) * (bottom - top);
    return { ...point, x, y };
  });
  const polylinePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const activePoint = hoveredIndex == null ? null : coordinates[hoveredIndex];

  function updateHoveredPoint(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * width;
    const closestIndex = coordinates.reduce((bestIndex, point, index) => {
      const bestDistance = Math.abs(coordinates[bestIndex].x - pointerX);
      const distance = Math.abs(point.x - pointerX);
      return distance < bestDistance ? index : bestIndex;
    }, 0);

    setHoveredIndex(closestIndex);
  }

  return (
    <div className="chart-card">
      <div className="chart-header">
        <span>{title}</span>
        <strong>
          {latest ? number(latest.value, digits) : "-"} <small>{unit}</small>
        </strong>
      </div>
      <div className="chart-plot">
        <svg
          className="line-chart"
          onBlur={() => setHoveredIndex(null)}
          onFocus={() => setHoveredIndex(coordinates.length - 1)}
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={updateHoveredPoint}
          tabIndex={0}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={title}
        >
          <line x1={left} x2={right} y1={top} y2={top} />
          <line x1={left} x2={right} y1={(top + bottom) / 2} y2={(top + bottom) / 2} />
          <line x1={left} x2={right} y1={bottom} y2={bottom} />
          {activePoint && <line className="active-guide" x1={activePoint.x} x2={activePoint.x} y1={top} y2={bottom} />}
          <polyline points={polylinePoints} />
          {coordinates.map((point, index) => (
            <circle
              className={index === hoveredIndex ? "active-dot" : undefined}
              cx={point.x}
              cy={point.y}
              key={`${point.label}-${point.x}`}
              r={index === hoveredIndex ? "5" : "3.5"}
            />
          ))}
        </svg>
        {activePoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100}%`,
            }}
          >
            <strong>
              {number(activePoint.value, digits)} {unit}
            </strong>
            <span>{activePoint.label}</span>
          </div>
        )}
      </div>
      <div className="chart-footer">
        <span>{validPoints[0].label}</span>
        <span>
          {number(min, digits)} - {number(max, digits)}
        </span>
        <span>{validPoints[validPoints.length - 1].label}</span>
      </div>
    </div>
  );
}

function StationSummaryList({ summaries }: { summaries: StationSummary[] }) {
  if (summaries.length === 0) {
    return <p className="empty">暂无加油站数据。</p>;
  }

  return (
    <div className="station-summary-list">
      {summaries.slice(0, 5).map((summary) => (
        <div className="station-summary-pill" key={summary.station}>
          <strong>{summary.station}</strong>
          <span>
            {summary.recordCount} 次 · {number(summary.totalVolume, 1)} L · 均价 {number(summary.avgUnitPrice, 2)} 元/L
          </span>
        </div>
      ))}
    </div>
  );
}

function FuelForm({
  fuelRecords,
  vehicle,
  onAdd,
}: {
  fuelRecords: FuelRecord[];
  vehicle: Vehicle;
  onAdd: (record: Omit<FuelRecord, "id" | "userId">) => void;
}) {
  const [form, setForm] = useState<FuelRecordDraft>(() => createEmptyFuelDraft());

  const totalCost = Number(form.volume) * Number(form.pricePerUnit);
  const paidAmount = resolveFuelDraftPaidAmount(form);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.volume || !form.pricePerUnit) return;
    onAdd(buildFuelRecord(vehicle.id, form));
    setForm({
      ...createEmptyFuelDraft(form.fuelGrade),
      fuelGrade: form.fuelGrade,
      customFuelGrade: form.customFuelGrade,
    });
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <div className="section-title">
        <Fuel size={17} />
        <span>记录加油</span>
      </div>
      <div className="two-cols">
        <label>
          日期
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </label>
        <label>
          <span className="label-with-info">
            加油时总里程 km
            <span className="info-tip" tabIndex={0} aria-label="加油时总里程说明">
              <Info size={14} />
              <span className="tooltip">选填。填写加油当下仪表盘显示的车辆总里程；补历史数据忘记了可以留空，油耗统计会跳过缺里程的记录。</span>
            </span>
          </span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.odometer}
            onChange={(event) => setForm({ ...form, odometer: event.target.value })}
            placeholder="可选"
          />
        </label>
      </div>
      <div className="two-cols">
        <label>
          油品
          <select
            value={form.fuelGrade}
            onChange={(event) => setForm({ ...form, fuelGrade: event.target.value })}
          >
            {fuelGrades.map((grade) => (
              <option key={grade}>{grade}</option>
            ))}
          </select>
        </label>
        {form.fuelGrade === "其他" ? (
          <label>
            自定义油品
            <input
              value={form.customFuelGrade}
              onChange={(event) => setForm({ ...form, customFuelGrade: event.target.value })}
              placeholder="例如 V-Power 98"
            />
          </label>
        ) : (
          <FuelStationField
            fuelRecords={fuelRecords}
            vehicleId={vehicle.id}
            value={form.station}
            onChange={(station) => setForm({ ...form, station })}
          />
        )}
      </div>
      <div className="two-cols">
        <label>
          升数 L
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.volume}
            onChange={(event) => setForm({ ...form, volume: event.target.value })}
          />
        </label>
        <label>
          表显单价
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.pricePerUnit}
            onChange={(event) => setForm({ ...form, pricePerUnit: event.target.value })}
          />
        </label>
      </div>
      {form.fuelGrade === "其他" && (
        <FuelStationField
          fuelRecords={fuelRecords}
          vehicleId={vehicle.id}
          value={form.station}
          onChange={(station) => setForm({ ...form, station })}
        />
      )}
      <div className="two-cols">
        <label>
          实付金额
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.paidAmount}
            onChange={(event) => setForm({ ...form, paidAmount: event.target.value })}
            placeholder={money(totalCost || 0)}
          />
        </label>
        <label>
          加油后油位 %
          <input
            type="number"
            min="0"
            max="100"
            value={form.fuelLevelAfter}
            onChange={(event) => setForm({ ...form, fuelLevelAfter: event.target.value })}
            placeholder={form.fullTank ? "100" : "可选"}
          />
        </label>
      </div>
      <label>
        加油前油位 %
        <input
          type="number"
          min="0"
          max="100"
          value={form.fuelLevelBefore}
          onChange={(event) => setForm({ ...form, fuelLevelBefore: event.target.value })}
          placeholder="例如 20"
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={form.fullTank}
          onChange={(event) => setForm({ ...form, fullTank: event.target.checked })}
        />
        加满
      </label>
      <button className="primary-button fuel-save-button" type="submit">
        保存加油记录 · {money(paidAmount || 0)}
      </button>
    </form>
  );
}

function WashTab({
  deletedWashRecords,
  deletedWashProducts,
  onAddWash,
  onCreateProduct,
  onDeleteProduct,
  onDeleteWash,
  onReplenishProduct,
  onRestoreProduct,
  onRestoreWash,
  onUpdateProduct,
  onUpdateWash,
  vehicle,
  washProducts,
  washRecords,
}: {
  deletedWashRecords: WashRecord[];
  deletedWashProducts: WashProduct[];
  onAddWash: (record: Omit<WashRecord, "id" | "userId">) => void;
  onCreateProduct: (product: Omit<WashProduct, "id" | "userId">) => WashProduct | undefined;
  onDeleteProduct: (productId: string) => void;
  onDeleteWash: (recordId: string) => void;
  onReplenishProduct: (productId: string, purchase: WashProductPurchase) => void;
  onRestoreProduct: (productId: string) => void;
  onRestoreWash: (recordId: string) => void;
  onUpdateProduct: (productId: string, product: Omit<WashProduct, "id" | "userId">) => void;
  onUpdateWash: (recordId: string, record: Omit<WashRecord, "id" | "userId">) => void;
  vehicle: Vehicle;
  washProducts: WashProduct[];
  washRecords: WashRecord[];
}) {
  const [activeWashTab, setActiveWashTab] = useState<WashSubTab>("record");

  return (
    <section className="tab-stack">
      <SubTabBar
        activeTab={activeWashTab}
        tabs={[
          { id: "record", label: "记录洗车" },
          { id: "warehouse", label: "耗材仓库" },
          { id: "history", label: "历史记录" },
        ]}
        onChange={(tab) => setActiveWashTab(tab as WashSubTab)}
      />
      {activeWashTab === "record" && (
        <WashForm
          onAdd={onAddWash}
          onCreateProduct={onCreateProduct}
          vehicle={vehicle}
          washProducts={washProducts}
        />
      )}
      {activeWashTab === "warehouse" && (
        <WashProductWarehouse
          deletedWashProducts={deletedWashProducts}
          onAdd={onCreateProduct}
          onDelete={onDeleteProduct}
          onReplenish={onReplenishProduct}
          onRestore={onRestoreProduct}
          onUpdate={onUpdateProduct}
          washProducts={washProducts}
          washRecords={washRecords}
        />
      )}
      {activeWashTab === "history" && (
        <WashRecordsPanel
          deletedWashRecords={deletedWashRecords}
          limit={50}
          onDelete={onDeleteWash}
          onCreateProduct={onCreateProduct}
          onRestore={onRestoreWash}
          onUpdate={onUpdateWash}
          washProducts={washProducts}
          washRecords={washRecords}
        />
      )}
    </section>
  );
}

function WashForm({
  vehicle,
  washProducts,
  onAdd,
  onCreateProduct,
}: {
  vehicle: Vehicle;
  washProducts: WashProduct[];
  onAdd: (record: Omit<WashRecord, "id" | "userId">) => void;
  onCreateProduct: (product: Omit<WashProduct, "id" | "userId">) => WashProduct | undefined;
}) {
  const [draft, setDraft] = useState<WashRecordDraft>(() => createEmptyWashDraft());

  function submit(event: FormEvent) {
    event.preventDefault();
    onAdd(buildWashRecord(vehicle.id, draft));
    setDraft(createEmptyWashDraft(draft.washType));
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <div className="section-title">
        <Sparkles size={17} />
        <span>记录洗车</span>
      </div>
      <WashRecordFields
        draft={draft}
        onChange={setDraft}
        onCreateProduct={onCreateProduct}
        washProducts={washProducts}
      />
      <button className="primary-button" type="submit">
        保存洗车记录 · {money(resolveWashCost(draft))}
      </button>
    </form>
  );
}

function WashRecordFields({
  draft,
  onChange,
  onCreateProduct,
  washProducts,
}: {
  draft: WashRecordDraft;
  onChange: (draft: WashRecordDraft) => void;
  onCreateProduct: (product: Omit<WashProduct, "id" | "userId">) => WashProduct | undefined;
  washProducts: WashProduct[];
}) {
  const isDiy = draft.washType === "diy";

  function updateProduct(productId: string, nextProduct: Partial<WashProductUsageDraft>) {
    onChange({
      ...draft,
      products: draft.products.map((product) =>
        product.id === productId ? { ...product, ...nextProduct } : product,
      ),
    });
  }

  function removeProduct(productId: string) {
    onChange({ ...draft, products: draft.products.filter((product) => product.id !== productId) });
  }

  function selectWarehouseProduct(productRowId: string, productId: string) {
    const selectedProduct = washProducts.find((product) => product.id === productId);
    if (!selectedProduct) {
      updateProduct(productRowId, { productId: "" });
      return;
    }

    const latestPurchase = selectedProduct.purchases.at(-1);
    updateProduct(productRowId, {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      category: selectedProduct.category,
      purchasePrice: latestPurchase ? String(latestPurchase.purchasePrice) : "",
      capacity: latestPurchase ? String(latestPurchase.capacity) : "",
      capacityUnit: latestPurchase?.capacityUnit ?? "ml",
    });
  }

  function createWarehouseProductFromUsage(product: WashProductUsageDraft) {
    const productInput = buildWashProductFromUsageDraft(product, draft.date);
    if (!productInput) return;

    const nextProduct = onCreateProduct(productInput);

    if (nextProduct) updateProduct(product.id, { productId: nextProduct.id });
  }

  return (
    <>
      <div className="two-cols">
        <label>
          日期
          <input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} />
        </label>
        <label>
          洗车方式
          <select
            value={draft.washType}
            onChange={(event) => onChange({ ...draft, washType: event.target.value as WashType })}
          >
            {washTypeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="two-cols">
        <label>
          里程 km
          <input
            type="number"
            min="0"
            step="0.1"
            value={draft.odometer}
            onChange={(event) => onChange({ ...draft, odometer: event.target.value })}
            placeholder="可选"
          />
        </label>
        <label>
          用时分钟
          <input
            type="number"
            min="0"
            value={draft.minutes}
            onChange={(event) => onChange({ ...draft, minutes: event.target.value })}
            placeholder="可选"
          />
        </label>
      </div>
      {!isDiy && (
        <div className="two-cols">
          <label>
            店铺名称
            <input
              value={draft.shopName}
              onChange={(event) => onChange({ ...draft, shopName: event.target.value })}
              placeholder="例如 某某汽车美容"
            />
          </label>
          <label>
            地点
            <input
              value={draft.location}
              onChange={(event) => onChange({ ...draft, location: event.target.value })}
              placeholder="可选"
            />
          </label>
        </div>
      )}
      <label>
        项目 / 步骤，逗号分隔
        <input value={draft.items} onChange={(event) => onChange({ ...draft, items: event.target.value })} />
      </label>
      <div className="two-cols">
        <label>
          实付总成本
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.cost}
            onChange={(event) => onChange({ ...draft, cost: event.target.value })}
            placeholder={money(resolveWashCost(draft))}
          />
        </label>
        <label>
          效果评分
          <select value={draft.effectRating} onChange={(event) => onChange({ ...draft, effectRating: event.target.value })}>
            <option value="">不评分</option>
            <option value="5">5 - 很满意</option>
            <option value="4">4 - 不错</option>
            <option value="3">3 - 一般</option>
            <option value="2">2 - 不太行</option>
            <option value="1">1 - 翻车</option>
          </select>
        </label>
      </div>
      <div className="two-cols">
        <label>
          人工 / 服务费
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.laborCost}
            onChange={(event) => onChange({ ...draft, laborCost: event.target.value })}
            placeholder="店内服务可填"
          />
        </label>
        <label>
          水电 / 场地费
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.waterElectricityCost}
            onChange={(event) => onChange({ ...draft, waterElectricityCost: event.target.value })}
            placeholder="DIY 可填"
          />
        </label>
      </div>
      {isDiy && (
        <section className="inline-panel">
          <div className="panel-heading-row">
            <div>
              <strong>DIY 药剂 / 耗材</strong>
              <p className="inline-help">记录预洗、正洗、轮毂等药剂的购买价、容量和本次用量。</p>
            </div>
            <button
              className="text-button"
              type="button"
                onClick={() => onChange({ ...draft, products: [...draft.products, createEmptyWashProductUsageDraft()] })}
            >
              添加耗材
            </button>
          </div>
          <div className="product-usage-list">
            {draft.products.map((product) => {
              const estimatedCost = estimateWashProductCost(product);
              const selectedWarehouseProduct = washProducts.find((warehouseProduct) => warehouseProduct.id === product.productId);
              return (
                <div className="product-usage-row" key={product.id}>
                  <label>
                    仓库耗材
                    <select value={product.productId} onChange={(event) => selectWarehouseProduct(product.id, event.target.value)}>
                      <option value="">手动输入 / 当场添加</option>
                      {washProducts.map((warehouseProduct) => (
                        <option key={warehouseProduct.id} value={warehouseProduct.id}>
                          {warehouseProduct.name} · {warehouseProduct.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedWarehouseProduct && (
                    <p className="inline-help">
                      已选择仓库耗材：购买价和总容量由仓库记录提供，本次只需要填写用量、稀释比例和必要备注。
                    </p>
                  )}
                  <div className="two-cols">
                    <label>
                      名称
                      <input
                        value={product.name}
                        onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                        placeholder="例如 PA 预洗液"
                        disabled={Boolean(product.productId)}
                      />
                    </label>
                    <label>
                      所属步骤
                      <select value={product.step} onChange={(event) => updateProduct(product.id, { step: event.target.value })}>
                        {washStepOptions.map((step) => (
                          <option key={step}>{step}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="two-cols">
                    <label>
                      类型
                      <select
                        value={product.category}
                        disabled={Boolean(product.productId)}
                        onChange={(event) => updateProduct(product.id, { category: event.target.value })}
                      >
                        {productCategoryOptions.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      稀释比例
                      <input
                        value={product.dilutionRatio}
                        onChange={(event) => updateProduct(product.id, { dilutionRatio: event.target.value })}
                        placeholder="例如 1:10"
                      />
                    </label>
                  </div>
                  {!product.productId && (
                    <div className="three-cols">
                      <label>
                        购买价
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={product.purchasePrice}
                          onChange={(event) => updateProduct(product.id, { purchasePrice: event.target.value })}
                        />
                      </label>
                      <label>
                        总容量
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={product.capacity}
                          onChange={(event) => updateProduct(product.id, { capacity: event.target.value })}
                        />
                      </label>
                      <label>
                        容量单位
                        <select
                          value={product.capacityUnit}
                          onChange={(event) =>
                            updateProduct(product.id, { capacityUnit: event.target.value as WashProductUsage["capacityUnit"] })
                          }
                        >
                          <option>ml</option>
                          <option>L</option>
                          <option>g</option>
                          <option>kg</option>
                          <option>pcs</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <div className="three-cols">
                    <label>
                      本次用量
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.usedAmount}
                        onChange={(event) => updateProduct(product.id, { usedAmount: event.target.value })}
                      />
                    </label>
                    <label>
                      用量单位
                      <select
                        value={product.usedUnit}
                        onChange={(event) =>
                          updateProduct(product.id, { usedUnit: event.target.value as WashProductUsage["usedUnit"] })
                        }
                      >
                        <option>ml</option>
                        <option>L</option>
                        <option>g</option>
                        <option>pcs</option>
                      </select>
                    </label>
                    <label>
                      本次成本
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.estimatedCost}
                        onChange={(event) => updateProduct(product.id, { estimatedCost: event.target.value })}
                        placeholder={estimatedCost > 0 ? money(estimatedCost) : "可选"}
                      />
                    </label>
                  </div>
                  <div className="record-actions">
                    <span className="muted">
                      估算 {estimatedCost > 0 ? money(estimatedCost) : "待补充价格/容量/用量"}
                    </span>
                    {!product.productId && (
                      <button className="text-button" type="button" onClick={() => createWarehouseProductFromUsage(product)}>
                        加入仓库
                      </button>
                    )}
                    <button className="text-button danger" type="button" onClick={() => removeProduct(product.id)}>
                      移除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="two-cols">
        <label>
          下次建议日期
          <input
            type="date"
            value={draft.nextSuggestedDate}
            onChange={(event) => onChange({ ...draft, nextSuggestedDate: event.target.value })}
          />
        </label>
        <label>
          备注
          <input value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} />
        </label>
      </div>
    </>
  );
}

function WashProductWarehouse({
  deletedWashProducts,
  onAdd,
  onDelete,
  onReplenish,
  onRestore,
  onUpdate,
  washProducts,
  washRecords,
}: {
  deletedWashProducts: WashProduct[];
  onAdd: (product: Omit<WashProduct, "id" | "userId">) => WashProduct | undefined;
  onDelete: (productId: string) => void;
  onReplenish: (productId: string, purchase: WashProductPurchase) => void;
  onRestore: (productId: string) => void;
  onUpdate: (productId: string, product: Omit<WashProduct, "id" | "userId">) => void;
  washProducts: WashProduct[];
  washRecords: WashRecord[];
}) {
  const [draft, setDraft] = useState<WashProductDraft>(() => createEmptyWashProductWarehouseDraft());
  const [formMode, setFormMode] = useState<WashProductFormMode>({ mode: "add", productId: "" });
  const [productView, setProductView] = useState<"active" | "deleted">("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const isDeletedView = productView === "deleted";
  const productsForView = isDeletedView ? deletedWashProducts : washProducts;
  const filteredProducts =
    categoryFilter === "all" ? productsForView : productsForView.filter((product) => product.category === categoryFilter);
  const categoriesInUse = [
    ...new Set(
      [...productCategoryOptions, ...washProducts, ...deletedWashProducts].map((product) =>
        typeof product === "string" ? product : product.category || "其他",
      ),
    ),
  ];

  function submit(event: FormEvent) {
    event.preventDefault();
    const submission = buildWashProductSubmission(
      formMode,
      draft,
      formMode.productId ? washProducts.find((product) => product.id === formMode.productId) : undefined,
    );
    if (!submission) return;

    if (submission.type === "replenish") onReplenish(submission.productId, submission.purchase);
    if (submission.type === "update") onUpdate(submission.productId, submission.product);
    if (submission.type === "add") onAdd(submission.product);

    setDraft(createEmptyWashProductWarehouseDraft());
    setFormMode({ mode: "add", productId: "" });
  }

  function resetForm() {
    setDraft(createEmptyWashProductWarehouseDraft());
    setFormMode({ mode: "add", productId: "" });
  }

  function startEditing(product: WashProduct) {
    setFormMode({ mode: "edit", productId: product.id });
    setDraft(createWashProductDraftFromProduct(product, today()));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startReplenishing(product: WashProduct) {
    setFormMode({ mode: "replenish", productId: product.id });
    setDraft(createWashProductReplenishDraftFromProduct(product, today()));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectExistingProduct(productId: string) {
    const product = washProducts.find((item) => item.id === productId);
    if (!product) {
      resetForm();
      return;
    }
    startReplenishing(product);
  }

  function confirmDelete(product: WashProduct) {
    const confirmed = window.confirm(`确定删除耗材“${product.name}”吗？删除后可以在“已删除”里恢复，历史洗车记录不会丢。`);
    if (confirmed) onDelete(product.id);
  }

  return (
    <section className="panel stack">
      <div className="section-title">
        <Sparkles size={17} />
        <span>洗车耗材仓库</span>
      </div>
      <form className="stack warehouse-form" onSubmit={submit}>
        <label>
          操作
          <select
            value={formMode.mode === "replenish" ? formMode.productId : ""}
            onChange={(event) => selectExistingProduct(event.target.value)}
          >
            <option value="">新增药剂 / 耗材</option>
            {washProducts.map((product) => (
              <option key={product.id} value={product.id}>
                补充：{product.name}
              </option>
            ))}
          </select>
        </label>
        {formMode.mode === "edit" && (
          <p className="inline-help">正在编辑耗材。购买价、容量、单位会更新最近一次购买记录；如果要追加新购买，请使用“补货”。</p>
        )}
        {formMode.mode === "replenish" && (
          <p className="inline-help">正在给已有耗材补货。本次保存会追加一条新的购买历史。</p>
        )}
        <div className="two-cols">
          <label>
            名称
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            品牌
            <input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} />
          </label>
        </div>
        <div className="two-cols">
          <label>
            类型
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              {productCategoryOptions.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            购买日期
            <input
              type="date"
              value={draft.purchaseDate}
              onChange={(event) => setDraft({ ...draft, purchaseDate: event.target.value })}
            />
          </label>
        </div>
        <div className="three-cols">
          <label>
            购买价（可选）
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.purchasePrice}
              onChange={(event) => setDraft({ ...draft, purchasePrice: event.target.value })}
            />
          </label>
          <label>
            容量（可选）
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.capacity}
              onChange={(event) => setDraft({ ...draft, capacity: event.target.value })}
            />
          </label>
          <label>
            单位
            <select
              value={draft.capacityUnit}
              onChange={(event) => setDraft({ ...draft, capacityUnit: event.target.value as WashProductPurchase["capacityUnit"] })}
            >
              <option>ml</option>
              <option>L</option>
              <option>g</option>
              <option>kg</option>
              <option>pcs</option>
            </select>
          </label>
        </div>
        <label>
          备注
          <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </label>
        <div className="form-actions">
          <button className="secondary-button" type="submit">
            {formMode.mode === "edit" ? "保存编辑" : formMode.mode === "replenish" ? "记录补货" : "加入仓库"}
          </button>
          {formMode.mode !== "add" && (
            <button className="ghost-button" type="button" onClick={resetForm}>
              取消
            </button>
          )}
        </div>
      </form>
      <div className="warehouse-toolbar">
        <div className="segmented-buttons compact" aria-label="耗材状态">
          <button
            className={!isDeletedView ? "filter-button active" : "filter-button"}
            type="button"
            onClick={() => setProductView("active")}
          >
            正常 {washProducts.length}
          </button>
          <button
            className={isDeletedView ? "filter-button active" : "filter-button"}
            type="button"
            onClick={() => setProductView("deleted")}
          >
            已删除 {deletedWashProducts.length}
          </button>
        </div>
        <label className="warehouse-filter">
          类型筛选
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">全部类型</option>
            {categoriesInUse.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="warehouse-list">
        {filteredProducts.length === 0 ? (
          <p className="empty">
            {isDeletedView
              ? "暂无已删除耗材。"
              : "还没有符合筛选条件的仓库耗材。可以先添加常用的预洗液、正洗液、轮毂清洁剂。"}
          </p>
        ) : (
          filteredProducts.map((product) => {
            const stats = calculateWashProductInventory(product, washRecords);
            const latestPurchase = product.purchases.at(-1);
            return (
              <div className="warehouse-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {product.brand ? `${product.brand} · ` : ""}
                    {product.category} · {product.purchases.length} 次购买
                  </span>
                  {latestPurchase && (
                    <span>
                      最近：{latestPurchase.date}
                      {latestPurchase.purchasePrice != null ? ` · ${money(latestPurchase.purchasePrice)}` : ""}
                      {latestPurchase.capacity != null ? ` / ${latestPurchase.capacity}${latestPurchase.capacityUnit ?? ""}` : ""}
                    </span>
                  )}
                </div>
                <div className="warehouse-stock">
                  {stats.hasCapacity ? (
                    <>
                      <strong>
                        {number(stats.remaining, 1)} {stats.unit}
                      </strong>
                      <span>
                        已用 {number(stats.used, 1)} {stats.unit} / 购入 {number(stats.purchased, 1)} {stats.unit}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>未记录容量</strong>
                      <span>{stats.used > 0 ? `历史用量 ${number(stats.used, 1)} ${stats.unit}` : "适合毛巾、刷子等非消耗容量耗材"}</span>
                    </>
                  )}
                </div>
                <div className="warehouse-row-actions">
                  {isDeletedView ? (
                    <button className="text-button" type="button" onClick={() => onRestore(product.id)}>
                      恢复
                    </button>
                  ) : (
                    <>
                      <button className="text-button" type="button" onClick={() => startEditing(product)}>
                        编辑
                      </button>
                      <button className="text-button" type="button" onClick={() => startReplenishing(product)}>
                        补货
                      </button>
                      <button className="text-button danger" type="button" onClick={() => confirmDelete(product)}>
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Records({ fuelRecords, washRecords }: { fuelRecords: FuelRecord[]; washRecords: WashRecord[] }) {
  return (
    <section className="records-grid">
      <FuelRecordsPanel fuelRecords={fuelRecords} limit={6} />
      <WashRecordsPanel washRecords={washRecords} limit={6} />
    </section>
  );
}

function fuelRecordTitle(record: FuelRecord) {
  return `${record.fuelGrade ? `${record.fuelGrade} · ` : ""}${record.volume} L · ${money(recordCost(record))}`;
}

function fuelRecordMeta(record: FuelRecord) {
  return [
    record.date,
    record.odometer != null ? `${record.odometer} km` : "",
    record.station,
    record.fuelLevelBefore != null || record.fuelLevelAfter != null
      ? `油位 ${record.fuelLevelBefore ?? "-"}% -> ${record.fuelLevelAfter ?? "-"}%`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function FuelRecordsPanel({
  deletedFuelRecords = [],
  emptyText = "暂无加油记录",
  fuelRecords,
  stationRecords,
  limit,
  onDelete,
  onRestore,
  onUpdate,
}: {
  deletedFuelRecords?: FuelRecord[];
  emptyText?: string;
  fuelRecords: FuelRecord[];
  stationRecords?: FuelRecord[];
  limit: number;
  onDelete?: (recordId: string) => void;
  onRestore?: (recordId: string) => void;
  onUpdate?: (recordId: string, record: Omit<FuelRecord, "id" | "userId">) => void;
}) {
  const [editingId, setEditingId] = useState<string>("");
  const [recordView, setRecordView] = useState<"active" | "deleted">("active");
  const isDeletedView = recordView === "deleted";
  const recordsToShow = isDeletedView ? deletedFuelRecords : fuelRecords;
  const visibleRecords = recordsToShow.slice(0, limit);
  const resolvedEmptyText = isDeletedView ? "暂无已删除加油记录" : emptyText;

  function confirmDelete(record: FuelRecord) {
    if (!onDelete) return;
    const confirmed = window.confirm(`确定删除 ${fuelRecordTitle(record)} 吗？删除后可以在“已删除”里恢复。`);
    if (confirmed) onDelete(record.id);
  }

  return (
    <div className="panel">
      <div className="panel-heading-row">
        <div className="section-title">
          <Fuel size={17} />
          <span>{limit > 6 ? "加油记录" : "最近加油"}</span>
        </div>
        {onDelete && onRestore && (
          <div className="segmented-buttons compact" aria-label="加油记录状态">
            <button
              className={!isDeletedView ? "filter-button active" : "filter-button"}
              type="button"
              onClick={() => {
                setRecordView("active");
                setEditingId("");
              }}
            >
              正常 {fuelRecords.length}
            </button>
            <button
              className={isDeletedView ? "filter-button active" : "filter-button"}
              type="button"
              onClick={() => {
                setRecordView("deleted");
                setEditingId("");
              }}
            >
              已删除 {deletedFuelRecords.length}
            </button>
          </div>
        )}
      </div>
      {visibleRecords.length === 0 ? (
        <p className="empty">{resolvedEmptyText}</p>
      ) : (
        <ul className="record-list">
          {visibleRecords.map((record) => (
            <li key={record.id}>
              {editingId === record.id && onUpdate && !isDeletedView ? (
                <FuelRecordEditor
                  fuelRecords={stationRecords ?? fuelRecords}
                  record={record}
                  onCancel={() => setEditingId("")}
                  onSave={(nextRecord) => {
                    onUpdate(record.id, nextRecord);
                    setEditingId("");
                  }}
                />
              ) : (
                <>
                  <div className="record-row-header">
                    <div>
                      <strong>{fuelRecordTitle(record)}</strong>
                      <span>{fuelRecordMeta(record)}</span>
                    </div>
                    {isDeletedView ? (
                      onRestore && (
                        <button className="text-button" type="button" onClick={() => onRestore(record.id)}>
                          恢复
                        </button>
                      )
                    ) : (
                      <div className="record-actions">
                        {onUpdate && (
                          <button className="text-button" type="button" onClick={() => setEditingId(record.id)}>
                            编辑
                          </button>
                        )}
                        {onDelete && (
                          <button className="text-button danger" type="button" onClick={() => confirmDelete(record)}>
                            删除
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FuelRecordEditor({
  fuelRecords,
  record,
  onCancel,
  onSave,
}: {
  fuelRecords: FuelRecord[];
  record: FuelRecord;
  onCancel: () => void;
  onSave: (record: Omit<FuelRecord, "id" | "userId">) => void;
}) {
  const [draft, setDraft] = useState<FuelRecordDraft>(() => createFuelDraft(record, fuelGrades));
  const totalCost = Number(draft.volume) * Number(draft.pricePerUnit);
  const paidAmount = draft.paidAmount ? Number(draft.paidAmount) : totalCost;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.volume || !draft.pricePerUnit) return;
    onSave(buildFuelRecord(record, draft));
  }

  return (
    <form className="edit-record-form" onSubmit={submit}>
      <div className="edit-record-title">
        <strong>编辑加油记录</strong>
        <span>{record.date}</span>
      </div>
      <div className="two-cols">
        <label>
          日期
          <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </label>
        <label>
          加油时总里程 km
          <input
            type="number"
            min="0"
            step="0.1"
            value={draft.odometer}
            onChange={(event) => setDraft({ ...draft, odometer: event.target.value })}
            placeholder="可选"
          />
        </label>
      </div>
      <div className="two-cols">
        <label>
          油品
          <select value={draft.fuelGrade} onChange={(event) => setDraft({ ...draft, fuelGrade: event.target.value })}>
            {fuelGrades.map((grade) => (
              <option key={grade}>{grade}</option>
            ))}
          </select>
        </label>
        {draft.fuelGrade === "其他" ? (
          <label>
            自定义油品
            <input
              value={draft.customFuelGrade}
              onChange={(event) => setDraft({ ...draft, customFuelGrade: event.target.value })}
              placeholder="例如 V-Power 98"
            />
          </label>
        ) : (
          <FuelStationField
            fuelRecords={fuelRecords}
            vehicleId={record.vehicleId}
            value={draft.station}
            onChange={(station) => setDraft({ ...draft, station })}
          />
        )}
      </div>
      {draft.fuelGrade === "其他" && (
        <FuelStationField
          fuelRecords={fuelRecords}
          vehicleId={record.vehicleId}
          value={draft.station}
          onChange={(station) => setDraft({ ...draft, station })}
        />
      )}
      <div className="two-cols">
        <label>
          升数 L
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={draft.volume}
            onChange={(event) => setDraft({ ...draft, volume: event.target.value })}
          />
        </label>
        <label>
          表显单价
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={draft.pricePerUnit}
            onChange={(event) => setDraft({ ...draft, pricePerUnit: event.target.value })}
          />
        </label>
      </div>
      <div className="two-cols">
        <label>
          实付金额
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.paidAmount}
            onChange={(event) => setDraft({ ...draft, paidAmount: event.target.value })}
            placeholder={money(totalCost || 0)}
          />
        </label>
        <label>
          加油后油位 %
          <input
            type="number"
            min="0"
            max="100"
            value={draft.fuelLevelAfter}
            onChange={(event) => setDraft({ ...draft, fuelLevelAfter: event.target.value })}
            placeholder={draft.fullTank ? "100" : "可选"}
          />
        </label>
      </div>
      <label>
        加油前油位 %
        <input
          type="number"
          min="0"
          max="100"
          value={draft.fuelLevelBefore}
          onChange={(event) => setDraft({ ...draft, fuelLevelBefore: event.target.value })}
          placeholder="例如 20"
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.fullTank}
          onChange={(event) => setDraft({ ...draft, fullTank: event.target.checked })}
        />
        加满
      </label>
      <div className="form-actions">
        <button className="primary-button" type="submit">
          保存 · {money(paidAmount || 0)}
        </button>
        <button className="ghost-button" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

function washTypeLabel(type: WashType | undefined) {
  return washTypeOptions.find((option) => option.id === type)?.label ?? "洗车";
}

function washRecordTitle(record: WashRecord) {
  return `${washTypeLabel(record.washType)} · ${money(record.cost)}`;
}

function washRecordMeta(record: WashRecord) {
  return [
    record.date,
    record.odometer != null ? `${record.odometer} km` : "",
    record.shopName,
    record.items.length > 0 ? record.items.join(" / ") : "",
    record.effectRating ? `评分 ${record.effectRating}/5` : "",
    record.products && record.products.length > 0 ? `${record.products.length} 个耗材` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function WashRecordsPanel({
  deletedWashRecords = [],
  limit,
  onDelete,
  onCreateProduct,
  onRestore,
  onUpdate,
  washProducts = [],
  washRecords,
}: {
  deletedWashRecords?: WashRecord[];
  limit: number;
  onDelete?: (recordId: string) => void;
  onCreateProduct?: (product: Omit<WashProduct, "id" | "userId">) => WashProduct | undefined;
  onRestore?: (recordId: string) => void;
  onUpdate?: (recordId: string, record: Omit<WashRecord, "id" | "userId">) => void;
  washProducts?: WashProduct[];
  washRecords: WashRecord[];
}) {
  const [editingId, setEditingId] = useState("");
  const [recordView, setRecordView] = useState<"active" | "deleted">("active");
  const isDeletedView = recordView === "deleted";
  const recordsToShow = isDeletedView ? deletedWashRecords : washRecords;
  const visibleRecords = recordsToShow.slice(0, limit);

  function confirmDelete(record: WashRecord) {
    if (!onDelete) return;
    const confirmed = window.confirm(`确定删除 ${washRecordTitle(record)} 吗？删除后可以在“已删除”里恢复。`);
    if (confirmed) onDelete(record.id);
  }

  return (
    <div className="panel">
      <div className="panel-heading-row">
        <div className="section-title">
          <Sparkles size={17} />
          <span>{limit > 6 ? "洗车记录" : "最近洗车"}</span>
        </div>
        {onDelete && onRestore && (
          <div className="segmented-buttons compact" aria-label="洗车记录状态">
            <button
              className={!isDeletedView ? "filter-button active" : "filter-button"}
              type="button"
              onClick={() => {
                setRecordView("active");
                setEditingId("");
              }}
            >
              正常 {washRecords.length}
            </button>
            <button
              className={isDeletedView ? "filter-button active" : "filter-button"}
              type="button"
              onClick={() => {
                setRecordView("deleted");
                setEditingId("");
              }}
            >
              已删除 {deletedWashRecords.length}
            </button>
          </div>
        )}
      </div>
      {visibleRecords.length === 0 ? (
        <p className="empty">{isDeletedView ? "暂无已删除洗车记录" : "暂无洗车记录"}</p>
      ) : (
        <ul className="record-list">
          {visibleRecords.map((record) => (
            <li key={record.id}>
              {editingId === record.id && onUpdate && !isDeletedView ? (
                <WashRecordEditor
                  onCreateProduct={onCreateProduct}
                  record={record}
                  onCancel={() => setEditingId("")}
                  onSave={(nextRecord) => {
                    onUpdate(record.id, nextRecord);
                    setEditingId("");
                  }}
                  washProducts={washProducts}
                />
              ) : (
                <div className="record-row-header">
                  <div>
                    <strong>{washRecordTitle(record)}</strong>
                    <span>{washRecordMeta(record)}</span>
                  </div>
                  {isDeletedView ? (
                    onRestore && (
                      <button className="text-button" type="button" onClick={() => onRestore(record.id)}>
                        恢复
                      </button>
                    )
                  ) : (
                    <div className="record-actions">
                      {onUpdate && (
                        <button className="text-button" type="button" onClick={() => setEditingId(record.id)}>
                          编辑
                        </button>
                      )}
                      {onDelete && (
                        <button className="text-button danger" type="button" onClick={() => confirmDelete(record)}>
                          删除
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WashRecordEditor({
  record,
  onCancel,
  onCreateProduct,
  onSave,
  washProducts,
}: {
  record: WashRecord;
  onCancel: () => void;
  onCreateProduct?: (product: Omit<WashProduct, "id" | "userId">) => WashProduct | undefined;
  onSave: (record: Omit<WashRecord, "id" | "userId">) => void;
  washProducts?: WashProduct[];
}) {
  const [draft, setDraft] = useState<WashRecordDraft>(() => createWashDraft(record));

  return (
    <form
      className="edit-record-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(buildWashRecord(record.vehicleId, draft));
      }}
    >
      <div className="edit-record-title">
        <strong>编辑洗车记录</strong>
        <span>{record.date}</span>
      </div>
      <WashRecordFields
        draft={draft}
        onChange={setDraft}
        onCreateProduct={onCreateProduct ?? (() => undefined)}
        washProducts={washProducts ?? []}
      />
      <div className="form-actions">
        <button className="primary-button" type="submit">
          保存 · {money(resolveWashCost(draft))}
        </button>
        <button className="ghost-button" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
