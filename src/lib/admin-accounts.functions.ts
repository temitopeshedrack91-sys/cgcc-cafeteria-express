import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) {
    throw new Error("Forbidden: administrator only");
  }
}

export type AdminAccountInfo = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_current: boolean;
};

export const listAdminAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const accounts: AdminAccountInfo[] = [];
    for (const row of roleRows ?? []) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      const u = userRes?.user;
      if (!u) continue;
      accounts.push({
        id: u.id,
        email: u.email ?? "(no email)",
        created_at: u.created_at ?? row.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        is_current: u.id === context.userId,
      });
    }

    return {
      currentUserId: context.userId,
      accounts,
    };
  });

export const updateMyAdminLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email().max(150).optional(),
        password: z.string().min(8).max(128).optional(),
      })
      .refine((v) => Boolean(v.email || v.password), {
        message: "Provide a new email or password",
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const nextEmail = data.email?.trim().toLowerCase();
    const updatePayload: {
      email?: string;
      email_confirm?: boolean;
      password?: string;
    } = {};

    if (nextEmail) {
      updatePayload.email = nextEmail;
      updatePayload.email_confirm = true;
    }
    if (data.password) {
      updatePayload.password = data.password;
    }

    const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      updatePayload,
    );
    if (error) throw error;

    try {
      await context.supabase.rpc("log_audit", {
        _action: nextEmail ? "admin.email_change" : "admin.password_change",
        _entity: "auth",
        _entity_id: context.userId,
        _detail: { email_changed: Boolean(nextEmail), password_changed: Boolean(data.password) },
      });
    } catch {
      /* audit logging must not block credentials update */
    }

    return {
      ok: true,
      email: updated.user?.email ?? nextEmail ?? null,
      emailChanged: Boolean(nextEmail),
    };
  });

export const createAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email().max(150),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const createRes = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    const userId = createRes.data?.user?.id;
    if (createRes.error || !userId) {
      throw new Error(
        createRes.error?.message || "Could not create admin login. Use an unused email address.",
      );
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Could not assign admin access. The new login was rolled back.");
    }

    try {
      await context.supabase.rpc("log_audit", {
        _action: "admin.create",
        _entity: "auth",
        _entity_id: userId,
        _detail: { email },
      });
    } catch {
      /* ignore */
    }

    return { ok: true, id: userId, email };
  });

export const setAdminAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isTargetAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.targetUserId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isTargetAdmin) throw new Error("Target account is not an administrator");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      password: data.password,
    });
    if (error) throw error;

    await supabaseAdmin.auth.admin.signOut(data.targetUserId, "global").catch(() => undefined);

    return { ok: true };
  });

export const signOutAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ targetUserId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(data.targetUserId, "global");
    if (error) throw error;
    return { ok: true };
  });

export const removeAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ targetUserId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.targetUserId === context.userId) {
      throw new Error("You cannot remove your own currently signed-in admin access.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allAdmins, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (countErr) throw countErr;
    if ((allAdmins ?? []).length <= 1) {
      throw new Error("At least one administrator account must remain active.");
    }

    await supabaseAdmin.auth.admin.signOut(data.targetUserId, "global").catch(() => undefined);

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("role", "admin");
    if (error) throw error;

    try {
      await context.supabase.rpc("log_audit", {
        _action: "admin.remove",
        _entity: "auth",
        _entity_id: data.targetUserId,
        _detail: {},
      });
    } catch {
      /* ignore */
    }

    return { ok: true };
  });
