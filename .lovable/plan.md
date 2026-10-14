# CGCC Cafeteria Express — Technical Audit Report (inspection only, nothing changed)

## Current Setup
- Frontend: TanStack Start (React 19, Vite, Tailwind v4), hosted by Lovable at cgcc-cafeteria-express.lovable.app. Verified.
- Backend: Lovable Cloud (managed Supabase) — Postgres database, auth, file storage, server functions. Preview and live app share ONE database. Verified.
- Code repo: Lovable-internal Git only. **No GitHub remote is connected** (verified via repo remotes).
- Source map: pages in `src/routes/`, shared logic in `src/lib/`, UI in `src/components/`, schema history in `supabase/migrations/` (28 migrations).

## Existing Features
- Customer: home `index`, `menu`, `cart`, `checkout` (15-min pickup slots), `payment`, `receipt.$code` (shareable), `history` (device + phone/code recovery).
- Admin (`/admin/*`): orders dashboard, menu, products/categories, inventory, vendors, cashiers, settings, audit log; finance, payment gateway and bank transfer behind a PIN (`FinanceLock`).
- Vendor (`/vendor`): sees only own items (food/snacks/coffee/drinks), sound alerts, status updates, reports.
- Cashier (`/cashier`): walk-in sales (Cash/POS/Transfer/Online), thermal receipts, receipt list.
- Business day close/reopen + archive (`src/lib/business-day.ts`).

## Database and Data Storage
- 19 tables, all with row-level security on: orders, order_items, customers, menu_items, categories, inventory_history, cashier_sales, cashier_sale_items, app_settings, system_settings, bank_accounts, business_day_closures, audit_log, vendors, user_roles, finance_security/sessions/otps/login_events.
- Orders: `orders` + `order_items`. Walk-in: `cashier_sales` + items. Products/stock: `menu_items` (stock_qty, stock_online, stock_walkin). Payments: columns on `orders` (payment_status/provider/reference) and gateway config in `app_settings.payment_config`. Settings: `system_settings`, `app_settings`.
- File storage (all private): product-images, brand-logos, payment-proofs.
- Current data: 38 orders; users: 1 admin, 4 vendors, 2 cashiers.

## Security
- Roles via `user_roles` + `has_role()`; admin full access, vendors scoped by `vendor_type_for_user`, cashiers limited to walk-in sales.
- Customers have no login; orders created only through `create_customer_order` (server recomputes prices, validates and locks stock). Receipts read via `get_order_by_code` / `get_orders_by_phone`.
- Finance: PIN with lockout + session timeout. OTP tables exist; real OTP delivery not verified.
- Risks: phone-number order recovery exposes order history to anyone who knows a phone number; gateway secret keys stored in a database settings row (admin-only) rather than a secrets vault; finance_otps/finance_security have no policies (locked — fine, function-only access).

## Payments
- Bank transfer: customer uploads proof → status pending verification → admin manually confirms. Verified in code.
- Online: provider-neutral driver (`src/lib/payment/`). **Only Test Mode works.** Live checkout is a placeholder that throws an error; webhook at `src/routes/api/public/opay.webhook.ts` verifies HMAC signature and calls `apply_payment_result` (checks amount, unique reference, status transitions). Live verification cannot be confirmed without real credentials.

## Inventory and Orders
- Stock deducted from the online bucket at order creation (inside the order function, with row locks); walk-in sales deduct the walk-in bucket. Online-first allocation when vendors set totals (`InventoryPanel.tsx`). History in `inventory_history`.
- Order flow: pending → confirmed → preparing → ready → collected; payment unpaid/pending/paid/failed/cancelled/refunded. Cancellation exists only as a payment status; automatic stock restoration on cancel was not verified.

## PWA
- No web manifest, no service worker, no install support. Only `public/favicon.ico`. Not a PWA today.

## Export Capabilities
- PDF: receipts `src/lib/receipt-pdf.ts`, cashier receipts `cashier-receipt-pdf.ts`, reports `report-pdf.ts`.
- Excel: `src/lib/report-xlsx.ts` (end-of-day reports). No dedicated CSV export.

## Migration and Backup Risks
- Backups: managed by Lovable Cloud; I could not verify a schedule or restore test. No in-app backup/export feature exists. Manual export: Cloud → Advanced settings → Export data.
- Portability: code is standard and portable once synced to GitHub. Moving off Lovable Cloud needs: export data, replay migrations on a new Supabase project, re-upload the 3 storage buckets, re-create users (passwords may not transfer), move secrets, re-point webhook URLs, and rehost the server routes (Cloudflare-style runtime).
- Biggest risks: no GitHub copy of the code, unverified backups, live payments not yet active, single shared database for preview and production.

## Suggested next steps (only if you approve later)
1. Connect GitHub for a code backup.
2. Do a manual data export now.
3. Decide on PWA, CSV export, and live payment activation as separate tasks.
