import type { WashType } from "../store/types";

export const washTypeOptions: { id: WashType; label: string }[] = [
  { id: "diy", label: "DIY 洗车" },
  { id: "shop_basic", label: "店内普洗" },
  { id: "shop_detailing", label: "店内精洗" },
  { id: "machine", label: "机器洗车" },
  { id: "other", label: "其他" },
];

export const washStepOptions = ["预洗", "正洗", "轮毂", "轮胎", "内饰", "玻璃", "去污", "打蜡/保护", "收水", "其他"];

export const shopServiceOptions = ["外观清洗", "内饰清洁", "打蜡", "镀晶", "玻璃去油膜", "轮毂清洁", "发动机舱", "消毒除味"];

export const productCategoryOptions = [
  "预洗液",
  "正洗液",
  "洗车液",
  "多用途清洁",
  "虫胶清洁",
  "铁粉去除",
  "轮毂清洁",
  "轮胎养护",
  "玻璃清洁",
  "玻璃去油膜",
  "内饰清洁",
  "蜡/封体",
  "毛巾/工具",
  "其他",
];
