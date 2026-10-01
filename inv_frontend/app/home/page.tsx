"use client";

import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/product";

type Product = {
  id: number;
  product_id: number;
  product_name: string;
  brand_name: string;
  sku: string;
  size: string;
  color: string;
  purchase_price: string;
  selling_price: string;
  stock_quantity: number;
  reorder_level: number | null;
  status: boolean;
  created_at: string;
  updated_at: string;
  category_id: number;
};

type FormState = {
  product_id: string;
  product_name: string;
  brand_name: string;
  sku: string;
  size: string;
  color: string;
  purchase_price: string;
  selling_price: string;
  stock_quantity: string;
  reorder_level: string;
  category_id: string;
  status: boolean;
};

const emptyForm: FormState = {
  product_id: "",
  product_name: "",
  brand_name: "",
  sku: "",
  size: "",
  color: "",
  purchase_price: "",
  selling_price: "",
  stock_quantity: "",
  reorder_level: "",
  category_id: "",
  status: true,
};

const toForm = (p: Product): FormState => ({
  product_id: String(p.product_id),
  product_name: p.product_name,
  brand_name: p.brand_name,
  sku: p.sku,
  size: p.size,
  color: p.color,
  purchase_price: p.purchase_price,
  selling_price: p.selling_price,
  stock_quantity: String(p.stock_quantity),
  reorder_level: p.reorder_level === null ? "" : String(p.reorder_level),
  category_id: String(p.category_id),
  status: p.status,
});

const toPayload = (f: FormState) => ({
  product_id: Number(f.product_id),
  product_name: f.product_name.trim(),
  brand_name: f.brand_name.trim(),
  sku: f.sku.trim(),
  size: f.size.trim(),
  color: f.color.trim(),
  purchase_price: f.purchase_price,
  selling_price: f.selling_price,
  stock_quantity: Number(f.stock_quantity),
  reorder_level: f.reorder_level === "" ? null : Number(f.reorder_level),
  category_id: Number(f.category_id),
  status: f.status,
});

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API}/get_product/`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setProducts(await res.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load products. ${e.message}`
          : "Couldn't load products."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(toForm(p));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const url = editing
        ? `${API}/update_product/${editing.product_id}`
        : `${API}/add_product/`;
      // Change "PUT" to "PATCH" if your update endpoint expects PATCH.
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server responded with ${res.status}`);
      }
      setModalOpen(false);
      await loadProducts();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/delete_product/${toDelete.product_id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setToDelete(null);
      await loadProducts();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete product. ${e.message}`
          : "Couldn't delete product."
      );
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const isLow = (p: Product) =>
    p.reorder_level !== null && p.stock_quantity <= p.reorder_level;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="text-sm text-slate-600">
            {loading ? "Loading…" : `${products.length} in inventory`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          Add product
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button onClick={loadProducts} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              {["ID",
                "Product ID",
                "Name",
                "Brand",
                "SKU",
                "Size",
                "Color",
                "Cost",
                "Price",
                "Stock",
                "Status",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && products.length === 0 && !error && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-slate-600">
                  No products yet. Use “Add product” to create your first one.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{p.id}</td>
                <td className="px-4 py-3 text-slate-700">{p.product_id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {p.product_name}
                </td>
                <td className="px-4 py-3 text-slate-700">{p.brand_name}</td>
                <td className="px-4 py-3 text-slate-700">{p.sku}</td>
                <td className="px-4 py-3 text-slate-700">{p.size}</td>
                <td className="px-4 py-3 text-slate-700">{p.color}</td>
                <td className="px-4 py-3 tabular-nums text-slate-700">
                  ₹{Number(p.purchase_price).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">
                  ₹{Number(p.selling_price).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className={isLow(p) ? "font-medium text-amber-700" : "text-slate-700"}>
                    {p.stock_quantity}
                  </span>
                  {isLow(p) && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                      Low
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {p.status ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded px-2 py-1 text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setToDelete(p)}
                    className="ml-1 rounded px-2 py-1 text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="product-modal-title"
              className="mb-4 text-lg font-semibold text-slate-900"
            >
              {editing ? "Edit product" : "Add product"}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product ID">
                <input
                  type="number"
                  value={form.product_id}
                  onChange={(e) => setField("product_id", e.target.value)}
                  disabled={!!editing}
                  className={inputCls}
                />
              </Field>
              <Field label="Product name">
                <input
                  value={form.product_name}
                  onChange={(e) => setField("product_name", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Brand">
                <input
                  value={form.brand_name}
                  onChange={(e) => setField("brand_name", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="SKU">
                <input
                  value={form.sku}
                  onChange={(e) => setField("sku", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Size">
                <input
                  value={form.size}
                  onChange={(e) => setField("size", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Color">
                <input
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Purchase price">
                <input
                  type="number"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) => setField("purchase_price", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Selling price">
                <input
                  type="number"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setField("selling_price", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Stock quantity">
                <input
                  type="number"
                  value={form.stock_quantity}
                  onChange={(e) => setField("stock_quantity", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Reorder level (optional)">
                <input
                  type="number"
                  value={form.reorder_level}
                  onChange={(e) => setField("reorder_level", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Category ID">
                <input
                  type="number"
                  value={form.category_id}
                  onChange={(e) => setField("category_id", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => setField("status", e.target.checked)}
                  className="h-4 w-4 accent-teal-700"
                />
                Active
              </label>
            </div>

            {formError && (
              <p role="alert" className="mt-4 break-words rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setToDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Delete product?</h2>
            <p className="mt-2 text-sm text-slate-700">
              {toDelete.product_name} ({toDelete.brand_name}, {toDelete.size}) will be
              removed from your inventory. This can't be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:bg-slate-100 disabled:text-slate-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-800">{label}</span>
      {children}
    </label>
  );
}
