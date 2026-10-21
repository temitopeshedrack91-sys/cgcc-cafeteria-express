export type StockPermissions = { increase: boolean; reduce: boolean; reallocate: boolean };

export const FULL_STOCK_PERMISSIONS: StockPermissions = { increase: true, reduce: true, reallocate: true };

export function canChangeStock(previous: { online: number; walkin: number }, next: { online: number; walkin: number }, permissions: StockPermissions) {
  if (!Number.isInteger(next.online) || !Number.isInteger(next.walkin) || next.online < 0 || next.walkin < 0) return false;
  const delta = next.online + next.walkin - previous.online - previous.walkin;
  const moving = (next.online > previous.online && next.walkin < previous.walkin) || (next.online < previous.online && next.walkin > previous.walkin);
  return (!moving || permissions.reallocate) && (delta <= 0 || permissions.increase) && (delta >= 0 || permissions.reduce);
}