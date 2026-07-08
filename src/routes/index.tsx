import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CreditCard,
  Package,
  Receipt,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/menu-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CGCC Cafeteria Express — Skip the Queue. Enjoy More Time." },
      {
        name: "description",
        content:
          "Pre-order your meals before arriving at the CGCC Cafeteria. Make payment, receive your order code and pick up without waiting in line.",
      },
    ],
  }),
  component: LandingPage,
});

const CATEGORY_EMOJI: Record<string, string> = {
  Meals: "🍚",
  Proteins: "🍗",
  "Soups & Sides": "🥘",
  "Snacks & Pastries": "🥟",
  Sandwiches: "🥪",
  "Small Chops": "🍡",
  "Desserts & Yogurt": "🍨",
  "Coffee & Tea": "☕",
  Drinks: "🥤",
  Water: "💧",
  Extras: "🥡",
};

const FEATURES = [
  {
    icon: Zap,
    emoji: "⚡",
    title: "Skip the Queue",
    desc: "Avoid long waiting lines during busy service periods.",
  },
  {
    icon: CreditCard,
    emoji: "💳",
    title: "Easy Payment",
    desc: "Simple bank transfer to the official cafeteria account.",
  },
  {
    icon: Receipt,
    emoji: "🧾",
    title: "Instant Receipt",
    desc: "Receive a downloadable receipt and unique Order Code after confirming payment.",
  },
  {
    icon: Package,
    emoji: "📦",
    title: "Quick Pickup",
    desc: "Arrive, present your Order Code and collect your order.",
  },
];

function LandingPage() {
  const orderingOpen = useStore((s) => s.orderingOpen);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-brand opacity-10" />
        <div
          className="absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/30 blur-3xl"
          aria-hidden
        />
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-10 md:pt-16">
          <div className="flex flex-col items-center text-center animate-fade-in">
            <Logo className="h-14 w-auto md:h-16" />
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              CGCC Cafeteria · Pre-order
            </span>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Skip the Queue.{" "}
              <span className="text-brand">Enjoy More Time.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Pre-order your meals before arriving at the CGCC Cafeteria. Make
              payment, receive your order code and simply pick up your meal
              without waiting in line.
            </p>

            {!orderingOpen && (
              <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Online ordering is currently unavailable. Please visit the
                cafeteria directly.
              </p>
            )}

            <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 w-full rounded-full bg-primary px-8 text-base shadow-elegant transition hover:opacity-90 sm:w-auto"
                disabled={!orderingOpen}
              >
                <Link to="/menu">
                  🍽️ Start Your Order
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 w-full rounded-full border-primary/30 bg-background/70 px-8 text-base backdrop-blur transition hover:bg-primary/5 sm:w-auto"
              >
                <Link to="/menu">Browse Menu</Link>
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Fast pickup
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Secure payment
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                No waiting
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why use */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            Why choose us
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Why Use CGCC Cafeteria Express?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            A faster, simpler way to enjoy your favourite meals at church.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand/60 hover:shadow-elegant"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand opacity-0 transition group-hover:opacity-100" />
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">
                <span className="mr-1.5">{f.emoji}</span>
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold md:text-3xl">
              Explore the menu
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap a category to jump straight in.
            </p>
          </div>
          <Link
            to="/menu"
            className="shrink-0 text-sm font-semibold text-primary hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/menu"
              search={{ cat: c }}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand hover:shadow-elegant"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-2xl transition group-hover:scale-110">
                {CATEGORY_EMOJI[c]}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">
                  {c}
                </div>
                <div className="text-xs text-muted-foreground group-hover:text-primary">
                  Browse →
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-border bg-gradient-to-br from-primary to-primary/90 p-8 text-center text-primary-foreground shadow-elegant">
          <UtensilsCrossed className="h-8 w-8 text-brand" />
          <h3 className="font-display text-2xl font-bold">
            Ready to order?
          </h3>
          <p className="max-w-md text-sm text-primary-foreground/80">
            Beat the lunch rush. Place your order in under a minute and pick up
            when it's ready.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-2 h-12 rounded-full bg-brand px-8 text-base font-semibold text-brand-foreground hover:opacity-90"
            disabled={!orderingOpen}
          >
            <Link to="/menu">
              🍽️ Start Your Order
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
