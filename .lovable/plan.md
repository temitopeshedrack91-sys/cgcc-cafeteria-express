## Context

Price/total tampering is already blocked at the row level by three triggers:
- `enforce_order_item_price` overwrites `price`/`name`/`vendor_type` from `menu_items` on insert.
- `recompute_order_total` recomputes `orders.total` from child rows.
- `reset_order_total` forces `total = 0` on new orders.

However, the `orders` and `order_items` tables still expose a direct INSERT path to `anon` and `authenticated` via `USING/WITH CHECK (true)` policies. That is what the scanner is flagging (it also matches "RLS Policy Always True"). Guests can still POST rows directly through PostgREST — the triggers stop them from lying about prices, but the permissive policy itself is the finding.

The app already routes all customer checkouts through the `create_customer_order` RPC (`src/lib/store.ts:405`), which is `SECURITY DEFINER` and does its own validation. Nothing in the client inserts into `orders` / `order_items` directly.

## Change

Single migration:

1. `DROP POLICY "public inserts orders" ON public.orders;`
2. `DROP POLICY "public inserts order_items" ON public.order_items;`
3. Revoke `INSERT` on both tables from `anon` and `authenticated` (keep `service_role`).
4. Leave existing triggers in place as defense-in-depth.

No app-code changes — checkout continues to work via the existing RPC.

## Verification

- Run the Supabase linter; `orders_client_supplied_totals` and `SUPA_rls_policy_always_true` (for these two policies) should clear.
- Place a test order from the app to confirm the RPC path still succeeds.
