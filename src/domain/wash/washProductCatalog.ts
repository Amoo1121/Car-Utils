import type { WashProductPurchase } from "../store/types";

export type WashProductPreset = {
  id: string;
  brand: string;
  name: string;
  category: string;
  defaultCapacity: number;
  capacityUnit: NonNullable<WashProductPurchase["capacityUnit"]>;
  defaultDilutionRatio?: string;
  imageUrl: string;
  sourceUrl: string;
  keywords: string[];
};

export const washProductPresets: WashProductPreset[] = [
  {
    id: "koch-gentle-snow-foam",
    brand: "Koch-Chemie 科赫",
    name: "Gentle Snow Foam (GSF)",
    category: "预洗液",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:50（泡沫喷壶）",
    imageUrl: "https://media.koch-chemie.com/svg/Gsf__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/gentle_snow_foam",
    keywords: ["gsf", "雪崩", "泡沫", "中性预洗"],
  },
  {
    id: "koch-green-star",
    brand: "Koch-Chemie 科赫",
    name: "Green Star (GS)",
    category: "多用途清洁",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "车身约 1:5-1:30",
    imageUrl: "https://media.koch-chemie.com/svg/Gs__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/green_star",
    keywords: ["gs", "绿星", "apc", "碱性", "预洗增强"],
  },
  {
    id: "koch-nanomagic-shampoo",
    brand: "Koch-Chemie 科赫",
    name: "NanoMagic Shampoo (NMS)",
    category: "正洗液",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:200",
    imageUrl: "https://media.koch-chemie.com/svg/Nms__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/nanomagic_shampoo_1",
    keywords: ["nms", "纳米魔法", "香波", "正洗"],
  },
  {
    id: "koch-reactivation-shampoo",
    brand: "Koch-Chemie 科赫",
    name: "Reactivation Shampoo (RS)",
    category: "正洗液",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 1:200",
    imageUrl: "https://media.koch-chemie.com/svg/Rs__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/reactivation_shampoo",
    keywords: ["rs", "酸性香波", "陶瓷涂层", "水垢"],
  },
  {
    id: "koch-magic-wheel-cleaner",
    brand: "Koch-Chemie 科赫",
    name: "Magic Wheel Cleaner (MWC)",
    category: "轮毂清洁",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://media.koch-chemie.com/svg/Mwc__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/magic_wheel_cleaner",
    keywords: ["mwc", "魔法轮毂", "轮清", "铁粉"],
  },
  {
    id: "koch-allround-surface-cleaner",
    brand: "Koch-Chemie 科赫",
    name: "Allround Surface Cleaner (ASC)",
    category: "内饰清洁",
    defaultCapacity: 500,
    capacityUnit: "ml",
    defaultDilutionRatio: "原液使用",
    imageUrl: "https://media.koch-chemie.com/svg/Asc__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/allround_surface_cleaner",
    keywords: ["asc", "全能表面清洁", "内饰", "即用型"],
  },
  {
    id: "koch-speed-glass-cleaner",
    brand: "Koch-Chemie 科赫",
    name: "SpeedGlassCleaner",
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
    category: "蜡/封体",
    defaultCapacity: 1000,
    capacityUnit: "ml",
    defaultDilutionRatio: "约 30 ml / 1 L 水",
    imageUrl: "https://media.koch-chemie.com/svg/Pw__1760317201.svg",
    sourceUrl: "https://www.koch-chemie.com/us/products/protectorwax",
    keywords: ["pw", "保护蜡", "疏水", "上光"],
  },
  {
    id: "carpro-reset",
    brand: "CARPRO 卡普",
    name: "Reset Intensive Car Shampoo",
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
    id: "adams-wheel-tire-cleaner",
    brand: "Adam's Polishes 阿达姆斯",
    name: "Wheel & Tire Cleaner (WTC)",
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
  return washProductPresets.filter((preset) => {
    if (brand !== "all" && preset.brand !== brand) return false;
    if (!normalizedQuery) return true;
    return normalizeSearchText([preset.name, preset.brand, preset.category, ...preset.keywords].join(" ")).includes(normalizedQuery);
  });
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, "");
}
