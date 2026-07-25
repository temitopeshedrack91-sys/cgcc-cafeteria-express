# Phase 2 – Inventory Management & Cashier Dashboard

Large scope. Below is the plan for review before I start building.

## Database changes (single migration)

Add to existing `menu_items`:
- `stock_qty INTEGER NOT NULL DEFAULT 0`
- `low_stock_threshold INTEGER NOT NULL DEFAULT 10`

New tables:
- `inventory_history` — product_id, previous_qty, new_qty, delta, reason, changed_by, changed_at
- `cashier_sales` — id, code, receipt_no, cashier_id, customer_name (optional), payment_method (cash/pos/transfer/opay), total, created_at
- `cashier_sale_items` — sale_id, menu_item_id, name, price, qty, vendor_type

Extend `app_role` enum with `cashier`. Seed two cashier auth users (`cashier1@cgcc.local` / `cashier2@cgcc.local`) with the requested passwords and grant them `cashier` role.

RLS:
- `menu_items` UPDATE: admin OR vendor-of-that-category (existing) — add stock columns to that path.
- `inventory_history`: admin sees all; vendor sees own category; insert allowed by admin/vendor/cashier via SECURITY DEFINER triggers.
- `cashier_sales` / `cashier_sale_items`: cashier can insert & read own; admin reads all.

Triggers:
- `AFTER INSERT` on `order_items` and `cashier_sale_items` → decrement `menu_items.stock_qty`, log to `inventory_history`, auto-set `available=false` when qty hits 0.
- `BEFORE UPDATE` on `menu_items` when `stock_qty` changes → log to `inventory_history` with previous/new.
- `enforce_cashier_sale_item_price` mirroring the order-item price enforcement.

RPC:
- `create_cashier_sale(_cashier, _payment_method, _customer_name, _items)` — atomic sale + receipt, mirrors `create_customer_order`.
- `adjust_stock(_item_id, _new_qty, _reason)` — admin/vendor-only, sets qty and logs history.

## Frontend

### Vendor dashboard (`/vendor`)
Add a new "Inventory" tab/section beside the existing orders view:
- Scoped list of vendor's products.
- Row: name, qty (editable input + +/− buttons), Low-stock badge (qty ≤ threshold), Available/Sold Out toggle.
- All actions call `adjust_stock` / existing `toggleAvailable`.
- Realtime channel on `menu_items` already exists; extend to refresh inventory rows.

### Admin
- New `/admin/inventory` page: all vendors' products, override qty, restore, view history, download CSV.
- New `/admin/cashiers` page: create/reset cashier password (admin server fn, similar to vendors.functions.ts).
- Extend `/admin` analytics to include cashier sales totals (daily/weekly/monthly) and combined PDF/Excel exports (reuse `report-pdf`/`report-xlsx`).

### Cashier dashboard (`/cashier`, `/cashier/login`)
New routes gated by `cashier` role:
- Sales screen: search + category filter, product grid, cart panel with qty controls, running total, payment method selector (Cash / POS / Transfer / OPay), Complete Sale button.
- On complete → RPC `create_cashier_sale` → receipt view with PDF download & reprint.
- Receipts tab: search by receipt no / code / date / customer.
- End-of-day report dialog: totals per method, transactions, items sold, PDF + XLSX export (reuse report libs).

### Customer flow
`menu.tsx` already filters by `available`; sold-out items auto-hide via existing realtime subscription — no change to customer flow.

## Security
- Cashier role has NO access to `/admin/*` or `/vendor/*` (route guards + RLS).
- `AdminShell` unchanged for admin. Separate `CashierShell` mirrors admin styling.
- Server functions for cashier password reset are admin-only, similar to vendors.

## Files to add
- Migration SQL
- `src/lib/cashiers.functions.ts`, `src/lib/inventory.functions.ts`
- `src/components/CashierShell.tsx`
- `src/routes/cashier.login.tsx`, `src/routes/cashier.index.tsx`, `src/routes/cashier.receipts.tsx`
- `src/routes/admin.inventory.tsx`, `src/routes/admin.cashiers.tsx`
- Inventory panel component reused by vendor + admin

## Files to modify
- `src/lib/store.ts` — add inventory + cashier slices, realtime handlers
- `src/routes/vendor.index.tsx` — add Inventory section
- `src/routes/admin.index.tsx` — combined sales analytics block
- `src/components/AdminShell.tsx` — add Inventory + Cashiers nav
- `src/lib/report-pdf.ts` / `report-xlsx.ts` — cashier report shape

Please confirm and I'll implement in one pass (migration first, then code).
