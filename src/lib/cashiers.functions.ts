import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CashierUsername = "cashier1" | "cashier2";

const DEFAULTS: Record<CashierUsername, { email: string; password: string }> = {
  cashier1: { email: "cashier1@cgcc.local", password: "cgcccashier01" },
  cashier2: { email: "cashier2@cgcc.local", password: "cgcccashier02" },
};

export const CASHIER_USERNAMES: CashierUsername[] = ["cashier1", "cashier2"];

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Forbidden: administrator only");
}

function findCashier(users: any[], username: CashierUsername) {
  return users.find((x: any) => x.user_metadata?.cashier_username === username);
}

export type CashierRow = {
  username: CashierUsername;
  email: string;
  user_id: string | null;
  active: boolean;
  last_sign_in_at: string | null;
};

export const listCashiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashierRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = list?.users ?? [];
    const rows: CashierRow[] = [];
    for (const u of CASHIER_USERNAMES) {
      const defaultEmail = DEFAULTS[u].email;
      const user = findCashier(users, u);
      let active = false;
      if (user) {
        const { data: role } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "cashier")
          .maybeSingle();
        active = !!role;
      }
      rows.push({
        username: u,
        email: user?.email ?? defaultEmail,
        user_id: user?.id ?? null,
        active,
        last_sign_in_at: (user as any)?.last_sign_in_at ?? null,
      });
    }
    return rows;
  });

export const initCashiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created: CashierUsername[] = [];
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = list?.users ?? [];
    for (const u of CASHIER_USERNAMES) {
      const { email, password } = DEFAULTS[u];
      let userId: string | null = findCashier(users, u)?.id ?? null;
      if (!userId) {
        // Avoid creating a duplicate if the default email already exists; just tag it.
        const existingByEmail = users.find((x: any) => x.email === email);
        if (existingByEmail) {
          await supabaseAdmin.auth.admin.updateUserById(existingByEmail.id, {
            user_metadata: { cashier_username: u },
          });
          userId = existingByEmail.id;
        } else {
          const res = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { cashier_username: u },
          });
          userId = res.data?.user?.id ?? null;
          if (userId) created.push(u);
        }
      }
      if (!userId) continue;
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "cashier" as any }, { onConflict: "user_id,role" });
    }
    return { created };
  });

export const setCashierPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.enum(["cashier1", "cashier2"]),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = findCashier(list?.users ?? [], data.username);
    if (!user) throw new Error("Cashier account not found. Run setup first.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true };
  });

export const setCashierActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.enum(["cashier1", "cashier2"]),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = findCashier(list?.users ?? [], data.username);
    if (!user) throw new Error("Cashier account not found.");
    if (data.active) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: user.id, role: "cashier" as any }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("role", "cashier" as any);
    }
    return { ok: true };
  });

export const updateCashierEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.enum(["cashier1", "cashier2"]),
        email: z.string().email(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = findCashier(list?.users ?? [], data.username);
    if (!user) throw new Error("Cashier account not found.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw error;
    return { ok: true };
  });

export const getCashierLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.enum(["cashier1", "cashier2"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = findCashier(list?.users ?? [], data.username);
    if (!user) throw new Error("Cashier account not found.");
    return { email: user.email as string };
  });

export function cashierEmailFor(username: string): string | null {
  const u = username.trim().toLowerCase() as CashierUsername;
  return DEFAULTS[u]?.email ?? null;
}
