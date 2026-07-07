import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cartTotal, formatNaira, useStore } from "@/lib/store";
import { DEFAULT_MENU } from "@/lib/menu-data";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout · CGCC Cafeteria Express" }] }),
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
});

const TAKEAWAY_PACK_ID = "e1";

function CheckoutPage() {
  const navigate = useNavigate();
  const cart = useStore((s) => s.cart);
  const total = cartTotal(cart, DEFAULT_MENU);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway">("dine-in");
  const [suggest, setSuggest] = useState(false);

  function proceed() {
    const parsed = schema.safeParse({ name, phone, note, orderType });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    if (
      orderType === "takeaway" &&
      !cart.some((c) => c.itemId === TAKEAWAY_PACK_ID) &&
      !suggest
    ) {
      setSuggest(true);
      return;
    }
    // Persist checkout details in sessionStorage-lite via localStorage key
    localStorage.setItem(
      "cgcc-checkout-draft",
      JSON.stringify({ name: name.trim(), phone: phone.trim(), note: note.trim(), orderType }),
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

      <div className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div>
          <Label htmlFor="name">Customer name</Label>
          <Input
            id="name"
            className="mt-1.5"
            placeholder="e.g. Grace Adeyemi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
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
          />
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

      <Button size="lg" className="mt-6 h-14 w-full rounded-full shadow-elegant" onClick={proceed}>
        Continue to payment
      </Button>
    </div>
  );
}
