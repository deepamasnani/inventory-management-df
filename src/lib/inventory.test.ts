import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import {
  cartonCount,
  formatCartons,
  formatSizeRange,
  indiaToday,
  skuSearchHaystack,
} from "./constants";
import { parseInventoryWorkbook } from "./parse-inventory-xlsx";

test("6*9 and 6 × 9 become size range 6-9", () => {
  assert.equal(formatSizeRange("6*9"), "6-9");
  assert.equal(formatSizeRange("6 × 9"), "6-9");
  assert.equal(formatSizeRange(" 6*9 "), "6-9");
  assert.equal(formatSizeRange("10-13"), "10-13");
});

test("a single size stays a single size", () => {
  assert.equal(formatSizeRange("5"), "5");
  assert.equal(formatSizeRange("11"), "11");
  assert.equal(formatSizeRange(String(5)), "5");
});

test("3.8 cartons means a partial 4th carton", () => {
  assert.equal(cartonCount(274, 72), 3.8);
  assert.equal(formatCartons(274, 72), "3.8");
  assert.equal(formatCartons(144, 72), "2");
  assert.equal(formatCartons(10, 0), "—");
});

test("remarks and colour are searchable", () => {
  const hay = skuSearchHaystack({
    brand: "Bata",
    name: "101",
    categories: [{ label: "6-9", colour: "Black", remarks: "HAWAI LOOSE" }],
  });
  assert.ok(hay.includes("hawai loose"));
  assert.ok(hay.includes("black"));
});

test("bill date is YYYY-MM-DD in India time", () => {
  assert.match(indiaToday(), /^\d{4}-\d{2}-\d{2}$/);
});

function workbook(rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock");
  const nodeBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer;
}

test("Excel import maps godown columns and 6*9", () => {
  const rows = parseInventoryWorkbook(
    workbook([
      ["Company", "Article", "Size", "Stocks", "Colour", "Remarks", "Pairs Per Carton"],
      ["Bata", "101", "6*9", 274, "Black", "HAWAI LOOSE", 72],
      ["", "", "", "", "", "", ""],
    ])
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].brand, "Bata");
  assert.equal(rows[0].name, "101");
  assert.equal(rows[0].size, "6-9");
  assert.equal(rows[0].qty, 274);
  assert.equal(rows[0].colour, "Black");
  assert.equal(rows[0].remarks, "HAWAI LOOSE");
  assert.equal(rows[0].pairsPerCarton, 72);
});

test("Excel import ignores sheets without Company/Article/Size/Stocks", () => {
  const rows = parseInventoryWorkbook(workbook([["Foo", "Bar"], ["1", "2"]]));
  assert.equal(rows.length, 0);
});

test("Excel import treats ? as 0, keeps one size, and reads carton notes as carton count", () => {
  const rows = parseInventoryWorkbook(
    workbook([
      ["Company", "Article", "Size", "Stocks", "Colour", "Remarks", "Pairs Per Carton"],
      ["ZIPTRON", "CT", "15*19", "?", "MIX", "KIDS SHOE LOOSE", "?"],
      ["LAKHANI", "RUSTOM", 5, 120, "BLACK", "GENTS HAWAI BOX", 60],
      ["MIX", "SPORT SHOES MIX COMPANY", "11*5", 1008, "MIX", "SPORT SHOE BOX", "48( 21 CARTON)"],
    ])
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].qty, 0);
  assert.equal(rows[0].pairsPerCarton, 0);
  assert.equal(rows[1].size, "5");
  assert.equal(rows[1].qty, 120);
  assert.equal(rows[1].pairsPerCarton, 60);
  assert.equal(rows[2].qty, 1008);
  assert.equal(rows[2].pairsPerCarton, 21);
});
