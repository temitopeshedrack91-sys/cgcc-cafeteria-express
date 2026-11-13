import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { CashierShell } from "@/components/CashierShell";

export const Route = createFileRoute("/cashier/login")({
  head: () => ({
    meta: [
      ...pageMeta("Online Pre-Orders Only · CGCC Cafeteria", "Walk-in cashier module is disabled."),
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <CashierShell />,
});
