# CGCC Cafeteria Express V1.2 — Implementation Plan

Large change set — proposing a phased execution so each batch is reviewable and testable before the next. No UI redesign, no auth changes, no payment changes.

## Batch A — Category fix + Split inventory (foundation)

**Feature 1: Bread Roll / Bread Loaf → Food Vendor**
- Migration: `UPDATE menu_items SET vendor_type='food' WHERE id IN ('sp9','sp10')`.
- Verify they disappear from Snacks dashboards/reports and appear in Food.

**Features 3, 4, 5: Online vs Walk-in stock split**
- Migration: add `stock_online INT`, `stock_walkin INT` to `menu_items` (defaults 0). Backfill by splitting current `stock_qty` (e.g. all into walk-in, or 50/50 configurable — proposed: put full current qty into `stock_walkin`, admin/vendors reallocate).
- Keep `stock_qty` as a generated/derived total (`stock_online + stock_walkin`) via trigger, so existing reads still work.
- Update `decrement_stock_from_sale` trigger:
  - `order_items` → decrement `stock_online`.
  - `cashier_sale_items` → decrement `stock_walkin`.
  - `available=false` when both reach 0; if one reaches 0 the item shows partial "Out of Online/Walk-in Stock" tag.
- New RPC `reallocate_stock(_item_id, _delta_to_online)` — moves qty between buckets, admin or owning vendor only, writes to `inventory_history`.
- New RPC `adjust_stock_split(_item_id, _online, _walkin, _reason)` for absolute edits.
- Update `InventoryPanel.tsx`: show Total / Online / Walk-in columns, +/- controls per bucket, "Move →" reallocation control. Status chips: In Stock / Low / Out of Online / Out of Walk-in / Sold Out.

## Batch B — Cashier receipt view & print (Feature 2)

- New route `src/routes/cashier.receipt.$id.tsx` — full receipt view (reuse cashier PDF layout as HTML) with buttons: Print, Download PDF, New Sale, Back.
- Add a print-friendly CSS block (`@media print`) sized for 80mm thermal (`@page { size: 80mm auto }`), using `window.print()`.
- Cashier index post-sale panel: replace current toast/PDF-only flow with success card showing **Print · Open · Download · New Sale**.
- Cashier receipts list: add **Open** action beside existing Download.

## Batch C — Admin Product Management (Features 6, 7, 8)

- Migration: add `description TEXT`, `image_url TEXT`, `archived_at TIMESTAMPTZ` to `menu_items`; keep `available`.
- RPCs (admin-only via `has_role`): `upsert_menu_item`, `archive_menu_item`, `restore_menu_item`, `delete_menu_item` (blocks delete if referenced in orders — force archive instead unless `_force=true` + no history).
- Storage bucket `product-images` (public read, admin write) for uploads.
- New route `src/routes/admin.products.tsx` — table + create/edit dialog (name, category, price, description, vendor assignment, image upload, availability toggle, archive/restore/delete).
- Filters: All / Active / Archived. Prices update everywhere automatically since all reads hit `menu_items` (historical `order_items.price` is already snapshotted by the enforce trigger — preserved).
- Customer menu, cashier grid, vendor inventory already exclude items via `available=false`; extend to also hide `archived_at IS NOT NULL`.

## Batch D — Sales closing + Admin sales control (Features 9, 10)

- Reuse existing `close_business_day` / `reopen_business_day` (already built in V1.1).
- Cashier dashboard: add **Close Sales** button (calls `close_business_day` for today) with reconciliation summary dialog (totals per payment method). After close, cashier UI blocks new sales for that day (server enforces via new check in `create_cashier_sale`: reject if `business_day` closure exists).
- Admin sales control panel inside `admin.index.tsx`:
  - Reopen day (exists), Adjust sale (edit note / mark refunded), Delete sale (soft via `archived_at`), Delete duplicate detector (already partially exists), Delete test sales (bulk by filter).
  - Every mutation goes through new RPCs that write to `audit_log`.

## Batch E — Audit log (Feature 11)

- Migration: `audit_log` table (`id, user_id, user_label, action, entity_type, entity_id, details JSONB, created_at`), admin-select RLS.
- Helper `log_audit(_action, _entity_type, _entity_id, _details)` invoked from RPCs: price change, stock adjust, reallocate, close/reopen day, product archive/delete, sale adjust/delete, vendor password change, receipt print (client-fired RPC `log_receipt_print`).
- Admin route `admin.audit.tsx` — filterable log viewer (user, action, date range).

## Batch F — Verification (Feature 12)

Test checklist run through Playwright + manual UI check:
- Bread items only under Food vendor.
- Cashier print/open/download from post-sale + receipts list.
- Reallocation math holds; online-only vs walk-in-only depletion.
- Admin create/edit/archive/restore/delete product flow.
- Sales close locks cashier; admin reopen works.
- Audit entries appear for each tracked action.
- Existing customer, vendor, admin flows untouched.

## Technical notes

- All schema changes go through `supabase--migration`; new tables include `GRANT` + RLS.
- Historical price preservation: `order_items.price` and `cashier_sale_items.price` are already snapshotted by the enforce triggers — no change needed for Feature 7.
- Storage bucket for images is new; product images optional (falls back to no image, matching current no-image list UI).
- Estimated 5 migrations + ~15 new/edited files. Sizable — ~1–2 turns per batch.

## Proposed order of execution

1. Confirm this plan (or trim scope).
2. Ship Batch A (biggest data change) first, verify, then B → C → D → E → F.

Reply "go" to start with Batch A, or tell me which batches to skip / reprioritize (e.g. "just A + B this round").