"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API = "http://127.0.0.1:8000/product";

type Purchase = {
  id: number;
  quantity: number;
  purchase_price: string;
  total_amount: string;
  purchase_date: string;
  supplier_id: number;
  product_id: number; // references Product.id (not Product.product_id)
};

type ProductOption = {
  id: number;
  product_name: string;
  brand_name: string;
  size: string;
  purchase_price: string;
};

type FormState = {
  product_id: string;
  supplier_id: string;
  quantity: string;
  purchase_price: string;
  purchase_date: string; // datetime-local value, optional
};

const emptyForm: FormState = {
  product_id: "",
  supplier_id: "",
  quantity: "",
  purchase_price: "",
  purchase_date: "",
};

// ISO string -> value for <input type="datetime-local"> (local time)
const isoToLocalInput = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const toForm = (p: Purchase): FormState => ({
  product_id: String(p.product_id),
  supplier_id: String(p.supplier_id),
  quantity: String(p.quantity),
  purchase_price: p.purchase_price,
  purchase_date: isoToLocalInput(p.purchase_date),
});

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const money = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const productById = useMemo(() => {
    const m = new Map<number, ProductOption>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const productLabel = (p: ProductOption) =>
    `${p.product_name} · ${p.brand_name} · ${p.size}`;

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [purchaseRes, productsRes] = await Promise.all([
        fetch(`${API}/get_purchase/`, { cache: "no-store" }),
        fetch(`${API}/get_product/`, { cache: "no-store" }),
      ]);
      if (!purchaseRes.ok)
        throw new Error(`Purchase request failed (${purchaseRes.status})`);
      setPurchases(await purchaseRes.json());
      // Product list is only used for names/dropdown; don't fail the page without it.
      if (productsRes.ok) setProducts(await productsRes.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load purchases. ${e.message}`
          : "Couldn't load purchases."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Purchase) => {
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

  const onProductChange = (value: string) => {
    setForm((prev) => {
      const next = { ...prev, product_id: value };
      // Pre-fill cost from the product when adding and price is still empty.
      const p = productById.get(Number(value));
      if (!editing && p && prev.purchase_price === "")
        next.purchase_price = p.purchase_price;
      return next;
    });
  };

  const formTotal = useMemo(() => {
    const q = Number(form.quantity);
    const p = Number(form.purchase_price);
    return q > 0 && p >= 0 ? q * p : 0;
  }, [form.quantity, form.purchase_price]);

  const handleSave = async () => {
    if (!form.product_id || !form.supplier_id) {
      setFormError("Product and supplier ID are required.");
      return;
    }
    if (!(Number(form.quantity) > 0)) {
      setFormError("Quantity must be greater than 0.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        product_id: Number(form.product_id),
        supplier_id: Number(form.supplier_id),
        quantity: Number(form.quantity),
        purchase_price: form.purchase_price,
        total_amount: formTotal.toFixed(2),
      };
      if (form.purchase_date)
        payload.purchase_date = new Date(form.purchase_date).toISOString();

      // Update URL assumes update_purchase/<id>. Use "PATCH" if your API expects it.
      const url = editing
        ? `${API}/update_purchase/${editing.id}`
        : `${API}/add_purchase/`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server responded with ${res.status}`);
      }
      setModalOpen(false);
      await loadAll();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save purchase.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/delete_purchase/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setToDelete(null);
      await loadAll();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete purchase. ${e.message}`
          : "Couldn't delete purchase."
      );
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const totalSpend = useMemo(
    () => purchases.reduce((sum, p) => sum + Number(p.total_amount), 0),
    [purchases]
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchases</h1>
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading…"
              : `${purchases.length} purchases · ${money(totalSpend)} spent`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          Add purchase
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button onClick={loadAll} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              {["ID","Product", "Supplier", "Qty", "Unit cost", "Total", "Purchased on"].map(
                (h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                    {h}
                  </th>
                )
              )}
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && purchases.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                  No purchases recorded. Use “Add purchase” to log your first stock order.
                </td>
              </tr>
            )}
            {purchases.map((p) => {
              const prod = productById.get(p.product_id);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {prod ? productLabel(prod) : `${p.product_id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.supplier_id}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{p.quantity}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {money(p.purchase_price)}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium text-slate-900">
                    {money(p.total_amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {formatDate(p.purchase_date)}
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
              );
            })}
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
            aria-labelledby="purchase-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="purchase-modal-title"
              className="mb-4 text-lg font-semibold text-slate-900"
            >
              {editing ? "Edit purchase" : "Add purchase"}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product">
                {products.length > 0 ? (
                  <select
                    value={form.product_id}
                    onChange={(e) => onProductChange(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select a product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {productLabel(p)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    placeholder="Product id"
                    value={form.product_id}
                    onChange={(e) => setField("product_id", e.target.value)}
                    className={inputCls}
                  />
                )}
              </Field>

              <Field label="Supplier ID">
                <input
                  type="number"
                  value={form.supplier_id}
                  onChange={(e) => setField("supplier_id", e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Purchase price (per unit)">
                <input
                  type="number"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) => setField("purchase_price", e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Purchased on (optional)">
                <input
                  type="datetime-local"
                  value={form.purchase_date}
                  onChange={(e) => setField("purchase_date", e.target.value)}
                  className={inputCls}
                />
              </Field>

              <p className="self-end pb-2 text-sm text-slate-700 sm:text-right">
                Total:{" "}
                <span className="font-semibold text-slate-900">{money(formTotal)}</span>
              </p>
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 break-words rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
              >
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
                {saving ? "Saving…" : editing ? "Save changes" : "Add purchase"}
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
            <h2 className="text-lg font-semibold text-slate-900">Delete purchase?</h2>
            <p className="mt-2 text-sm text-slate-700">
              {toDelete.quantity} units ({money(toDelete.total_amount)}) will be removed
              from your purchase records. This can't be undone.
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
                {deleting ? "Deleting…" : "Delete purchase"}
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