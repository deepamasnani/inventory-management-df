export const CUSTOMER_TYPES = [
  { id: "A", label: "Type A · Retail" },
  { id: "B", label: "Type B · Wholesale" },
  { id: "C", label: "Type C · Distributor" },
  { id: "D", label: "Type D · Institutional" },
] as const;

export const CAT_LABELS = ["UK 6-7", "UK 8-9", "UK 10-11", "UK 12-13"] as const;

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export type CustomerType = "A" | "B" | "C" | "D";

export const DEFAULT_ADMIN = {
  username: "admin",
  password: "admin123",
  email: "admin@devfootwear.local",
};
