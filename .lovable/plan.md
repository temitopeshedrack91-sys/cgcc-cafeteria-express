## Problem

Admin login fails with "This account is not an administrator." Network logs show:

```
POST /rest/v1/rpc/has_role → 403
{"code":"42501","message":"permission denied for function has_role"}
```

A previous security migration revoked `EXECUTE` on `public.has_role(uuid, app_role)` from `PUBLIC`, `anon`, and `authenticated`. The function still works inside RLS policies (definer rights), but the client's admin check calls it directly via PostgREST as the `authenticated` role — which is now blocked. Result: every login is treated as non-admin.

## Fix

One migration that re-grants `EXECUTE` on `public.has_role(uuid, app_role)` to `authenticated` so the client can call the RPC after sign-in. Keep it revoked from `anon` and `PUBLIC` (anonymous callers should never probe roles).

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
```

This resolves the "not an administrator" error for `temitopeshedrack91@gmail.com` and any future admins. It does not re-open the finding for `anon`, and does not affect `set_order_code()`.

## Notes

- No UI changes.
- No other functions or policies are touched.
- After the migration runs, sign in again at `/admin/login` — the dashboard should load.
