import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, Hash, ShoppingBasket, UtensilsCrossed } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/menu-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CGCC Cafeteria Express — Order Ahead. Skip the Queue." },
      {
        name: "description",
        content:
          "Browse the CGCC cafeteria menu, pre-order your meals, pay by bank transfer, and pick up with ease.",
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

const STEPS = [
  { icon: UtensilsCrossed, title: "Choose your food", desc: "Browse the menu and add items to your cart." },
  { icon: CreditCard, title: "Make payment", desc: "Pay securely via bank transfer to OPay." },
  { icon: Hash, title: "Receive Order Code", desc: "Get a unique code the cafeteria uses to serve you." },
  { icon: ShoppingBasket, title: "Pick up your meal", desc: "Skip the queue and collect your order in minutes." },
];

function LandingPage() {
  const orderingOpen = useStore((s) => s.orderingOpen);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-brand opacity-10" />
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 md:pt-16">
          <div className="flex flex-col items-center text-center">
            <Logo className="h-16 w-auto md:h-20" />
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Cafeteria · Pre-order
            </span>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight md:text-6xl">
              CGCC Cafeteria <span className="text-brand">Express</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
              Order Ahead. Skip the Queue. Pick Up with Ease.
            </p>

            {!orderingOpen && (
              <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Online ordering is currently unavailable. Please visit the cafeteria directly.
              </p>
            )}

            <div className="mt-8">
              <Button
                asChild
                size="lg"
                className="h-14 rounded-full bg-primary px-8 text-base shadow-elegant hover:opacity-90"
                disabled={!orderingOpen}
              >
                <Link to="/menu">
                  Order Food
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold">How it works</h2>
          <p className="mt-2 text-sm text-muted-foreground">Four simple steps from craving to collection.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <span className="absolute right-4 top-4 font-display text-3xl font-bold text-brand/40">
                0{i + 1}
              </span>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Explore the menu</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tap a category to jump straight in.</p>
          </div>
          <Link to="/menu" className="hidden text-sm font-semibold text-primary hover:underline sm:block">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/menu"
              search={{ cat: c }}
              className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand hover:shadow-elegant"
            >
              <div className="text-4xl">{CATEGORY_EMOJI[c]}</div>
              <div className="mt-3 font-display text-base font-semibold">{c}</div>
              <div className="mt-1 text-xs text-muted-foreground group-hover:text-primary">
                Browse →
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
