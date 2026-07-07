import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { actions, useStore } from "@/lib/store";
import { toast } from "sonner";

const ADMIN_EMAIL = "admin@cgcccafeteria.local";
const ADMIN_PASSWORD = "CGCC@2026!";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login · CGCC Cafeteria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const loggedIn = useStore((s) => s.adminLoggedIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (loggedIn) navigate({ to: "/admin" });
  }, [loggedIn, navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      actions.adminLogin();
      toast.success("Welcome, Admin");
      navigate({ to: "/admin" });
    } else {
      toast.error("Invalid credentials");
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
          <h1 className="mt-3 font-display text-2xl font-bold">Admin Login</h1>
          <p className="text-sm text-muted-foreground">CGCC Cafeteria control center</p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
          <Button type="submit" size="lg" className="w-full rounded-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
