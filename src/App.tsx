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
                <section className="tab-layout">
                  <FuelForm vehicle={activeVehicle} onAdd={addFuelRecord} />
                  <FuelRecordsPanel fuelRecords={fuelRecords} limit={12} />
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
            onChange={(event) => setVehicle({ ...vehicle, energyType: event.target.value as EnergyType })}
          >
            <option>汽油</option>
            <option>柴油</option>
            <option>混动</option>
            <option>纯电</option>
            <option>增程</option>
          </select>
        </label>
      </div>
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
    fullTank: true,
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
      fullTank: true,
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

function FuelRecordsPanel({ fuelRecords, limit }: { fuelRecords: FuelRecord[]; limit: number }) {
  return (
    <div className="panel">
      <div className="section-title">
        <Fuel size={17} />
        <span>{limit > 6 ? "加油记录" : "最近加油"}</span>
      </div>
      <RecordList
        empty="暂无加油记录"
        rows={fuelRecords.slice(0, limit).map((record) => ({
          id: record.id,
          title: `${record.fuelGrade ? `${record.fuelGrade} · ` : ""}${record.volume} L · ${money(record.paidAmount ?? record.totalCost)}`,
          meta: [
            record.date,
            record.odometer != null ? `${record.odometer} km` : "",
            record.station,
            record.fuelLevelBefore != null || record.fuelLevelAfter != null
              ? `油位 ${record.fuelLevelBefore ?? "-"}% -> ${record.fuelLevelAfter ?? "-"}%`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />
    </div>
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
