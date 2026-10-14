import assert from "node:assert/strict";
import { test } from "node:test";
import { filterLowStockByWarehouse } from "./notifications";
import { creditChangeFromBill, displayedCustomerCredit, remainingCreditForCustomer } from "./bill-credit";

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

test("customer outstanding is the sum of remaining bills", () => {
  const bills = [
    { id: 4, invoiceNo: "INV-4", customerId: 1, balance: 4000, status: "active" },
    { id: 5, invoiceNo: "INV-5", customerId: 1, balance: 1000, status: "active" },
  ];
  const pays = [{ id: 1, billId: 5, amount: 500, method: "Cash", note: "Bill credit INV-5", date: "2026-10-13" }];
  assert.equal(remainingCreditForCustomer(1, bills, pays), 4500);
  assert.equal(displayedCustomerCredit(4650, 4500), 4500);
});

test("unpaid balance becomes credit; claim uses outstanding credit or advance", () => {
  assert.equal(creditChangeFromBill(500, 0, 0), 500);
  assert.equal(creditChangeFromBill(0, 200, -200), 200);
  assert.equal(creditChangeFromBill(800, 200, -200), 1000);
  assert.equal(creditChangeFromBill(800, 200, 0), 800);
  assert.equal(creditChangeFromBill(2000, 1000, 5000), 1000);
  assert.equal(creditChangeFromBill(0, 1000, 5000), -1000);
});
