export const CUSTOMER_TYPES = [
  { id: "A", label: "Type A · Retail" },
  { id: "B", label: "Type B · Wholesale" },
  { id: "C", label: "Type C · Distributor" },
  { id: "D", label: "Type D · Institutional" },
] as const;

export const CAT_LABELS = ["6-9", "5-8", "4-7", "2-5"] as const;

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function formatSizeRange(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (/^\d+(?:\.\d+)?$/.test(t)) return String(Number(t));
  const m = t.match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/i);
  if (m) {
    const a = String(Number(m[1]));
    const b = String(Number(m[2]));
    return `${a}-${b}`;
  }
  return t.replace(/\*/g, "-");
}

export function cartonCount(pairs: number, perCarton: number): number | null {
  if (!perCarton || perCarton <= 0) return null;
  return Math.round((pairs / perCarton) * 10) / 10;
}

export function formatCartons(pairs: number, perCarton: number): string {
  const n = cartonCount(pairs, perCarton);
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function skuSearchHaystack(sku: {
  brand: string;
  name: string;
  categories: { label: string; colour: string; remarks: string }[];
}): string {
  return [
    sku.brand,
    sku.name,
    ...sku.categories.flatMap((c) => [c.label, c.colour, c.remarks]),
  ]
    .join(" ")
    .toLowerCase();
}

export function skuPairsInWarehouse(
  sku: {
    categories: { id: number }[];
    stock: Record<number, Record<number, number>>;
  },
  warehouseId: number
): number {
  return sku.categories.reduce((n, c) => n + (sku.stock[warehouseId]?.[c.id] ?? 0), 0);
}

export function indiaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export type CustomerType = "A" | "B" | "C" | "D";

export const DEFAULT_ADMIN = {
  username: "admin",
  password: "admin123",
  email: "admin@devfootwear.local",
};
