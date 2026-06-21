import {
  Car,
  Droplets,
  Fuel,
  Info,
  LogOut,
  Plus,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type EnergyType = "汽油" | "柴油" | "混动" | "纯电" | "增程";

type User = {
  id: string;
  name: string;
  email: string;
};

type Vehicle = {
  id: string;
  userId: string;
  nickname: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  energyType: EnergyType;
  tankSize?: number;
  batterySize?: number;
};

type FuelRecord = {
  id: string;
  userId: string;
  vehicleId: string;
  date: string;
  odometer?: number;
  volume: number;
  pricePerUnit: number;
  fuelGrade?: string;
  paidAmount?: number;
  fuelLevelBefore?: number;
  fuelLevelAfter?: number;
  totalCost: number;
  station: string;
  fullTank: boolean;
};

type WashRecord = {
  id: string;
  userId: string;
  vehicleId: string;
  date: string;
  odometer: number;
  items: string[];
  minutes: number;
  cost: number;
  notes: string;
};

type Store = {
  users: User[];
  vehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
  currentUserId?: string;
};

type AppTab = "overview" | "fuel" | "wash" | "vehicles";

const STORAGE_KEY = "car-utils-store-v1";

const vehiclePresets = [
  { brand: "Toyota", model: "Camry", energyType: "汽油" as EnergyType, tankSize: 60 },
  { brand: "Honda", model: "CR-V", energyType: "混动" as EnergyType, tankSize: 57 },
  { brand: "Tesla", model: "Model 3", energyType: "纯电" as EnergyType, batterySize: 60 },
  { brand: "BYD", model: "秦 PLUS DM-i", energyType: "混动" as EnergyType, tankSize: 48 },
  { brand: "Li Auto", model: "L7", energyType: "增程" as EnergyType, tankSize: 65, batterySize: 42 },
];

const fuelGrades = ["92#", "95#", "98#", "爱跑98", "0#柴油", "其他"];

const emptyStore: Store = {
  users: [],
  vehicles: [],
  fuelRecords: [],
  washRecords: [],
};

function normalizeStore(value: unknown): Store {
  if (!value || typeof value !== "object") return emptyStore;

  const store = value as Partial<Store>;

  return {
    users: Array.isArray(store.users) ? store.users : [],
    vehicles: Array.isArray(store.vehicles) ? store.vehicles : [],
    fuelRecords: Array.isArray(store.fuelRecords) ? store.fuelRecords : [],
    washRecords: Array.isArray(store.washRecords) ? store.washRecords : [],
    currentUserId: typeof store.currentUserId === "string" ? store.currentUserId : undefined,
  };
}

function loadStore(): Store {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStore;

  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return emptyStore;
  }
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
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

function recordCost(record: FuelRecord) {
  return record.paidAmount ?? record.totalCost;
}

function paidUnitPrice(record: FuelRecord) {
  if (record.volume <= 0) return record.pricePerUnit;
  return recordCost(record) / record.volume;
}

function compactDate(date: string) {
  const [, month, day] = date.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function stationName(record: FuelRecord) {
  return record.station.trim() || "未记录加油站";
}

export function App() {
  const [store, setStore] = useState<Store>(() => loadStore());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const currentUser = store.users.find((user) => user.id === store.currentUserId);

  function commit(next: Store) {
    setStore(next);
    saveStore(next);
  }

  function login(name: string, email: string) {
    const trimmedEmail = email.trim().toLowerCase();
    const existingUser = store.users.find((user) => user.email === trimmedEmail);
    const user =
      existingUser ??
      ({
        id: makeId("user"),
        name: name.trim() || trimmedEmail.split("@")[0] || "车主",
        email: trimmedEmail,
      } satisfies User);

    const users = existingUser ? store.users : [...store.users, user];
    commit({ ...store, users, currentUserId: user.id });
  }

  function logout() {
    commit({ ...store, currentUserId: undefined });
    setSelectedVehicleId("");
  }

  function addVehicle(vehicle: Omit<Vehicle, "id" | "userId">) {
    if (!currentUser) return;
    const nextVehicle = { ...vehicle, id: makeId("vehicle"), userId: currentUser.id };
    commit({ ...store, vehicles: [...store.vehicles, nextVehicle] });
    setSelectedVehicleId(nextVehicle.id);
    setActiveTab("overview");
  }

  function addFuelRecord(record: Omit<FuelRecord, "id" | "userId">) {
    if (!currentUser) return;
    commit({
      ...store,
      fuelRecords: [...store.fuelRecords, { ...record, id: makeId("fuel"), userId: currentUser.id }],
    });
  }

  function updateFuelRecord(recordId: string, record: Omit<FuelRecord, "id" | "userId">) {
    if (!currentUser) return;
    commit({
      ...store,
      fuelRecords: store.fuelRecords.map((currentRecord) =>
        currentRecord.id === recordId && currentRecord.userId === currentUser.id
          ? { ...record, id: currentRecord.id, userId: currentRecord.userId }
          : currentRecord,
      ),
    });
  }

  function addWashRecord(record: Omit<WashRecord, "id" | "userId">) {
    if (!currentUser) return;
    commit({
      ...store,
      washRecords: [...store.washRecords, { ...record, id: makeId("wash"), userId: currentUser.id }],
    });
  }

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  const userVehicles = store.vehicles.filter((vehicle) => vehicle.userId === currentUser.id);
  const activeVehicleId = selectedVehicleId || userVehicles[0]?.id || "";
  const activeVehicle = userVehicles.find((vehicle) => vehicle.id === activeVehicleId);
  const fuelRecords = store.fuelRecords
    .filter((record) => record.userId === currentUser.id && record.vehicleId === activeVehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const washRecords = store.washRecords
    .filter((record) => record.userId === currentUser.id && record.vehicleId === activeVehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Car Utils</p>
          <h1>车辆生活账本</h1>
        </div>
        <div className="user-chip">
          <UserRound size={18} />
          <span>{currentUser.name}</span>
          <button className="icon-button" aria-label="退出登录" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="section-title">
            <Car size={18} />
            <span>我的车辆</span>
          </div>
          <div className="vehicle-list">
            {userVehicles.map((vehicle) => (
              <button
                className={vehicle.id === activeVehicleId ? "vehicle-card active" : "vehicle-card"}
                key={vehicle.id}
                onClick={() => setSelectedVehicleId(vehicle.id)}
              >
                <strong>{vehicle.nickname}</strong>
                <span>
                  {vehicle.brand} {vehicle.model}
                </span>
                <small>{vehicle.energyType}</small>
              </button>
            ))}
            {userVehicles.length === 0 && <p className="empty">还没有车辆，先添加一台开始记录。</p>}
          </div>
          <button className="secondary-button full-width" type="button" onClick={() => setActiveTab("vehicles")}>
            管理车辆
          </button>
        </aside>

        <div className="content">
          {activeVehicle || activeTab === "vehicles" ? (
            <>
              <TabBar activeTab={activeTab} onChange={setActiveTab} />
              {activeTab === "overview" && activeVehicle && (
                <>
                  <Dashboard vehicle={activeVehicle} fuelRecords={fuelRecords} washRecords={washRecords} />
                  <Records fuelRecords={fuelRecords} washRecords={washRecords} />
                </>
              )}
              {activeTab === "fuel" && activeVehicle && (
                <section className="tab-stack">
                  <FuelInsights vehicle={activeVehicle} fuelRecords={fuelRecords} />
                  <div className="tab-layout">
                    <FuelForm vehicle={activeVehicle} onAdd={addFuelRecord} />
                    <FuelRecordsPanel fuelRecords={fuelRecords} limit={12} onUpdate={updateFuelRecord} />
                  </div>
                </section>
              )}
              {activeTab === "wash" && activeVehicle && (
                <section className="tab-layout">
                  <WashForm vehicle={activeVehicle} onAdd={addWashRecord} />
                  <WashRecordsPanel washRecords={washRecords} limit={12} />
                </section>
              )}
              {activeTab === "vehicles" && (
                <section className="tab-layout">
                  <VehicleForm onAdd={addVehicle} />
                  <VehicleSummary vehicles={userVehicles} activeVehicleId={activeVehicleId} onSelect={setSelectedVehicleId} />
                </section>
              )}
            </>
          ) : (
            <div className="blank-state">
              <Wrench size={42} />
              <h2>先绑定你的第一台车</h2>
              <p>添加品牌、型号、能源类型和车牌后，加油和洗车数据都会按车辆独立统计。</p>
              <button className="primary-button" type="button" onClick={() => setActiveTab("vehicles")}>
                添加车辆
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: AppTab; onChange: (tab: AppTab) => void }) {
  const tabs: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "概览", icon: <Car size={16} /> },
    { id: "fuel", label: "加油", icon: <Fuel size={16} /> },
    { id: "wash", label: "洗车", icon: <Sparkles size={16} /> },
    { id: "vehicles", label: "车辆", icon: <Wrench size={16} /> },
  ];

  return (
    <nav className="tabs" aria-label="功能导航">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "tab active" : "tab"}
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
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

function VehicleForm({ onAdd }: { onAdd: (vehicle: Omit<Vehicle, "id" | "userId">) => void }) {
  const [presetKey, setPresetKey] = useState("");
  const [vehicle, setVehicle] = useState<Omit<Vehicle, "id" | "userId">>({
    nickname: "",
    brand: "",
    model: "",
    year: new Date().getFullYear().toString(),
    plate: "",
    energyType: "汽油",
    tankSize: 55,
    batterySize: undefined,
  });

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
    onAdd(vehicle);
    setPresetKey("");
    setVehicle({
      nickname: "",
      brand: "",
      model: "",
      year: new Date().getFullYear().toString(),
      plate: "",
      energyType: "汽油",
      tankSize: 55,
      batterySize: undefined,
    });
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <div className="section-title">
        <Plus size={17} />
        <span>添加车辆</span>
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
      <label>
        车牌 / 备注
        <input value={vehicle.plate} onChange={(event) => setVehicle({ ...vehicle, plate: event.target.value })} />
      </label>
      <button className="secondary-button" type="submit">
        添加车辆
      </button>
    </form>
  );
}

function VehicleSummary({
  vehicles,
  activeVehicleId,
  onSelect,
}: {
  vehicles: Vehicle[];
  activeVehicleId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <Car size={17} />
        <span>已绑定车辆</span>
      </div>
      <div className="vehicle-summary-list">
        {vehicles.map((vehicle) => (
          <button
            className={vehicle.id === activeVehicleId ? "summary-row active" : "summary-row"}
            key={vehicle.id}
            type="button"
            onClick={() => onSelect(vehicle.id)}
          >
            <strong>{vehicle.nickname}</strong>
            <span>
              {vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.energyType}
              {vehicle.energyType !== "纯电" && vehicle.tankSize ? ` · ${vehicle.tankSize}L油箱` : ""}
              {vehicle.plate ? ` · ${vehicle.plate}` : ""}
            </span>
          </button>
        ))}
        {vehicles.length === 0 && <p className="empty">还没有绑定车辆。</p>}
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
    const fuelCost = fuelRecords.reduce((sum, record) => sum + (record.paidAmount ?? record.totalCost), 0);
    const fuelVolume = fuelRecords.reduce((sum, record) => sum + record.volume, 0);
    const washCost = washRecords.reduce((sum, record) => sum + record.cost, 0);
    const recordsWithOdometer = fuelRecords.filter((record) => typeof record.odometer === "number");
    const consumptionVolume = recordsWithOdometer.reduce((sum, record) => sum + record.volume, 0);
    const sortedFuel = [...recordsWithOdometer].sort((a, b) => a.odometer! - b.odometer!);
    const distance =
      sortedFuel.length >= 2 ? sortedFuel[sortedFuel.length - 1].odometer! - sortedFuel[0].odometer! : 0;
    const avgConsumption = distance > 0 ? (consumptionVolume / distance) * 100 : 0;

    return { fuelCost, fuelVolume, washCost, distance, avgConsumption };
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

type ChartPoint = {
  label: string;
  value: number;
};

type StationSummary = {
  station: string;
  recordCount: number;
  avgUnitPrice: number;
  totalVolume: number;
};

type StationPerformance = StationSummary & {
  grade: string;
  intervals: number;
  avgKmPerLiter: number;
  avgConsumption: number;
  relativeToAverage: number;
};

type FuelRecordDraft = {
  date: string;
  odometer: string;
  fuelGrade: string;
  customFuelGrade: string;
  volume: string;
  pricePerUnit: string;
  paidAmount: string;
  fuelLevelBefore: string;
  fuelLevelAfter: string;
  station: string;
  fullTank: boolean;
};

function FuelInsights({ vehicle, fuelRecords }: { vehicle: Vehicle; fuelRecords: FuelRecord[] }) {
  const insights = useMemo(() => {
    const ordered = [...fuelRecords].sort((a, b) => a.date.localeCompare(b.date));
    const recent = ordered.slice(-12);
    const pricePoints = recent.map((record) => ({
      label: compactDate(record.date),
      value: paidUnitPrice(record),
    }));
    const costPoints = recent.map((record) => ({
      label: compactDate(record.date),
      value: recordCost(record),
    }));

    const stationSummaryMap = new Map<string, { count: number; unitPriceTotal: number; volume: number }>();
    const qualitySummaryMap = new Map<string, { count: number; unitPriceTotal: number; volume: number }>();
    ordered.forEach((record) => {
      const station = stationName(record);
      const grade = record.fuelGrade || "未记录油品";
      const qualityKey = `${station}__${grade}`;
      const current = stationSummaryMap.get(station) ?? { count: 0, unitPriceTotal: 0, volume: 0 };
      current.count += 1;
      current.unitPriceTotal += paidUnitPrice(record);
      current.volume += record.volume;
      stationSummaryMap.set(station, current);

      const currentQuality = qualitySummaryMap.get(qualityKey) ?? { count: 0, unitPriceTotal: 0, volume: 0 };
      currentQuality.count += 1;
      currentQuality.unitPriceTotal += paidUnitPrice(record);
      currentQuality.volume += record.volume;
      qualitySummaryMap.set(qualityKey, currentQuality);
    });

    const stationSummaries: StationSummary[] = [...stationSummaryMap.entries()]
      .map(([station, summary]) => ({
        station,
        recordCount: summary.count,
        avgUnitPrice: summary.unitPriceTotal / summary.count,
        totalVolume: summary.volume,
      }))
      .sort((a, b) => b.recordCount - a.recordCount || a.avgUnitPrice - b.avgUnitPrice);

    const tankSize =
      vehicle.energyType !== "纯电" && vehicle.tankSize && vehicle.tankSize > 0 ? vehicle.tankSize : undefined;
    const recordsWithOdometer = ordered
      .filter((record) => typeof record.odometer === "number")
      .sort((a, b) => a.odometer! - b.odometer!);
    const performanceMap = new Map<string, { intervals: number; distanceTotal: number; consumedTotal: number }>();

    if (tankSize) {
      for (let index = 1; index < recordsWithOdometer.length; index += 1) {
        const previous = recordsWithOdometer[index - 1];
        const current = recordsWithOdometer[index];
        const previousStation = previous.station.trim();
        const previousGrade = previous.fuelGrade || "未记录油品";
        const distance = current.odometer! - previous.odometer!;
        const hasFuelLevels = previous.fuelLevelAfter != null && current.fuelLevelBefore != null;

        if (!previousStation || !hasFuelLevels || distance <= 0) continue;

        const consumedVolume = tankSize * ((previous.fuelLevelAfter! - current.fuelLevelBefore!) / 100);
        const consumption = (consumedVolume / distance) * 100;

        if (consumedVolume <= 0 || consumption < 2 || consumption > 30) continue;

        const station = stationName(previous);
        const qualityKey = `${station}__${previousGrade}`;
        const currentPerformance = performanceMap.get(qualityKey) ?? {
          intervals: 0,
          distanceTotal: 0,
          consumedTotal: 0,
        };
        currentPerformance.intervals += 1;
        currentPerformance.distanceTotal += distance;
        currentPerformance.consumedTotal += consumedVolume;
        performanceMap.set(qualityKey, currentPerformance);
      }
    }

    const overallDistance = [...performanceMap.values()].reduce((sum, performance) => sum + performance.distanceTotal, 0);
    const overallConsumed = [...performanceMap.values()].reduce((sum, performance) => sum + performance.consumedTotal, 0);
    const overallKmPerLiter = overallConsumed > 0 ? overallDistance / overallConsumed : 0;
    const stationPerformances: StationPerformance[] = [...performanceMap.entries()]
      .map(([qualityKey, performance]) => {
        const [station, grade] = qualityKey.split("__");
        const summary = qualitySummaryMap.get(qualityKey);
        const avgKmPerLiter = performance.distanceTotal / performance.consumedTotal;
        const avgConsumption = (performance.consumedTotal / performance.distanceTotal) * 100;
        return {
          station,
          grade,
          intervals: performance.intervals,
          avgKmPerLiter,
          avgConsumption,
          relativeToAverage: overallKmPerLiter > 0 ? (avgKmPerLiter / overallKmPerLiter - 1) * 100 : 0,
          recordCount: summary?.count ?? 0,
          avgUnitPrice: summary ? summary.unitPriceTotal / summary.count : 0,
          totalVolume: summary?.volume ?? 0,
        };
      })
      .filter((item) => item.intervals >= 2)
      .sort((a, b) => b.avgKmPerLiter - a.avgKmPerLiter);

    const canCompareStations = stationPerformances.length >= 2;

    return {
      pricePoints,
      costPoints,
      stationSummaries,
      stationPerformances,
      canCompareStations,
      hasTankSize: Boolean(tankSize),
      validIntervalCount: [...performanceMap.values()].reduce((sum, item) => sum + item.intervals, 0),
      overallKmPerLiter,
    };
  }, [fuelRecords, vehicle.energyType, vehicle.tankSize]);

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

  return (
    <div className="chart-card">
      <div className="chart-header">
        <span>{title}</span>
        <strong>
          {latest ? number(latest.value, digits) : "-"} <small>{unit}</small>
        </strong>
      </div>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={left} x2={right} y1={top} y2={top} />
        <line x1={left} x2={right} y1={(top + bottom) / 2} y2={(top + bottom) / 2} />
        <line x1={left} x2={right} y1={bottom} y2={bottom} />
        <polyline points={polylinePoints} />
        {coordinates.map((point) => (
          <circle cx={point.x} cy={point.y} key={`${point.label}-${point.x}`} r="3.5" />
        ))}
      </svg>
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
  vehicle,
  onAdd,
}: {
  vehicle: Vehicle;
  onAdd: (record: Omit<FuelRecord, "id" | "userId">) => void;
}) {
  const [form, setForm] = useState({
    date: today(),
    odometer: "",
    fuelGrade: "95#",
    customFuelGrade: "",
    volume: "",
    pricePerUnit: "",
    paidAmount: "",
    fuelLevelBefore: "",
    fuelLevelAfter: "",
    station: "",
    fullTank: false,
  });

  const totalCost = Number(form.volume) * Number(form.pricePerUnit);
  const paidAmount = form.paidAmount ? Number(form.paidAmount) : totalCost;
  const selectedFuelGrade = form.fuelGrade === "其他" ? form.customFuelGrade.trim() || "其他" : form.fuelGrade;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.volume || !form.pricePerUnit) return;
    onAdd({
      vehicleId: vehicle.id,
      date: form.date,
      odometer: form.odometer ? Number(form.odometer) : undefined,
      volume: Number(form.volume),
      pricePerUnit: Number(form.pricePerUnit),
      fuelGrade: selectedFuelGrade,
      paidAmount,
      fuelLevelBefore: form.fuelLevelBefore ? Number(form.fuelLevelBefore) : undefined,
      fuelLevelAfter: form.fuelLevelAfter ? Number(form.fuelLevelAfter) : undefined,
      totalCost,
      station: form.station,
      fullTank: form.fullTank,
    });
    setForm({
      date: today(),
      odometer: "",
      fuelGrade: form.fuelGrade,
      customFuelGrade: form.customFuelGrade,
      volume: "",
      pricePerUnit: "",
      paidAmount: "",
      fuelLevelBefore: "",
      fuelLevelAfter: "",
      station: "",
      fullTank: false,
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
          <label>
            加油站
            <input value={form.station} onChange={(event) => setForm({ ...form, station: event.target.value })} />
          </label>
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
        <label>
          加油站
          <input value={form.station} onChange={(event) => setForm({ ...form, station: event.target.value })} />
        </label>
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
      <button className="primary-button" type="submit">
        保存加油记录 · {money(paidAmount || 0)}
      </button>
    </form>
  );
}

function WashForm({
  vehicle,
  onAdd,
}: {
  vehicle: Vehicle;
  onAdd: (record: Omit<WashRecord, "id" | "userId">) => void;
}) {
  const [form, setForm] = useState({
    date: today(),
    odometer: "",
    items: "预洗, 正洗, 轮毂",
    minutes: "",
    cost: "",
    notes: "",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.odometer) return;
    onAdd({
      vehicleId: vehicle.id,
      date: form.date,
      odometer: Number(form.odometer),
      items: form.items
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      minutes: Number(form.minutes || 0),
      cost: Number(form.cost || 0),
      notes: form.notes,
    });
    setForm({ date: today(), odometer: "", items: "预洗, 正洗, 轮毂", minutes: "", cost: "", notes: "" });
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <div className="section-title">
        <Sparkles size={17} />
        <span>记录 DIY 洗车</span>
      </div>
      <div className="two-cols">
        <label>
          日期
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </label>
        <label>
          里程 km
          <input
            required
            type="number"
            min="0"
            value={form.odometer}
            onChange={(event) => setForm({ ...form, odometer: event.target.value })}
          />
        </label>
      </div>
      <label>
        项目，逗号分隔
        <input value={form.items} onChange={(event) => setForm({ ...form, items: event.target.value })} />
      </label>
      <div className="two-cols">
        <label>
          用时分钟
          <input
            type="number"
            min="0"
            value={form.minutes}
            onChange={(event) => setForm({ ...form, minutes: event.target.value })}
          />
        </label>
        <label>
          材料成本
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={(event) => setForm({ ...form, cost: event.target.value })}
          />
        </label>
      </div>
      <label>
        备注
        <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </label>
      <button className="primary-button" type="submit">
        保存洗车记录
      </button>
    </form>
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

function createFuelDraft(record: FuelRecord): FuelRecordDraft {
  const knownFuelGrade = record.fuelGrade && fuelGrades.includes(record.fuelGrade);

  return {
    date: record.date,
    odometer: record.odometer != null ? String(record.odometer) : "",
    fuelGrade: knownFuelGrade ? record.fuelGrade! : record.fuelGrade ? "其他" : "95#",
    customFuelGrade: knownFuelGrade ? "" : record.fuelGrade ?? "",
    volume: String(record.volume),
    pricePerUnit: String(record.pricePerUnit),
    paidAmount: record.paidAmount != null ? String(record.paidAmount) : "",
    fuelLevelBefore: record.fuelLevelBefore != null ? String(record.fuelLevelBefore) : "",
    fuelLevelAfter: record.fuelLevelAfter != null ? String(record.fuelLevelAfter) : "",
    station: record.station,
    fullTank: record.fullTank,
  };
}

function buildFuelRecord(record: FuelRecord, draft: FuelRecordDraft): Omit<FuelRecord, "id" | "userId"> {
  const volume = Number(draft.volume);
  const pricePerUnit = Number(draft.pricePerUnit);
  const totalCost = volume * pricePerUnit;
  const fuelGrade = draft.fuelGrade === "其他" ? draft.customFuelGrade.trim() || "其他" : draft.fuelGrade;

  return {
    vehicleId: record.vehicleId,
    date: draft.date,
    odometer: draft.odometer ? Number(draft.odometer) : undefined,
    volume,
    pricePerUnit,
    fuelGrade,
    paidAmount: draft.paidAmount ? Number(draft.paidAmount) : undefined,
    fuelLevelBefore: draft.fuelLevelBefore ? Number(draft.fuelLevelBefore) : undefined,
    fuelLevelAfter: draft.fuelLevelAfter ? Number(draft.fuelLevelAfter) : undefined,
    totalCost,
    station: draft.station,
    fullTank: draft.fullTank,
  };
}

function FuelRecordsPanel({
  fuelRecords,
  limit,
  onUpdate,
}: {
  fuelRecords: FuelRecord[];
  limit: number;
  onUpdate?: (recordId: string, record: Omit<FuelRecord, "id" | "userId">) => void;
}) {
  const [editingId, setEditingId] = useState<string>("");
  const visibleRecords = fuelRecords.slice(0, limit);

  return (
    <div className="panel">
      <div className="section-title">
        <Fuel size={17} />
        <span>{limit > 6 ? "加油记录" : "最近加油"}</span>
      </div>
      {visibleRecords.length === 0 ? (
        <p className="empty">暂无加油记录</p>
      ) : (
        <ul className="record-list">
          {visibleRecords.map((record) => (
            <li key={record.id}>
              {editingId === record.id && onUpdate ? (
                <FuelRecordEditor
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
                    {onUpdate && (
                      <button className="text-button" type="button" onClick={() => setEditingId(record.id)}>
                        编辑
                      </button>
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
  record,
  onCancel,
  onSave,
}: {
  record: FuelRecord;
  onCancel: () => void;
  onSave: (record: Omit<FuelRecord, "id" | "userId">) => void;
}) {
  const [draft, setDraft] = useState<FuelRecordDraft>(() => createFuelDraft(record));
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
          <label>
            加油站
            <input value={draft.station} onChange={(event) => setDraft({ ...draft, station: event.target.value })} />
          </label>
        )}
      </div>
      {draft.fuelGrade === "其他" && (
        <label>
          加油站
          <input value={draft.station} onChange={(event) => setDraft({ ...draft, station: event.target.value })} />
        </label>
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

function WashRecordsPanel({ washRecords, limit }: { washRecords: WashRecord[]; limit: number }) {
  return (
    <div className="panel">
      <div className="section-title">
        <Sparkles size={17} />
        <span>{limit > 6 ? "洗车记录" : "最近洗车"}</span>
      </div>
      <RecordList
        empty="暂无洗车记录"
        rows={washRecords.slice(0, limit).map((record) => ({
          id: record.id,
          title: `${record.items.join(" / ") || "DIY 洗车"} · ${money(record.cost)}`,
          meta: `${record.date} · ${record.odometer} km · ${record.minutes} 分钟`,
        }))}
      />
    </div>
  );
}

function RecordList({ rows, empty }: { rows: { id: string; title: string; meta: string }[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="empty">{empty}</p>;
  }

  return (
    <ul className="record-list">
      {rows.map((row) => (
        <li key={row.id}>
          <strong>{row.title}</strong>
          <span>{row.meta}</span>
        </li>
      ))}
    </ul>
  );
}
