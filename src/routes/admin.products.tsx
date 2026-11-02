import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
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
  archiveCategory,
  archiveProduct,
  bulkMoveProducts,
  bulkUpdateProducts,
  deleteCategory,
  deleteProduct,
  duplicateProduct,
  listCategories,
  listProducts,
  reorderCategories,
  restoreCategory,
  restoreProduct,
  upsertCategory,
  uploadProductImage,
  upsertProduct,
  type BulkAction,
  type CategoryRow,
  type ProductRow,
} from "@/lib/admin-ops";
import { formatNaira } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [...pageMeta("Product Management · CGCC Admin", "Manage cafeteria products, categories, pricing and images."), { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <ProductsPage />
      </AdminShell>
    </AdminGuard>
  ),
});

const VENDORS = ["food", "snacks", "coffee", "drinks"] as const;
type SortKey = "name" | "price" | "stock" | "vendor";

type FormState = {
  id?: string;
  name: string;
  category_id: string;
  price: string;
  cost_price: string;
  vendor_type: string;
  description: string;
  image_url: string;
  available: boolean;
};

const empty: FormState = {
  name: "",
  category_id: "",
  price: "",
  cost_price: "",
  vendor_type: "food",
  description: "",
  image_url: "",
  available: true,
};

function ProductsPage() {
  const [view, setView] = useState<"products" | "categories">("products");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listProducts(true), listCategories(true)]);
      setRows(p);
      setCats(c);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Product Management</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, duplicate, archive and bulk-manage products and categories. Historical orders keep their original
            prices.
          </p>
        </div>
        <div className="flex gap-1">
          {(["products", "categories"] as const).map((k) => (
            <Button key={k} size="sm" variant={view === k ? "default" : "outline"} onClick={() => setView(k)}>
              {k === "products" ? "Products" : "Categories"}
            </Button>
          ))}
        </div>
      </div>

      {view === "products" ? (
        <ProductsTab rows={rows} cats={cats} loading={loading} reload={load} />
      ) : (
        <CategoriesTab cats={cats} rows={rows} loading={loading} reload={load} />
      )}
    </div>
  );
}

/* ------------------------------- Products ------------------------------- */

