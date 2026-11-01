# Safe launch completion

- [x] Verify public secret denial and preserve vendor identities.
- [x] Finish individual vendor stock/preparation permissions; restricted tests and Admin refresh persistence passed, original permissions restored.
- [ ] Separate vendors from categories and support configurable product/account management and imports.
- [ ] Add configurable payout/commission with historical transaction snapshots.
- [ ] Preserve both payments, add enable/default settings and verify trusted payment boundaries; keep live payments disabled.
- [ ] Add itemised date-filtered Excel/PDF exports matching supplied workbook.
- [ ] Add online-only PWA installation support.
- [ ] Verify role restrictions, stock, ordering, cancellation, payments, receipts, exports and installation; report remaining blockers.

## Verification and remaining scope
- Bank-transfer test order CG-044 saved pending/manual_transfer; receipt reload and same-device history passed. No money transferred.
- Seven existing permission/payment-selection tests passed. Customer menu/cart/checkout now use current database products and customer category grouping.
- All 11 permission, category, payment-choice and unsigned-callback tests passed. Payment return routing corrected; browser simulated success for CG-044 leaves its saved payment pending.
- Online payment remains test-only; provider integration and trusted live verification are blocked pending supported documentation, credentials and end-to-end tests.
- Account creation/password/reset end-to-end, cancellation, Finance secret-save persistence, future vendor entities, pricing snapshots, exports/import and installation remain unverified or unfinished; do not claim safe-launch completion.