# Make cashier emails editable in Admin UI

## Goal
Allow administrators to change the login email address for cashier1 and cashier2 from the Admin → Cashiers page, without editing code.

## Why this works without schema changes
Cashier accounts are Supabase Auth users with `user_metadata.cashier_username`. The email is already stored on the Auth user. We only need to stop hardcoding it and read/update the real Auth value.

## Changes

### 1. Backend functions (`src/lib/cashiers.functions.ts`)
- Replace the hardcoded email lookup with a helper that finds each cashier by `user_metadata.cashier_username`.
- Update `listCashiers` to return the actual Auth email instead of `DEFAULTS[u].email`.
- Update `initCashiers`, `setCashierPassword`, and `setCashierActive` to use the username-based helper.
- Add `updateCashierEmail(username, email)` admin-only function to change the Auth user email (with `email_confirm: true`).
- Add `getCashierLoginEmail(username)` public function used by the login page to resolve the current email for sign-in.

### 2. Login page (`src/routes/cashier.login.tsx`)
- Remove the `{username}@cgcc.local` hardcoded email.
- Call `getCashierLoginEmail(username)` before signing in and use the returned email with `signInWithPassword`.

### 3. Admin Cashier UI (`src/routes/admin.cashiers.tsx`)
- Add an editable email input on each cashier card.
- Add a "Save Email" button that calls `updateCashierEmail`.
- Validate email format with Zod before calling the server.

## No database migration needed
All state lives in Supabase Auth (`auth.users.email` and `user_metadata`).

## Verification
- Create cashiers via Admin → Cashiers.
- Change the email for one cashier.
- Log in on `/cashier/login` with the new email's password.
- Confirm the old hardcoded email no longer works.