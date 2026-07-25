import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  archiveProduct,
  deleteProduct,
  listProducts,
  restoreProduct,
  upsertProduct,
  type ProductRow,
} from "@/lib/admin-ops";
import { formatNaira } from "@/lib/store";
import { CATEGORIES } from "@/lib/menu-data";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [{ title: "Product Management · CGCC Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <ProductsPage />
      </AdminShell>
    </AdminGuard>
  ),
});

const VENDORS = ["food", "snacks", "coffee", "drinks"] as const;

type FormState = {
  id?: string;
  name: string;
  category_id: string;
  price: string;
  vendor_type: string;
  description: string;
  image_url: string;
  available: boolean;
};

const empty: FormState = {
  name: "",
  category_id: CATEGORIES[0],
  price: "",
  vendor_type: "food",
  description: "",
  image_url: "",
  available: true,
};

function ProductsPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "archived" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listProducts(true));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "active" && r.archived_at) return false;
      if (tab === "archived" && !r.archived_at) return false;
      if (s && !r.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, tab, q]);

  function openCreate() {
    setForm(empty);
    setDialogOpen(true);
  }
  function openEdit(p: ProductRow) {
    setForm({
      id: p.id,
      name: p.name,
      category_id: p.category_id ?? CATEGORIES[0],
      price: String(p.price),
      vendor_type: p.vendor_type ?? "food",
      description: p.description ?? "",
      image_url: p.image_url ?? "",
      available: p.available,
    });
    setDialogOpen(true);
  }

  async function save() {
    const price = parseInt(form.price, 10);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      toast.error("Name and valid price required");
      return;
    }
    setSaving(true);
    try {
      await upsertProduct({
        id: form.id,
        name: form.name.trim(),
        category_id: form.category_id,
        price,
        vendor_type: form.vendor_type,
        description: form.description || null,
        image_url: form.image_url || null,
        available: form.available,
      });
      toast.success(form.id ? "Product updated" : "Product created");
      setDialogOpen(false);
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function doArchive(p: ProductRow) {
    try {
      await archiveProduct(p.id);
      toast.success("Archived");
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }
  async function doRestore(p: ProductRow) {
    try {
      await restoreProduct(p.id);
      toast.success("Restored");
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }
  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await deleteProduct(confirmDelete.id);
      toast.success("Deleted");
      setConfirmDelete(null);
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed (product may have historical orders — archive instead)");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Product Management</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, archive, and delete menu products. Prices update immediately everywhere — historical orders keep their
            original prices.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add New Product
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        <div className="flex gap-1">
          {(["active", "archived", "all"] as const).map((k) => (
            <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Vendor</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-center">Total Stock</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : null}
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">{p.category_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs uppercase">{p.vendor_type}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatNaira(p.price)}</td>
                  <td className="px-3 py-2 text-center">{p.stock_qty}</td>
                  <td className="px-3 py-2 text-center">
                    {p.archived_at ? (
                      <span className="rounded-full border border-muted-foreground/40 bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        Archived
                      </span>
                    ) : p.available && p.stock_qty > 0 ? (
                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                        Available
                      </span>
                    ) : (
                      <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                        Sold Out
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {p.archived_at ? (
                        <Button size="sm" variant="outline" onClick={() => void doRestore(p)}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void doArchive(p)}>
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Product Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Selling Price (₦)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Vendor</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.vendor_type}
                  onChange={(e) => setForm({ ...form, vendor_type: e.target.value })}
                >
                  {VENDORS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: Boolean(v) })} />
              <Label>Available for sale</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the product. If it has past orders, deletion will fail — archive it instead.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void doDelete()}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
