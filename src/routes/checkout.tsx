import { pageMeta } from "@/lib/page-meta";
import { useSystemSettings } from "@/lib/settings";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actions, cartTotal, formatNaira, useStore } from "@/lib/store";
import {
  findCartStockIssues,
  formatStockIssueMessage,
  verifyLiveStockForCart,
} from "@/lib/stock-guard";
import {
  PICKUP_CLOSING_HOUR,
  PICKUP_INTERVAL_MINUTES,
  PICKUP_NOW_VALUE,
  PICKUP_OPENING_HOUR,
  buildPickupSlots,
  formatClockTime,
  isPickupSlotValid,
} from "@/lib/pickup-times";
import {
  clearCustomerProfile,
  loadCustomerProfile,
  saveCustomerProfile,
} from "@/lib/customer-profile";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [...pageMeta("Checkout · CGCC Cafeteria Express", "Enter your CGCC order details and pickup time.")] }),
  component: CheckoutPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, "Enter a valid phone number"),
  note: z.string().trim().max(200).optional(),
  orderType: z.enum(["dine-in", "takeaway"]),
  pickupTime: z.string().trim().min(1, "Please select your preferred pickup time before placing your order."),
});

const TAKEAWAY_PACK_ID = "e1";

function CheckoutPage() {
  const settings = useSystemSettings();
  const navigate = useNavigate();
  const cart = useStore((s) => s.cart);
  const menu = useStore((s) => s.menu);
  const menuState = useStore((s) => s.menuState);
  const loaded = useStore((s) => s.loaded);
  const total = cartTotal(cart, menu);
  const stockIssues = useMemo(
    () => (loaded ? findCartStockIssues(cart, menu, menuState) : []),
    [loaded, cart, menu, menuState],
  );
  const hasStockIssue = stockIssues.length > 0;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway">("dine-in");
  const [pickupTime, setPickupTime] = useState<string>("");
  const [suggest, setSuggest] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);

  const slots = useMemo(
    () => buildPickupSlots(new Date(), settings),
    [settings],
  );
  const intervalMins =
    settings.pickupIntervalMinutes > 0
      ? settings.pickupIntervalMinutes
      : PICKUP_INTERVAL_MINUTES;

  // Prefill from remembered profile so returning customers don't retype.
  useEffect(() => {
    const p = loadCustomerProfile();
    if (p.name) setName(p.name);
    if (p.phone) setPhone(p.phone);
  }, []);

  async function proceed() {
    if (checkingStock) return;
    if (hasStockIssue) {
      toast.error(formatStockIssueMessage(stockIssues));
      return;
    }
    const parsed = schema.safeParse({ name, phone, note, orderType, pickupTime });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    if (!isPickupSlotValid(pickupTime, new Date(), settings)) {
      toast.error("That pickup time is no longer available. Please pick another.");
      return;
    }
    setCheckingStock(true);
    try {
      const liveIssues = await verifyLiveStockForCart(cart, menu);
      if (liveIssues.length > 0) {
        void actions.refreshMenu();
        toast.error(formatStockIssueMessage(liveIssues));
        return;
      }
    } finally {
      setCheckingStock(false);
    }
    if (
      orderType === "takeaway" &&
      !cart.some((c) => c.itemId === TAKEAWAY_PACK_ID) &&
      !suggest
    ) {
      setSuggest(true);
      return;
    }
    // Remember name + phone on this device for repeat orders.
    saveCustomerProfile({ name: name.trim(), phone: phone.trim() });
    localStorage.setItem(
      "cgcc-checkout-draft",
      JSON.stringify({
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim(),
        orderType,
        pickupTime,
      }),
    );
    navigate({ to: "/payment" });
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <h1 className="font-display text-3xl font-bold">Checkout</h1>
      <p className="text-sm text-muted-foreground">A few details before payment.</p>

      {hasStockIssue && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive space-y-2"
        >
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Stock updated while you were checking out
          </p>
          <p>{formatStockIssueMessage(stockIssues)}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline" className="rounded-full bg-white">
              <Link to="/cart">Update Cart</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="name">Customer name</Label>
            {(name || phone) && (
              <button
                type="button"
                onClick={() => {
                  clearCustomerProfile();
                  setName("");
                  setPhone("");
                  toast("Saved details cleared");
                }}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                Clear saved details
              </button>
            )}
          </div>
          <Input
            id="name"
            className="mt-1.5"
            placeholder="e.g. Grace Adeyemi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            className="mt-1.5"
            placeholder="e.g. 0803 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
          />
        </div>
        <div>
          <Label htmlFor="pickupTime">
            Pickup time <span className="text-destructive">*</span>
          </Label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPickupTime(PICKUP_NOW_VALUE)}
              className={
                "flex items-center gap-3 rounded-xl border p-3 text-left transition " +
                (pickupTime === PICKUP_NOW_VALUE
                  ? "border-brand bg-brand/15 ring-1 ring-brand"
                  : "border-border bg-background hover:border-brand/60")
              }
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-brand">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Pick up now</p>
                <p className="text-xs text-muted-foreground">Prepare my order right away</p>
              </div>
            </button>
            <div
              className={
                "flex items-center gap-2 rounded-xl border p-2 " +
                (pickupTime && pickupTime !== PICKUP_NOW_VALUE
                  ? "border-brand bg-brand/10"
                  : "border-border bg-background")
              }
            >
              <Clock className="ml-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <Select
                value={pickupTime === PICKUP_NOW_VALUE ? "" : pickupTime}
                onValueChange={setPickupTime}
              >
                <SelectTrigger id="pickupTime" className="h-9 border-0 bg-transparent px-1 shadow-none focus:ring-0">
                  <SelectValue placeholder="Schedule a time slot…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={PICKUP_NOW_VALUE}>Pick up now (ASAP)</SelectItem>
                  {slots.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Choose <span className="font-medium text-foreground">Pick up now</span> or select a{" "}
            {intervalMins}-minute slot between{" "}
            {formatClockTime(settings.openingTime, PICKUP_OPENING_HOUR * 60)} and{" "}
            {formatClockTime(settings.closingTime, PICKUP_CLOSING_HOUR * 60)}.
          </p>
        </div>
        <div>
          <Label htmlFor="note">Optional note</Label>
          <Textarea
            id="note"
            className="mt-1.5"
            placeholder='e.g. "No pepper"'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </div>
        <div>
          <Label>Order type</Label>
          <RadioGroup
            className="mt-2 grid grid-cols-2 gap-3"
            value={orderType}
            onValueChange={(v) => {
              setOrderType(v as "dine-in" | "takeaway");
              setSuggest(false);
            }}
          >
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand/10">
              <RadioGroupItem value="dine-in" />
              <div>
                <p className="font-semibold">Dine-in</p>
                <p className="text-xs text-muted-foreground">Eat at the cafeteria</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand/10">
              <RadioGroupItem value="takeaway" />
              <div>
                <p className="font-semibold">Takeaway</p>
                <p className="text-xs text-muted-foreground">Pack and go</p>
              </div>
            </label>
          </RadioGroup>
        </div>

        {suggest && (
          <div className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">
            <p className="font-semibold text-primary">Add a Takeaway Pack?</p>
            <p className="mt-1 text-muted-foreground">
              You've chosen takeaway but no takeaway pack is in your cart. We recommend adding one for a smoother pickup.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigate({ to: "/menu", search: { cat: "Extras" } });
                }}
              >
                Add takeaway pack
              </Button>
              <Button size="sm" variant="ghost" onClick={proceed}>
                Continue without pack
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-soft">
        <span className="text-sm text-muted-foreground">Order total</span>
        <span className="text-xl font-bold text-primary">{formatNaira(total)}</span>
      </div>

      {settings.refundPolicy.trim() && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Return &amp; Refund Policy
          </p>
          <p className="leading-relaxed">{settings.refundPolicy}</p>
        </div>
      )}

      <Button
        size="lg"
        className="mt-6 h-14 w-full rounded-full shadow-elegant"
        onClick={() => void proceed()}
        disabled={hasStockIssue || checkingStock}
      >
        {checkingStock ? "Checking availability…" : "Continue to payment"}
      </Button>
    </div>
  );
}
