## Phase 2 – Vendor Operations, Real-Time Alerts & Reporting

Scope is strictly the vendor dashboard, admin reports section, and a shared reporting utility. No changes to auth, customer ordering, payment, or database schema (data already carries `vendor_type`, `pickup_time`, `preparation_status`, `created_at`, and totals).

### 1. Vendor dashboard upgrades (`src/routes/vendor.index.tsx`)

- **New-order detection**: keep a `useRef<Set<string>>` of known `order.id`s. On each realtime refresh, diff against the previous set — any new id whose items belong to this vendor triggers:
  - A beep via a small `useSound()` hook (WebAudio oscillator — no asset needed, works offline).
  - A stacked toast/notification card ("🔔 New Order · CG-145 · Pickup 11:30 AM · John") that persists until the vendor clicks "Acknowledge". Status changes on existing orders do NOT beep.
  - Browser `Notification` if permission granted (opt-in button in header).
- **Counter cards** above the order list: New / Preparing / Ready / Collected / Pending Payment, derived from current orders. Auto-updates via existing realtime subscription.
- **Order card metadata**: show Day, full Date, and Time (e.g. "Sunday · 27 July 2026 · 10:42 AM") using `Intl.DateTimeFormat`.
- **Per-order actions**: "Download PDF" (reuse `generateReceiptPdf` from `src/lib/receipt-pdf.ts`) and "View Full Receipt" (opens `/receipt/{code}` in new tab). Print stays as `window.print()` on the receipt page (already works).
- **End of Day Report button** in the header → opens a dialog with date filter (Today / Yesterday / This Week / Custom range) and Download PDF / Download Excel actions.

### 2. Reporting utility (new files)

- `src/lib/reports.ts` — pure functions:
  - `filterOrdersInRange(orders, from, to)`
  - `computeVendorReport(orders, vendorType)` → returns `{ received, completed, pending, cancelled, revenue, itemSummary: [{name, qty, revenue}], collectionStatus }`
  - `computeOverallReport(orders)` → per-vendor breakdown + totals.
- `src/lib/report-pdf.ts` — uses existing `jspdf` to render a branded report (header, meta, KPI grid, per-order table, aggregated product summary at the bottom).
- `src/lib/report-xlsx.ts` — uses `xlsx` (SheetJS) to build a multi-sheet workbook: Summary, Orders, Product Summary. Add dependency: `bun add xlsx`.
- Shared `ReportDialog` component (`src/components/ReportDialog.tsx`) used by both vendor and admin views — takes a `scope: VendorType | "all"` prop and the orders array.

### 3. Admin reports section (`src/routes/admin.index.tsx`)

- New "Vendor Reports" card block with buttons: Food, Snacks, Coffee, Drinks, Overall — each opens the same `ReportDialog` scoped accordingly. Admin already fetches all orders, so no extra query.

### 4. Data assumptions

- Vendor sees only their items — already enforced by RLS + current filter in `vendor.index.tsx`. No changes needed for Feature 4.
- Cancelled orders: treat `pickup_status === "cancelled"` if present, else 0. Collection status: count of items with `preparation_status === "collected"` vs total.
- Revenue per vendor = sum of `price × qty` of that vendor's items on paid orders in range.

### 5. Files touched

- Edit: `src/routes/vendor.index.tsx`, `src/routes/admin.index.tsx`
- New: `src/lib/reports.ts`, `src/lib/report-pdf.ts`, `src/lib/report-xlsx.ts`, `src/components/ReportDialog.tsx`, `src/hooks/use-notification-sound.ts`
- Package: add `xlsx`

### Out of scope (per prompt)

Auth, DB schema, customer flow, payment, admin dashboard layout beyond adding the Reports block, vendor RLS.

Approve to proceed?
