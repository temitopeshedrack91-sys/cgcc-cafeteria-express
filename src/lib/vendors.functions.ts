import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VendorType = "food" | "snacks" | "coffee" | "drinks";

export const VENDOR_TYPES: VendorType[] = ["food", "snacks", "coffee", "drinks"];

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  food: "Food",
  snacks: "Snacks",
  coffee: "Coffee",
  drinks: "Drinks",
};

const DEFAULTS: Record<VendorType, { username: string; email: string }> = {
  food: { username: "food", email: "food@vendor.cgcc.local" },
  snacks: { username: "snacks", email: "snacks@vendor.cgcc.local" },
  coffee: { username: "coffee", email: "coffee@vendor.cgcc.local" },
  drinks: { username: "drinks", email: "drinks@vendor.cgcc.local" },
};

const vendorTypeSchema = z.enum(["food", "snacks", "coffee", "drinks"]);

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) {
    throw new Error("Forbidden: administrator only");
  }
}

async function findVendor(supabaseAdmin: any, vendorId: string) {
  const { data: v, error } = await supabaseAdmin
    .from("vendors")
    .select("id, user_id, vendor_type, username")
    .eq("id", vendorId)
    .maybeSingle();
  if (error || !v) throw new Error("Staff account not found");
  return v;
}

export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("id, user_id, vendor_type, username, display_label, can_manage_stock, active, last_login, created_at")
      .order("vendor_type")
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  });

export const initVendors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin.from("vendors").select("vendor_type");
    const have = new Set((existing ?? []).map((v: any) => v.vendor_type));

    const created: VendorType[] = [];
    for (const vt of VENDOR_TYPES) {
      if (have.has(vt)) continue;
      const { email, username } = DEFAULTS[vt];

      let userId: string | null = null;
      const createRes = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { vendor_type: vt, username },
      });
      if (createRes.data?.user) {
        userId = createRes.data.user.id;
      } else {
        // Look up if user already exists
        const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = list.data?.users?.find((u: any) => u.email === email);
        if (found) userId = found.id;
      }
      if (!userId) continue;

      // Grant vendor role
      const roleName = `${vt}_vendor` as const;
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: roleName as any }, { onConflict: "user_id,role" });

      await supabaseAdmin.from("vendors").insert({
        user_id: userId,
        vendor_type: vt,
        username,
        display_label: `${VENDOR_TYPE_LABELS[vt]} Vendor`,
        active: true,
      });
      created.push(vt);
    }
    return { created };
  });

/** Add an extra staff account under one of the four sections. */
export const createVendorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vendorType: vendorTypeSchema,
        username: z.string().min(2).max(40).regex(/^[a-z0-9_.-]+$/i, "Letters, numbers, dot, dash, underscore only"),
        email: z.string().email().max(120),
        label: z.string().min(2).max(60),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const temp = randomPassword().slice(0, 12);

    const createRes = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temp,
      email_confirm: true,
      user_metadata: { vendor_type: data.vendorType, username: data.username },
    });
    let userId = createRes.data?.user?.id ?? null;
    if (!userId) {
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list.data?.users?.find((u: any) => u.email === email);
      if (found) {
        userId = found.id;
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: temp });
      }
    }
    if (!userId) throw new Error("Could not create the login account");

    const roleName = `${data.vendorType}_vendor` as const;
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: roleName as any }, { onConflict: "user_id,role" });

    const { error } = await supabaseAdmin.from("vendors").insert({
      user_id: userId,
      vendor_type: data.vendorType,
      username: data.username.trim(),
      display_label: data.label.trim(),
      active: true,
    });
    if (error) throw error;
    return { ok: true, temporaryPassword: temp, email };
  });

export const setVendorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vendorId: z.string().uuid(),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const v = await findVendor(supabaseAdmin, data.vendorId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(v.user_id, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true };
  });

export const resetVendorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vendorId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const v = await findVendor(supabaseAdmin, data.vendorId);
    const temp = randomPassword().slice(0, 12);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(v.user_id, {
      password: temp,
    });
    if (error) throw error;
    return { ok: true, temporaryPassword: temp };
  });

export const setVendorActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vendorId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vendors")
      .update({ active: data.active })
      .eq("id", data.vendorId);
    if (error) throw error;
    return { ok: true };
  });

export const setVendorLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vendorId: z.string().uuid(), label: z.string().min(2).max(60) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vendors")
      .update({ display_label: data.label.trim() })
      .eq("id", data.vendorId);
    if (error) throw error;
    return { ok: true };
  });

export const setVendorStockPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vendorId: z.string().uuid(), canManageStock: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vendors")
      .update({ can_manage_stock: data.canManageStock })
      .eq("id", data.vendorId);
    if (error) throw error;
    return { ok: true };
  });

export const touchVendorLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("vendors")
      .update({ last_login: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });
