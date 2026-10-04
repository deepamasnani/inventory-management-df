import * as XLSX from "xlsx";
import { formatSizeRange } from "./constants";

export type InventoryImportRow = {
  brand: string;
  name: string;
  size: string;
  qty: number;
  colour: string;
  remarks: string;
  pairsPerCarton: number;
};

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  if (typeof v === "number") return String(v);
  const s = String(v).trim();
  if (/^\d+\.0$/.test(s)) return s.slice(0, -2);
  return s;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function headerKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseInventoryWorkbook(data: ArrayBuffer): InventoryImportRow[] {
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  let headerIdx = -1;
  let cols = { brand: 0, name: 1, size: 2, qty: 3, colour: 4, remarks: 5, ppc: 6 };

  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const row = (grid[i] || []).map((c) => headerKey(cell(c)));
    const brand = row.findIndex((c) => c === "company" || c === "brand");
    const name = row.findIndex((c) => c.includes("article") || c === "sku" || c === "name");
    const size = row.findIndex((c) => c === "size" || c.includes("sizerange"));
    const qty = row.findIndex((c) => c.includes("stock") || c === "pairs" || c === "qty");
    if (brand >= 0 && name >= 0 && size >= 0 && qty >= 0) {
      headerIdx = i;
      cols = {
        brand,
        name,
        size,
        qty,
        colour: row.findIndex((c) => c.includes("colour") || c.includes("color")),
        remarks: row.findIndex((c) => c.includes("remark")),
        ppc: row.findIndex(
          (c) =>
            c.includes("ppc") ||
            (c.includes("pair") && (c.includes("carton") || c.includes("ctn")))
        ),
      };
      break;
    }
  }

  if (headerIdx < 0) return [];

  const out: InventoryImportRow[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const brand = cell(row[cols.brand]);
    const name = cell(row[cols.name]);
    if (!brand || headerKey(brand) === "company") continue;
    const size = formatSizeRange(cell(row[cols.size]));
    if (!name || !size) continue;
    out.push({
      brand,
      name,
      size,
      qty: num(row[cols.qty]),
      colour: cols.colour >= 0 ? cell(row[cols.colour]) : "",
      remarks: cols.remarks >= 0 ? cell(row[cols.remarks]) : "",
      pairsPerCarton: cols.ppc >= 0 ? num(row[cols.ppc]) : 0,
    });
  }
  return out;
}
