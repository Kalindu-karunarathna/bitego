import type { QuantityUnit } from "@bitego/shared";

// Colours and formatting from the "BiteGo Customer Application Design" prototype (the provider app),
// used by the seller screens. The rest of the app uses lib/theme.ts (owner: Kalindu).
export const color = {
  primary: "#C64F00",
  primaryDeep: "#8A3500",
  primaryDark: "#6E2900",
  brownText: "#7A2F00",
  mid: "#E0661A",
  light: "#F48A3F",
  tint: "#FFE5D0",
  tintSoft: "#FFF3E8",
  tintBorder: "#F8D6BB",
  heroBg: "#FDE6D2",
  heroBorder: "#FBD9BF",
  topGlow: "#FFF0E3",
  amber: "#EBA42E",
  amberTint: "#FDEFC9",
  amberSoft: "#FFF8E5",
  amberBorder: "#F3DC9F",
  warnText: "#9A5706",
  cream: "#FFFBF5",
  page: "#FBF7F2",
  surface: "#FFFFFF",
  surface2: "#F1EBE4",
  line: "#E9E1D8",
  softLine: "#F0E8DF",
  lineStrong: "#ECC9AE",
  text: "#2B2118",
  label: "#5A4A3E",
  muted: "#76695F",
  muted2: "#A1938A",
  success: "#2EA043",
  error: "#DC2626",
  errorTint: "#FEF2F2",
} as const;

export const shadow = {
  shadowColor: "#78320A",
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 2,
} as const;

export const images = {
  logoMark: require("./assets/logo-mark.png"),
  heroBanner: require("./assets/hero-banner-art.png"),
  bowl: require("./assets/bowl.png"),
  glanceBag: require("./assets/glance-bag.png"),
  glanceBox: require("./assets/glance-box.png"),
  glanceFood: require("./assets/glance-food.png"),
  glanceReceipt: require("./assets/glance-receipt.png"),
  glanceUsers: require("./assets/glance-users.png"),
};

// ---------- Text formatting ----------

export function formatMoney(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `Rs. ${text.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export const formatPrice = (value: number) => (value === 0 ? "FREE" : formatMoney(value));

export function savePercent(originalPrice: number, price: number): number {
  return originalPrice > 0 && price < originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;
}

const UNIT_NAMES: Record<QuantityUnit, [string, string]> = {
  PORTION: ["portion", "portions"],
  PIECE: ["piece", "pieces"],
  PACK: ["pack", "packs"],
  KG: ["kg", "kg"],
};

export const unitName = (quantity: number, unit: QuantityUnit) => UNIT_NAMES[unit][quantity === 1 ? 0 : 1];
export const formatQuantity = (quantity: number, unit: QuantityUnit) => `${quantity} ${unitName(quantity, unit)}`;

export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const isToday = (date: Date) => startOfDay(date).getTime() === startOfDay(new Date()).getTime();

export function formatDay(date: Date): string {
  const days = Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// "Tuesday, 19 May"
export const formatLongDate = (date: Date) => `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${LONG_MONTHS[date.getMonth()]}`;
export const formatShortDate = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
export const weekdayLetter = (date: Date) => WEEKDAYS[date.getDay()][0];

export function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = startOfDay(start).getTime() === startOfDay(end).getTime();
  return sameDay
    ? `${formatDay(start)}, ${formatTime(start)} – ${formatTime(end)}`
    : `${formatDay(start)} ${formatTime(start)} – ${formatDay(end)} ${formatTime(end)}`;
}

// "Pickup ends in 25 min" / "in 2 hr 10 min"
export function formatEndsIn(endIso: string): string {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} hr ${minutes % 60} min` : `${hours} hr`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

// A short, readable reservation reference, e.g. "BG-1F3A9C2D".
export const reservationRef = (id: string) => `BG-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";
}
