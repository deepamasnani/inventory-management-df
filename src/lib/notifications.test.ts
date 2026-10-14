import assert from "node:assert/strict";
import { test } from "node:test";
import { filterLowStockByWarehouse } from "./notifications";
import { creditChangeFromBill } from "./bill-credit";

const items = [
  { warehouseId: 1, sku: "A" },
  { warehouseId: 2, sku: "B" },
  { warehouseId: 1, sku: "C" },
];

test("all godowns keeps every low-stock alert", () => {
  assert.deepEqual(filterLowStockByWarehouse(items, null), items);
});

test("a godown filter keeps only that warehouse", () => {
  assert.deepEqual(filterLowStockByWarehouse(items, 1), [
    { warehouseId: 1, sku: "A" },
    { warehouseId: 1, sku: "C" },
  ]);
  assert.deepEqual(filterLowStockByWarehouse(items, 2), [{ warehouseId: 2, sku: "B" }]);
});

test("an unused godown returns no stock alerts", () => {
  assert.deepEqual(filterLowStockByWarehouse(items, 99), []);
});

test("unpaid balance becomes credit; claim only uses advance", () => {
  assert.equal(creditChangeFromBill(500, 0, 0), 500);
  assert.equal(creditChangeFromBill(0, 200, -200), 200);
  assert.equal(creditChangeFromBill(800, 200, -200), 1000);
  assert.equal(creditChangeFromBill(800, 200, 0), 800);
});
