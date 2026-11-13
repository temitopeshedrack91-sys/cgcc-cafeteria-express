// System settings (database-driven). Everything here is editable from
// Admin → System Settings — no code changes required.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SystemSettings = {
  churchName: string;
  cafeteriaName: string;
  churchLogoUrl: string;
  cafeteriaLogoUrl: string;
  contactPhone: string;
  officialEmail: string;
  address: string;
  operatingDays: string[];
  openingTime: string; // HH:mm
  closingTime: string; // HH:mm
  pickupIntervalMinutes: number;
  maxPickupMinutes: number;
  receiptFooterText: string;
  refundPolicy: string;
  welcomeMessage: string;
  maintenanceMessage: string;
  announcement: string;
  payoutPercents: { food: number; snacks: number; coffee: number; drinks: number };
  defaultVendorPayoutPercent: number;
};

export const DEFAULT_SETTINGS: SystemSettings = {
  churchName: "The Citadel Global Community Church",
  cafeteriaName: "CGCC Cafeteria Express",
  churchLogoUrl: "",
  cafeteriaLogoUrl: "",
  contactPhone: "",
  officialEmail: "",
  address: "",
  operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  openingTime: "08:00",
  closingTime: "16:00",
  pickupIntervalMinutes: 15,
  maxPickupMinutes: 480,
  receiptFooterText: "Thank you and God bless.",
  refundPolicy:
    "Pre-ordered items are prepared fresh for your selected pickup time. Orders cannot be refunded after preparation begins, except when an item is unavailable or a duplicate charge occurred — present your receipt code at the cafeteria counter for resolution.",
  welcomeMessage: "🎉 Welcome to CGCC Cafeteria Express",
  maintenanceMessage: "",
  announcement: "",
  payoutPercents: { food: 85, snacks: 85, coffee: 85, drinks: 85 },
  defaultVendorPayoutPercent: 85,
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

let cached: SystemSettings | null = null;
const listeners = new Set<(s: SystemSettings) => void>();

export async function loadSettings(force = false): Promise<SystemSettings> {
  if (!force && cached) return cached;
  const { data, error } = await supabase
    .from("system_settings")
    .select("data")
    .eq("id", "global")
    .maybeSingle();
  if (error) {
    console.warn("[settings] load failed", error);
    cached = { ...DEFAULT_SETTINGS };
  } else {
    const raw = (data?.data ?? {}) as Partial<SystemSettings>;
    cached = { ...DEFAULT_SETTINGS, ...raw };
  }
  listeners.forEach((fn) => fn(cached!));
  return cached;
}

export async function saveSettings(next: SystemSettings): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error("Your admin session expired. Please sign in again.");
  }
  const { error } = await supabase.rpc("save_system_settings", {
    _data: next as unknown as never,
  });
  if (error) {
    console.error("[settings] save failed", error);
    throw new Error(
      error.message.includes("forbidden")
        ? "Only administrators can change system settings."
        : error.message,
    );
  }
  cached = { ...next };
  listeners.forEach((fn) => fn(cached!));
}


/** Synchronous access for non-React modules (PDF generation etc.). */
export function currentSettings(): SystemSettings {
  return cached ?? DEFAULT_SETTINGS;
}

export function useSystemSettings(): SystemSettings {
  const [state, setState] = useState<SystemSettings>(() => cached ?? DEFAULT_SETTINGS);
  useEffect(() => {
    listeners.add(setState);
    void loadSettings();
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}
