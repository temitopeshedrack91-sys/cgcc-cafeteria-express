import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, Check, Database, ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import sqlContent from "../../public/full_schema_setup.sql?raw";

export const Route = createFileRoute("/schema-setup")({
  head: () => ({
    meta: [
      { title: "Supabase Database Setup Script · CGCC Cafeteria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SchemaSetupPage,
});

function SchemaSetupPage() {
  const [copied, setCopied] = useState(false);

  function handleDownload() {
    try {
      const blob = new Blob([sqlContent], { type: "application/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "full_schema_setup.sql";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Downloaded full_schema_setup.sql!");
    } catch (e) {
      toast.error("Failed to trigger download. Use the Copy button instead.");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sqlContent);
      setCopied(true);
      toast.success("Copied entire SQL setup script (3,500+ lines) to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      toast.error("Clipboard access failed. Please use Download button.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-20">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Cafeteria
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Supabase Database Setup Script</h1>
            <p className="text-sm text-muted-foreground">
              Complete consolidated schema, tables, functions, triggers, and cafeteria products seed.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" className="h-12 rounded-xl" onClick={handleDownload}>
            <Download className="mr-2 h-5 w-5" />
            Download full_schema_setup.sql
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-xl"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-5 w-5 text-emerald-600" />
                Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-5 w-5" />
                Copy Entire SQL Script
              </>
            )}
          </Button>

          <Button asChild variant="ghost" size="lg" className="h-12 rounded-xl ml-auto">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              Open Supabase Dashboard
              <ExternalLink className="ml-1.5 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="font-display text-lg font-bold">What this script configures:</h2>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-primary">✔ 21 Database Tables</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Categories, menu items, orders, order items, vendors, inventory history, cashier sales, settings, and finance security.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-primary">✔ 45 Pre-Seeded Products</p>
            <p className="mt-1 text-xs text-muted-foreground">
              All cafeteria food, snacks, pastries, coffees, teas, and drinks with prices, photos, and initial stock quantities.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-primary">✔ 49 Functions & Triggers</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Price enforcement, dual stock decrements, vendor permissions triggers, and secure payment status RPCs.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-primary">✔ Storage Buckets</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-configures product-images, brand-logos, and payment-proofs buckets with secure RLS policies.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            SQL Preview (First 50 lines)
          </span>
          <span className="text-xs text-muted-foreground">
            Total size: {(sqlContent.length / 1024).toFixed(1)} KB (~3,500 lines)
          </span>
        </div>
        <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-zinc-950 p-4 font-mono text-xs text-zinc-200">
          {sqlContent.slice(0, 3000)}
          {"\n\n-- ... [3,400+ more lines in full script] ..."}
        </pre>
      </div>
    </div>
  );
}