function ProductsTab({
  rows,
  cats,
  loading,
  reload,
}: {
  rows: ProductRow[];
  cats: CategoryRow[];
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "archived" | "all">("active");
  const [vendorFilter, setVendorFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProductRow | null>(null);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkPercent, setBulkPercent] = useState("");

  const activeCats = useMemo(() => cats.filter((c) => !c.archived_at), [cats]);
  const catName = useCallback(
    (id: string | null) => cats.find((c) => c.id === id)?.name ?? id ?? "—",
    [cats],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (tab === "active" && r.archived_at) return false;
      if (tab === "archived" && !r.archived_at) return false;
      if (vendorFilter && r.vendor_type !== vendorFilter) return false;
      if (catFilter && r.category_id !== catFilter) return false;
      if (statusFilter === "available" && !(r.available && r.stock_qty > 0)) return false;
      if (statusFilter === "soldout" && r.available && r.stock_qty > 0) return false;
      if (statusFilter === "disabled" && r.available) return false;
      if (s && !r.name.toLowerCase().includes(s)) return false;
      return true;
    });
    const dir = sortAsc ? 1 : -1;
    return out.sort((a, b) => {
      if (sortKey === "price") return (a.price - b.price) * dir;
      if (sortKey === "stock") return (a.stock_qty - b.stock_qty) * dir;
      if (sortKey === "vendor") return (a.vendor_type ?? "").localeCompare(b.vendor_type ?? "") * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [rows, tab, q, vendorFilter, catFilter, statusFilter, sortKey, sortAsc]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.id)));
  }

  function openCreate() {
    setForm({ ...empty, category_id: activeCats[0]?.id ?? "" });
    setDialogOpen(true);
  }
  function openEdit(p: ProductRow) {
    setForm({
      id: p.id,
      name: p.name,
      category_id: p.category_id ?? activeCats[0]?.id ?? "",
      price: String(p.price),
      cost_price: String(p.cost_price ?? 0),
      vendor_type: p.vendor_type ?? "food",
      description: p.description ?? "",
      image_url: p.image_url ?? "",
      available: p.available,
    });
    setDialogOpen(true);
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    const price = parseInt(form.price, 10);
    const costPrice = form.cost_price.trim() === "" ? 0 : parseInt(form.cost_price, 10);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(costPrice) || costPrice < 0) {
      toast.error("Name and valid prices required");
      return;
    }
    setSaving(true);
    try {
      await upsertProduct({
        id: form.id,
        name: form.name.trim(),
        category_id: form.category_id || null,
        price,
        cost_price: costPrice,
        vendor_type: form.vendor_type,
        description: form.description || null,
        image_url: form.image_url || null,
        available: form.available,
      });
      toast.success(form.id ? "Product updated" : "Product created");
      setDialogOpen(false);
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    }
  }

  async function doBulk(action: BulkAction, value?: number) {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const res: any = await bulkUpdateProducts(ids, action, value);
      toast.success(`Updated ${res?.updated ?? ids.length} product(s)`);
      setSelected(new Set());
      setBulkPrice("");
      setBulkPercent("");
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Bulk action failed");
    }
  }

  async function doBulkMove(vendorType?: string, categoryId?: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      await bulkMoveProducts(ids, vendorType, categoryId);
      toast.success("Products moved");
      setSelected(new Set());
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Move failed");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
        <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="w-52" />
        <div className="flex gap-1">
          {(["active", "archived", "all"] as const).map((k) => (
            <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </Button>
          ))}
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
        >
          <option value="">All vendors</option>
          {VENDORS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Any status</option>
          <option value="available">Available</option>
          <option value="soldout">Sold out</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="name">Sort: Name</option>
          <option value="price">Sort: Price</option>
          <option value="stock">Sort: Stock</option>
          <option value="vendor">Sort: Vendor</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => setSortAsc((v) => !v)}>
          {sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        </Button>
        <div className="ml-auto">
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-sm">
          <span className="font-semibold">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => void doBulk("enable")}>
            Enable
          </Button>
          <Button size="sm" variant="outline" onClick={() => void doBulk("disable")}>
            Disable
          </Button>
          <Button size="sm" variant="outline" onClick={() => void doBulk("archive")}>
            Archive
          </Button>
          <Button size="sm" variant="outline" onClick={() => void doBulk("restore")}>
            Restore
          </Button>
          <div className="flex items-center gap-1">
            <Input
              className="h-8 w-24"
              type="number"
              placeholder="₦ price"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => void doBulk("price_set", Number(bulkPrice))}>
              Set price
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Input
              className="h-8 w-20"
              type="number"
              placeholder="% ±"
              value={bulkPercent}
              onChange={(e) => setBulkPercent(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => void doBulk("price_percent", Number(bulkPercent))}>
              Adjust %
            </Button>
          </div>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value=""
            onChange={(e) => e.target.value && void doBulkMove(e.target.value, undefined)}
          >
            <option value="">Move to vendor…</option>
            {VENDORS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value=""
            onChange={(e) => e.target.value && void doBulkMove(undefined, e.target.value)}
          >
            <option value="">Move to category…</option>
            {activeCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Vendor</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-center">Stock</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} loading="lazy" className="h-8 w-8 rounded object-cover" />
                      ) : null}
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">{catName(p.category_id)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs uppercase">{p.vendor_type}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatNaira(p.price)}</td>
                  <td className="px-3 py-2 text-center">
                    <div>{p.stock_qty}</div>
                    <div className="text-[10px] text-muted-foreground">
                      on {p.stock_online} · walk {p.stock_walkin}
                    </div>
                  </td>
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
                      <Button size="sm" variant="outline" title="Edit" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Duplicate"
                        onClick={() => void run(() => duplicateProduct(p.id), "Duplicated")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {p.archived_at ? (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Restore"
                          onClick={() => void run(() => restoreProduct(p.id), "Restored")}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Archive"
                          onClick={() => void run(() => archiveProduct(p.id), "Archived")}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        title="Delete"
                        className="text-destructive"
                        onClick={() => setConfirmDelete(p)}
                      >
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
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
                {activeCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Product Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {form.image_url ? (
                  <img src={form.image_url} alt="Product preview" className="h-14 w-14 rounded object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                    None
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onPickImage(e.target.files?.[0])}
                />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-4 w-4" />
                  {uploading ? "Uploading…" : form.image_url ? "Replace" : "Upload"}
                </Button>
                {form.image_url ? (
                  <Button type="button" variant="ghost" onClick={() => setForm({ ...form, image_url: "" })}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <Input
                className="mt-2"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="…or paste an image URL"
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
            <Button
              variant="destructive"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (target)
                  void run(
                    () => deleteProduct(target.id),
                    "Deleted",
                  );
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------ Categories ------------------------------ */

function CategoriesTab({
  cats,
  rows,
  loading,
  reload,
}: {
  cats: CategoryRow[];
  rows: ProductRow[];
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [editName, setEditName] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.category_id) m.set(r.category_id, (m.get(r.category_id) ?? 0) + 1);
    return m;
  }, [rows]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = [...cats];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[idx];
    next[idx] = next[target];
    next[target] = a;
    await run(() => reorderCategories(next.map((c) => c.id)), "Order saved");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
        <Input
          className="w-56"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          onClick={() => {
            if (!name.trim()) return toast.error("Name required");
            void run(async () => {
              await upsertCategory({ name: name.trim() });
              setName("");
            }, "Category created");
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Create Category
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-center">Products</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Order</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : cats.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No categories yet.
                </td>
              </tr>
            ) : (
              cats.map((c, i) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{c.name}</td>
                  <td className="px-3 py-2 text-center">{counts.get(c.id) ?? 0}</td>
                  <td className="px-3 py-2 text-center">
                    {c.archived_at ? (
                      <span className="rounded-full border border-muted-foreground/40 bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        Archived
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => void move(i, -1)} title="Move up">
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void move(i, 1)} title="Move down">
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Rename"
                        onClick={() => {
                          setEditing(c);
                          setEditName(c.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {c.archived_at ? (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Restore"
                          onClick={() => void run(() => restoreCategory(c.id), "Restored")}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Archive"
                          onClick={() => void run(() => archiveCategory(c.id), "Archived")}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        title="Delete"
                        className="text-destructive"
                        onClick={() => void run(() => deleteCategory(c.id), "Deleted")}
                      >
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
          </DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const target = editing;
                if (!target || !editName.trim()) return;
                setEditing(null);
                void run(() => upsertCategory({ id: target.id, name: editName.trim() }), "Renamed");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
