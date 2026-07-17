import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VendorType = "food" | "snacks" | "coffee" | "drinks";

export const VENDOR_TYPES: VendorType[] = ["food", "snacks", "coffee", "drinks"];

const DEFAULTS: Record<VendorType, { username: string; email: string }> = {
  food: { username: "food", email: "food@vendor.cgcc.local" },
  snacks: { username: "snacks", email: "snacks@vendor.cgcc.local" },
  coffee: { username: "coffee", email: "coffee@vendor.cgcc.local" },
  drinks: { username: "drinks", email: "drinks@vendor.cgcc.local" },
};

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

export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("id, user_id, vendor_type, username, active, last_login, created_at")
      .order("vendor_type");
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
        active: true,
      });
      created.push(vt);
    }
    return { created };
  });

export const setVendorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vendorType: z.enum(["food", "snacks", "coffee", "drinks"]),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v, error: e1 } = await supabaseAdmin
      .from("vendors")
      .select("user_id")
      .eq("vendor_type", data.vendorType)
      .maybeSingle();
    if (e1 || !v) throw new Error("Vendor not found");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(v.user_id, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true };
  });

export const resetVendorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vendorType: z.enum(["food", "snacks", "coffee", "drinks"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v, error: e1 } = await supabaseAdmin
      .from("vendors")
      .select("user_id")
      .eq("vendor_type", data.vendorType)
      .maybeSingle();
    if (e1 || !v) throw new Error("Vendor not found");
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
    z
      .object({
        vendorType: z.enum(["food", "snacks", "coffee", "drinks"]),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vendors")
      .update({ active: data.active })
      .eq("vendor_type", data.vendorType);
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
