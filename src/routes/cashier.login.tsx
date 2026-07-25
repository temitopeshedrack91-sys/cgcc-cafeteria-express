import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCashierLoginEmail } from "@/lib/cashiers.functions";

export const Route = createFileRoute("/cashier/login")({
  head: () => ({
    meta: [
      { title: "Cashier Login · CGCC Cafeteria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CashierLogin,
});

function CashierLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "cashier" as any)
        .maybeSingle();
      if (role) navigate({ to: "/cashier", replace: true });
    })();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const uname = username.trim().toLowerCase();
      if (!/^cashier[12]$/.test(uname)) {
        toast.error("Unknown cashier username");
        return;
      }
      const { email } = await getCashierLoginEmail({ data: { username: uname as any } });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        toast.error(error?.message ?? "Sign in failed");
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "cashier" as any)
        .maybeSingle();
      if (!role) {
        await supabase.auth.signOut();
        toast.error("This cashier account is not active.");
        return;
      }
      toast.success(`Welcome, ${uname}`);
      navigate({ to: "/cashier" });
    } catch (e: any) {
      toast.error(e.message ?? "Sign in failed");
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
          <h1 className="mt-3 font-display text-2xl font-bold">Cashier Login</h1>
          <p className="text-sm text-muted-foreground">Walk-in sales dashboard</p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="cashier1 or cashier2"
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
