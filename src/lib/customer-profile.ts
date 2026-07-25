// Remembers the customer's name and phone on this device so repeat orders
// (e.g. adding a forgotten takeaway pack) don't require re-entering details.
const KEY = "cgcc-customer-profile-v1";

export type CustomerProfile = { name: string; phone: string };

export function loadCustomerProfile(): CustomerProfile {
  if (typeof window === "undefined") return { name: "", phone: "" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { name: "", phone: "" };
    const parsed = JSON.parse(raw) as Partial<CustomerProfile>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

export function saveCustomerProfile(p: CustomerProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: p.name.trim(), phone: p.phone.trim() }));
  } catch {}
}

export function clearCustomerProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
