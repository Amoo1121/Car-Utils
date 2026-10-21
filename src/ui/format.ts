const currencyFormatter = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const preciseCurrencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });

export function money(value: number | undefined, precise = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  return (precise ? preciseCurrencyFormatter : currencyFormatter).format(value);
}

/** Money with cents only when they matter (e.g. ¥23.50 but ¥230). */
export function moneySmart(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.abs(value) < 100 && Math.round(value) !== value ? money(value, true) : money(value);
}

export function num(value: number | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

export function km(value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${integerFormatter.format(value)} km`;
}

export function monthLabel(month: string) {
  const [year, value] = month.split("-");
  const now = new Date();
  return Number(year) === now.getFullYear() ? `${Number(value)} 月` : `${year} 年 ${Number(value)} 月`;
}

export function shortMonth(month: string) {
  return `${Number(month.slice(5, 7))}月`;
}

export function dateLabel(date: string, now = new Date()) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const target = new Date(year, month - 1, day);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((startOfToday.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff === 2) return "前天";
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][target.getDay()];
  if (year === now.getFullYear()) return `${month}月${day}日 ${weekday}`;
  return `${year}/${month}/${day}`;
}

export function relativeTime(timestamp: number, now = Date.now()) {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 10) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Parses a user-entered number; returns undefined for blank/invalid values. */
export function parseNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function trimNumber(value: number, digits = 2) {
  return String(Number(value.toFixed(digits)));
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
