import type { WashProductPurchase } from "../store/types";

export type WashProductPreset = {
  id: string;
  brand: string;
  name: string;
  shortCode?: string;
  category: string;
  defaultCapacity: number;
  capacityUnit: NonNullable<WashProductPurchase["capacityUnit"]>;
  defaultDilutionRatio?: string;
  description?: string;
  imageUrl: string;
  sourceUrl: string;
  keywords: string[];
};

export const washProductPresets: WashProductPreset[] = [
  {
    id: "koch-gentle-snow-foam",
    brand: "Koch-Chemie 科赫",
    name: "Gentle Snow Foam (GSF)",
    shortCode: "GSF",
    category: "预洗液",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:50（泡沫喷壶）",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Gentle_Snow_Foam.jpg?v=1745434999",
    sourceUrl: "https://www.koch-chemie.com/us/products/gentle_snow_foam",
    keywords: ["gsf", "雪崩", "泡沫", "中性预洗"],
  },
  {
    id: "koch-green-star",
    brand: "Koch-Chemie 科赫",
    name: "Green Star (GS)",
    shortCode: "GS",
    category: "多用途清洁",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "车身约 1:5-1:30",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Green_Star.jpg?v=1745436243",
    sourceUrl: "https://www.koch-chemie.com/us/products/green_star",
    keywords: ["gs", "绿星", "apc", "碱性", "预洗增强"],
  },
  {
    id: "koch-super-foam-fruit-bowl",
    brand: "Koch-Chemie 科赫",
    name: "Super Foam Fruit Bowl",
    shortCode: "SFF",
    category: "预洗液",
    defaultCapacity: 20,
    capacityUnit: "L",
    defaultDilutionRatio: "泡沫枪约 1:50-1:100",
    imageUrl:
      "https://themicrofibershop.com/cdn/shop/files/112_Koch_Chemie_Super_Foam_Fruit_Bowl_Car_Washing_Foam_20_Ltr.jpg?v=1721632746&width=1100",
    sourceUrl: "https://www.koch-chemie.com/en/products/super_foam_fruit_bowl",
    keywords: ["sff", "superfoamfruitbowl", "水果泡沫", "果香", "碱性预洗", "高泡"],
  },
  {
    id: "koch-super-foam-nta-free",
    brand: "Koch-Chemie 科赫",
    name: "Super Foam NTA-frei",
    shortCode: "SFN",
    category: "预洗液",
    defaultCapacity: 20,
    capacityUnit: "L",
    defaultDilutionRatio: "泡沫枪约 1:50-1:100",
    imageUrl: "https://minenext.be/cdn/shop/files/SuperFoamNTA-freiSfn20L.png?v=1722981559&width=1100",
    sourceUrl: "https://www.koch-chemie.com/en/products/super_foam_nta_frei",
    keywords: ["sfn", "superfoamntafrei", "超级泡沫", "碱性预洗", "高泡", "nta-free"],
  },
  {
    id: "koch-active-foam",
    brand: "Koch-Chemie 科赫",
    name: "Active Foam",
    shortCode: "AF",
    category: "预洗液",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "泡沫枪约 1:20-1:50",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Active_foam.jpg?v=1745435023",
    sourceUrl: "https://www.koch-chemie.com/en/products/active_foam",
    keywords: ["af", "activefoam", "活性泡沫", "檀香", "碱性预洗", "正洗"],
  },
  {
    id: "koch-nanomagic-shampoo",
    brand: "Koch-Chemie 科赫",
    name: "NanoMagic Shampoo (NMS)",
    shortCode: "NMS",
    category: "正洗液",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:200",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Nano_Magic_Shampoo.jpg",
    sourceUrl: "https://www.koch-chemie.com/us/products/nanomagic_shampoo_1",
    keywords: ["nms", "纳米魔法", "香波", "正洗"],
  },
  {
    id: "koch-reactivation-shampoo",
    brand: "Koch-Chemie 科赫",
    name: "Reactivation Shampoo (RS)",
    shortCode: "RS",
    category: "正洗液",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:200",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Reactivation_Shampoo.jpg?v=1745435073",
    sourceUrl: "https://www.koch-chemie.com/us/products/reactivation_shampoo",
    keywords: ["rs", "酸性香波", "陶瓷涂层", "水垢"],
  },
  {
    id: "koch-magic-wheel-cleaner",
    brand: "Koch-Chemie 科赫",
    name: "Magic Wheel Cleaner (MWC)",
    shortCode: "MWC",
    category: "轮毂清洁",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Magic_Wheel_Cleaner.jpg?v=1745434839",
    sourceUrl: "https://www.koch-chemie.com/us/products/magic_wheel_cleaner",
    keywords: ["mwc", "魔法轮毂", "轮清", "铁粉"],
  },
  {
    id: "koch-reactive-rust-remover",
    brand: "Koch-Chemie 科赫",
    name: "Reactive Rust Remover",
    shortCode: "RRR",
    category: "铁粉去除",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Reactive_Rust_Remover.jpg?v=1745434844",
    sourceUrl: "https://www.koch-chemie.com/us/products/reactive_rust_remover",
    keywords: ["rrr", "铁粉", "飞漆铁粉", "锈迹", "轮毂", "漆面去铁粉"],
  },
  {
    id: "koch-allround-surface-cleaner",
    brand: "Koch-Chemie 科赫",
    name: "Allround Surface Cleaner (ASC)",
    shortCode: "ASC",
    category: "内饰清洁",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Allround_Surface_Cleaner.jpg",
    sourceUrl: "https://www.koch-chemie.com/us/products/allround_surface_cleaner",
    keywords: ["asc", "全能表面清洁", "内饰", "即用型"],
  },
  {
    id: "koch-pol-star",
    brand: "Koch-Chemie 科赫",
    name: "Pol Star",
    shortCode: "PO",
    category: "内饰清洁",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:5-1:20",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/PolStar.jpg?v=1745436300",
    sourceUrl: "https://www.koch-chemie.com/us/products/pol_star",
    keywords: ["po", "polstar", "内饰", "皮革", "翻毛皮", "织物", "中性清洁"],
  },
  {
    id: "koch-speed-glass-cleaner",
    brand: "Koch-Chemie 科赫",
    name: "SpeedGlassCleaner",
    shortCode: "SGC",
    category: "玻璃清洁",
    defaultCapacity: 750,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://media.koch-chemie.com/svg/77703750US__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/speedglasscleaner",
    keywords: ["玻璃水", "玻璃清洁", "sgc", "即用型"],
  },
  {
    id: "koch-insect-dirt-remover",
    brand: "Koch-Chemie 科赫",
    name: "Insect & DirtRemover",
    shortCode: "IDR",
    category: "虫胶清洁",
    defaultCapacity: 750,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://media.koch-chemie.com/svg/77701750US__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/insect_dirtremover",
    keywords: ["虫清", "虫尸", "鸟粪", "预洗"],
  },
  {
    id: "koch-protector-wax",
    brand: "Koch-Chemie 科赫",
    name: "ProtectorWax (PW)",
    shortCode: "PW",
    category: "蜡/封体",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 30 ml / 1 L 水",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Protector_Wax.jpg?v=1745435638",
    sourceUrl: "https://www.koch-chemie.com/us/products/protectorwax",
    keywords: ["pw", "保护蜡", "疏水", "上光"],
  },
  {
    id: "koch-finish-spray-exterior",
    brand: "Koch-Chemie 科赫",
    name: "Finish Spray exterior",
    shortCode: "FSE",
    category: "蜡/封体",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Fse_1L.jpg?v=1745556735",
    sourceUrl: "https://www.koch-chemie.com/us/products/finish_spray_exterior",
    keywords: ["fse", "finishspray", "收水", "水渍", "水垢", "快速养护", "漆面"],
  },
  {
    id: "koch-plast-star-silicone-free",
    brand: "Koch-Chemie 科赫",
    name: "Plast Star silicone-free",
    shortCode: "PSS",
    category: "轮胎养护",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0531/9681/6557/files/Plast_Star_Silicone-free.jpg?v=1745438415",
    sourceUrl: "https://www.koch-chemie.com/en/products/plast_star_siliconoelfrei",
    keywords: ["pss", "plaststar", "外饰塑料", "轮胎", "橡胶", "塑料养护", "无硅油"],
  },
  {
    id: "koch-allround-quick-shine",
    brand: "Koch-Chemie 科赫",
    name: "AllroundQuickShine",
    shortCode: "AQS",
    category: "蜡/封体",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://media.koch-chemie.com/svg/77708500__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/en/products/allroundquickshine",
    keywords: ["aqs", "allroundquickshine", "快釉", "快速养护", "内外饰", "上光"],
  },
  {
    id: "carpro-reset",
    brand: "CARPRO 卡普",
    name: "Reset Intensive Car Shampoo",
    shortCode: "RESET",
    category: "正洗液",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:500",
    imageUrl: "https://carpro.nyc3.digitaloceanspaces.com/CARPRO_Reset_01_9b4d456ead.png",
    sourceUrl: "https://carpro.global/product/reset/",
    keywords: ["reset", "卡普", "复位", "中性正洗", "涂层维护"],
  },
  {
    id: "fireball-bug-cleaner",
    brand: "Fireball 火球",
    name: "Bug Cleaner",
    shortCode: "BUG",
    category: "虫胶清洁",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液或约 1:1-1:10",
    imageUrl:
      "https://static.wixstatic.com/media/fe7082_b5020aad21f84619888ed949e85ef34b~mv2.jpg/v1/fill/w_1000,h_1000,al_c,q_85/%EB%B2%84%EA%B7%B8%ED%81%B4%EB%A6%AC%EB%84%88.jpg",
    sourceUrl: "https://www.fireballkorea.com/cleaners/bug-cleaner",
    keywords: ["火球", "虫清", "虫尸", "树胶", "鸟粪"],
  },
  {
    id: "fireball-glass-cleaner",
    brand: "Fireball 火球",
    name: "Glass Cleaner",
    shortCode: "GLASS",
    category: "玻璃清洁",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    description: "即用型汽车玻璃清洁剂，用于清理指纹、灰尘、油污和道路污膜，并减少擦拭残留。",
    imageUrl: "https://www.waschguru.de/media/image/product/28713/lg/fireball-glass-glasreiniger-500ml.jpg",
    sourceUrl: "https://www.fireballkorea.com/cleaners",
    keywords: ["火球", "玻璃清洁", "玻璃水", "glass", "车窗", "内外玻璃", "无氨"],
  },
  {
    id: "klcb-a14-glass-polishing-compound",
    brand: "KLCB 苛力",
    name: "A14 Glass Polishing Compound",
    shortCode: "A14",
    category: "玻璃去油膜",
    defaultCapacity: 150,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液配合海绵研磨",
    description: "氧化铈玻璃抛光剂，用于清除汽车玻璃油膜、水渍和旧镀膜残留。",
    imageUrl:
      "https://www.zgklcb.com/wp-content/uploads/2024/10/%E7%8E%BB%E7%92%83%E6%8A%9B%E5%85%89%E5%89%82-SKU.jpg",
    sourceUrl:
      "https://www.zgklcb.com/product/klcb-a14-glass-auto-window-polish-compounds-car-clean-polishing-wax-glass-polishing-compound",
    keywords: ["苛力", "klcb", "a14", "去油膜", "油膜清除", "玻璃抛光", "氧化铈", "水渍", "旧镀膜"],
  },
  {
    id: "adams-wheel-tire-cleaner",
    brand: "Adam's Polishes 阿达姆斯",
    name: "Wheel & Tire Cleaner (WTC)",
    shortCode: "WTC",
    category: "轮毂清洁",
    defaultCapacity: 473,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl:
      "https://adamspolishes.com/cdn/shop/products/adams_polishes_wheel_and_tire_cleaner_16oz_square_top_bottle_800x.jpg?v=1711471376",
    sourceUrl: "https://adamspolishes.com/products/adams-wheel-tire-cleaner",
    keywords: ["adams", "阿达姆斯", "wtc", "轮清", "轮胎清洁"],
  },
];

