export type EnergyType = "汽油" | "柴油" | "混动" | "纯电" | "增程";

export type EntitySource = "web" | "miniapp" | "import" | "cloud" | "migration";

export type EntityType = "user" | "vehicle" | "fuel" | "wash" | "expense";

export type BaseEntity = {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
  deviceId?: string;
  source?: EntitySource;
  schemaVersion?: number;
};

export type UserSettings = {
  defaultVehicleId?: string;
  distanceUnit: "km" | "mile";
  currency: "CNY" | "USD";
  fuelVolumeUnit: "L" | "gal";
  theme?: "light" | "dark" | "system";
};

export type User = BaseEntity & {
  type?: "user";
  name: string;
  email: string;
  openId?: string;
  unionId?: string;
  avatarUrl?: string;
  settings?: UserSettings;
};

export type Vehicle = BaseEntity & {
  type?: "vehicle";
  userId: string;
  nickname: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  energyType: EnergyType;
  tankSize?: number;
  batterySize?: number;
  vin?: string;
  currentOdometer?: number;
  note?: string;
  presetId?: string;
  isArchived?: boolean;
};

export type PaymentMethod = "wechat" | "alipay" | "cash" | "credit_card" | "fuel_card" | "other";

export type RoadCondition = "city" | "highway" | "mixed" | "unknown";

export type FuelRecord = BaseEntity & {
  type?: "fuel";
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
  paymentMethod?: PaymentMethod;
  originalAmount?: number;
  discountAmount?: number;
  couponAmount?: number;
  memberDiscountAmount?: number;
  roadCondition?: RoadCondition;
  acUsageLevel?: 0 | 1 | 2 | 3;
  loadLevel?: 0 | 1 | 2 | 3;
  tirePressureKpa?: number;
  weather?: string;
  temperatureC?: number;
  receiptImageIds?: string[];
  note?: string;
};

export type WashType =
  | "diy"
  | "shop_basic"
  | "shop_detailing"
  | "machine"
  | "detailing"
  | "wax"
  | "interior"
  | "glass_oil_film"
  | "wheel_cleaning"
  | "other";

export type WashProductUsage = {
  id?: string;
  productId?: string;
  name: string;
  category?: string;
  step?: string;
  amount?: string;
  purchasePrice?: number;
  capacity?: number;
  capacityUnit?: "ml" | "L" | "g" | "kg" | "pcs";
  usedAmount?: number;
  usedUnit?: "ml" | "L" | "g" | "pcs";
  dilutionRatio?: string;
  estimatedCost?: number;
  cost?: number;
  note?: string;
};

export type WashProductPurchase = {
  id: string;
  date: string;
  purchasePrice?: number;
  capacity?: number;
  capacityUnit?: "ml" | "L" | "g" | "kg" | "pcs";
  note?: string;
};

export type WashProduct = BaseEntity & {
  type?: "washProduct";
  userId: string;
  presetId?: string;
  name: string;
  brand?: string;
  category: string;
  purchases: WashProductPurchase[];
  note?: string;
};

export type WashRecord = BaseEntity & {
  type?: "wash";
  userId: string;
  vehicleId: string;
  date: string;
  odometer?: number;
  items: string[];
  minutes: number;
  cost: number;
  notes: string;
  washType?: WashType;
  shopName?: string;
  location?: string;
  laborCost?: number;
  materialCost?: number;
  waterElectricityCost?: number;
  locationCost?: number;
  products?: WashProductUsage[];
  effectRating?: 1 | 2 | 3 | 4 | 5;
  nextSuggestedDate?: string;
  imageIds?: string[];
};

export type ExpenseCategory =
  | "maintenance"
  | "repair"
  | "insurance"
  | "inspection"
  | "ticket"
  | "parking"
  | "etc"
  | "tire"
  | "battery"
  | "wiper"
  | "washer_fluid"
  | "accessory"
  | "other";

export type ExpenseRecord = BaseEntity & {
  type?: "expense";
  userId: string;
  vehicleId: string;
  date: string;
  odometer?: number;
  category: ExpenseCategory;
  title: string;
  amount: number;
  vendor?: string;
  paymentMethod?: PaymentMethod;
  nextDueDate?: string;
  nextDueOdometer?: number;
  note?: string;
  imageIds?: string[];
};

export type ChangeOperation = "create" | "update" | "delete";

export type ChangeSet = BaseEntity & {
  type?: "change";
  userId: string;
  entityType: EntityType;
  entityId: string;
  op: ChangeOperation;
  payload?: unknown;
  baseUpdatedAt?: number;
  changedAt: number;
  syncedAt?: number | null;
};

export type SyncState = {
  lastPulledAt?: number;
  lastPushedAt?: number;
  lastSyncAt?: number;
  pendingChanges: ChangeSet[];
  cloudEnabled: boolean;
  cloudUserId?: string;
};

export type Store = {
  users: User[];
  vehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
  washProducts: WashProduct[];
  expenseRecords: ExpenseRecord[];
  currentUserId?: string;
  deviceId?: string;
  schemaVersion?: number;
  syncState?: SyncState;
};

export type FuelDateFilter = "all" | "month" | "year";

export type StoreCounts = {
  users: number;
  vehicles: number;
  fuelRecords: number;
  washRecords: number;
  washProducts: number;
  expenseRecords: number;
};

export type CarUtilsBackup = {
  app: "car-utils";
  schemaVersion: number;
  exportedAt: number;
  store: Store;
};

export type ImportOptions = {
  strategy: "prefer_newer" | "prefer_local" | "prefer_imported" | "manual";
  includeDeleted?: boolean;
  dryRun?: boolean;
};

export type ExportOptions = {
  scope: "all" | "current_user" | "current_vehicle";
  userId?: string;
  vehicleId?: string;
  includeDeleted?: boolean;
};

export type ImportConflict = {
  entityType: EntityType;
  id: string;
  localUpdatedAt?: number;
  incomingUpdatedAt?: number;
  reason: "local_newer" | "incoming_newer" | "same_id_different_content";
};

export type ImportResult = {
  added: number;
  updated: number;
  skipped: number;
  conflicts: ImportConflict[];
  previewOnly: boolean;
};
