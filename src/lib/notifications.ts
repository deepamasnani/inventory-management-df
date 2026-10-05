export function filterLowStockByWarehouse<T extends { warehouseId: number }>(
  items: T[],
  warehouseId: number | null
): T[] {
  if (warehouseId == null) return items;
  return items.filter((item) => item.warehouseId === warehouseId);
}
