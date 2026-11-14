import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { resolveVendorLoginEmail, touchVendorLogin } from "@/lib/vendors.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/vendor/login")({
  head: () => ({ meta: [...pageMeta("Vendor Login · CGCC Cafeteria", "Sign in to your CGCC Vendor workspace."), { name: "robots", content: "noindex" }] }),
  component: VendorLogin,
});

function VendorLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // If already signed in as a vendor, go to dashboard
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      const { data: v } = await supabase
        .from("vendors")
        .select("vendor_type, active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (v?.active) navigate({ to: "/vendor", replace: true });
    })();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const uname = username.trim().toLowerCase();
      const lookup = await resolveVendorLoginEmail({ data: { username: uname } });
      if (!lookup.found) {
        toast.error("Unknown vendor username");
        return;
      }
      if (!lookup.active) {
        toast.error("This vendor account is currently inactive. Contact the administrator.");
        return;
      }
      if (!lookup.loginEmail) {
        toast.error("This vendor account has no login email set. Contact the administrator.");
        return;
      }
      const email = lookup.loginEmail;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        toast.error(error?.message ?? "Sign in failed");
        return;
      }
      // Confirm vendor row is active
      const { data: v } = await supabase
        .from("vendors")
        .select("vendor_type, active")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!v || !v.active) {
        await supabase.auth.signOut();
        toast.error("This vendor account is not active. Contact the administrator.");
        return;
      }
      try {
        await touchVendorLogin();
      } catch {
        // Non-blocking audit timestamp
      }
      toast.success(`Welcome, ${uname} vendor`);
      navigate({ to: "/vendor" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-primary px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-elegant">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-12 w-auto" />
          <div className="mt-4 grid h-10 w-10 place-items-center rounded-full bg-brand/20">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold">Vendor Login</h1>
          <p className="text-sm text-muted-foreground">
            CGCC Cafeteria vendor dashboard
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your vendor username"
              className="mt-1.5"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