export function getWashProductPreset(presetId?: string) {
  return presetId ? washProductPresets.find((preset) => preset.id === presetId) : undefined;
}

export function filterWashProductPresets(query: string, brand = "all") {
  const normalizedQuery = normalizeSearchText(query);
  const brandPresets = washProductPresets.filter((preset) => brand === "all" || preset.brand === brand);
  if (!normalizedQuery) return brandPresets;

  return brandPresets
    .map((preset, index) => ({
      preset,
      index,
      score: getSearchScore(preset, normalizedQuery),
    }))
    .filter((result) => result.score < Number.POSITIVE_INFINITY)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ preset }) => preset);
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, "");
}

function getSearchScore(preset: WashProductPreset, normalizedQuery: string) {
  const shortCode = normalizeSearchText(preset.shortCode ?? "");
  if (shortCode === normalizedQuery) return 0;
  if (shortCode.startsWith(normalizedQuery)) return 1;

  const name = normalizeSearchText(preset.name);
  if (name.startsWith(normalizedQuery)) return 2;

  const searchText = normalizeSearchText(
    [preset.name, preset.shortCode ?? "", preset.brand, preset.category, ...preset.keywords].join(" "),
  );
  return searchText.includes(normalizedQuery) ? 3 : Number.POSITIVE_INFINITY;
}
