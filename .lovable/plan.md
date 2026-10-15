# CGCC Cafeteria Express: Permissions, Inventory and Payment Review and Staged Plan

This review only looked at the app. No code, data, users or settings were changed.

## Findings

### 1. Admin permissions
Admin can currently manage: orders and payment confirmation, products and categories (add, edit, archive, delete, bulk actions, images), inventory, vendors (create, turn on or off, reset password), cashiers (email and password), system settings and logos, business day close and reopen, the audit log, and Finance (bank accounts, bank transfer, online gateway) behind a PIN.
Missing:
- Admin cannot set permissions for individual staff members. Permissions come only from fixed roles.
- There is no setting for the default payment method.
- There is no service-staff role.
- There is no screen to manage roles for all users in one place.
- There is no forced password change.

### 2. Vendor permissions (checked against the live database)
- Creating, deleting and archiving products and changing prices: blocked in the database. These actions are admin-only.
- Changing stock (total, online/walk-in split, reallocation): allowed, but only for the vendor's own items. The stock functions record the vendor as the source.
- **Gap:** a database rule lets vendors directly edit their own product rows. That covers every column, including **price**, name, availability, vendor and category. The vendor screen does not offer this, but the database would accept the change. This is the main risk to fix.
- Order status: vendors can update preparation status on their own order items only. The same rule lets them edit price and quantity on those items, and the database does not block it. Order totals are recalculated by triggers, so this is still a risk.
- Vendors can read only orders that include their items.

### 3. Cashier and service staff
- Cashiers can create walk-in sales, but only through a protected function that sets prices and deducts walk-in stock. They can read their own sales and print receipts.
- The two cashier accounts are fixed (cashier1 and cashier2). There is no service-staff role.
- To give one staff member different permissions from another, a new permission table checked inside the database functions is needed. Hiding buttons alone is not enough.

### 4. Password management
- Admin can set a new password directly for vendors and cashiers.
- No user can change their own password, and there is no "forgot password" email.
- **Risk:** default cashier passwords are written into the app's code and reapplied when accounts are set up.
- The Finance PIN has its own change flow.

### 5. Payment configuration
- Bank transfer settings and the list of bank accounts are stored separately from the online gateway. Bank transfer has an on/off switch.
- The online gateway has on/off, test/live mode, a provider choice and stored credentials. Only test mode works.
- The checkout payment page shows each method that is switched on.
- **Risk:** gateway secret keys are stored in a settings row that every visitor can read. All signed-out visitors can read settings, so the secret and webhook keys are exposed. This is a serious issue.
- Default method: add a `defaultMethod` value to the settings. Checkout preselects it but falls back to bank transfer when the default is turned off. Payment verification stays as it is.

### 6. Inventory controls
- Admin already has full control through the protected stock functions.
- Allowing only authorised staff means adding per-person permission checks inside those functions and removing direct product edits by vendors.

### 7. Audit logging
- Recorded: product and price changes, stock changes (in a separate inventory history), gateway saves, settings saves, business day close, and finance events.
- Not recorded consistently: order status and payment confirmation changes, which are made by direct updates. Permission and role changes are not recorded because the feature does not exist yet.
- **Risk:** any signed-in user can write audit entries, so entries can be faked.

### 8. Security enforcement
Most rules are enforced in the database. The exceptions are the vendor product and order-item edit rules (item 2), readable gateway secrets (item 5) and open audit writes (item 7). Each of these must be fixed in the database itself.

## Staged plan (each stage is separate and needs approval)

**Stage 1: Close the security gaps (highest priority)**
- Move gateway secrets out of the publicly readable settings row into an admin-only place, and check how the webhook reads them.
- Replace the vendor product edit rule with a function that changes only availability. Limit vendor order-item updates to preparation status only.
- Only allow audit entries to be written by the protected functions.
- Files: database changes, `src/lib/payment/config.ts`, `src/routes/api/public/opay.webhook.ts`, `src/routes/vendor.index.tsx`, `src/lib/admin-ops.ts`.
- Risk: the vendor availability toggle and the webhook could break.
- Tests: a vendor tries to change a price and is refused. A visitor cannot read secrets. The webhook test still passes. A customer order and a bank transfer still work.

**Stage 2: Audit order and payment changes**
- Move admin and vendor status changes into protected functions that write audit entries.
- Files: `src/routes/admin.index.tsx`, `src/routes/vendor.index.tsx`, `src/lib/store.ts`.
- Tests: each status change appears in the audit log.

**Stage 3: Default payment method**
- Add a setting and selector in Finance → Bank Transfer / Gateway. Checkout preselects the default with a safe fallback.
- Files: `src/lib/transfer-settings.ts`, `src/routes/payment.tsx`, the admin finance pages.
- Tests: all on/off combinations work, and bank transfer is still always reachable when it is enabled.

**Stage 4: Per-staff permissions**
- Add a `staff_permissions` table (user plus a permission such as `stock.increase`, `stock.reduce`, `stock.allocate_online` or `order.update_status`), a `has_permission()` check, and an Admin screen to grant permissions.
- Optionally add a `service_staff` role.
- Enforce the checks inside the stock and sale functions.
- Tests: a staff member without a permission is refused by the database, and Admin is always allowed.

**Stage 5: Passwords**
- Add "Change my password" for every signed-in user and an Admin-started password reset with a temporary password and forced change.
- Remove the default passwords from the code.
- Tests: logging in with the old password fails and the new one works.

## Preserved throughout
The customer ordering flow, products, order history, bank transfer verification and payment result logic stay as they are.
