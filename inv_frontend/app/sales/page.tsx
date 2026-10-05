"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BulkUploadSalesModal from "./Bulkuploadsalesmodal"; // keep BulkUploadSalesModal.tsx in the same folder as this page


const API = "http://127.0.0.1:8000/product";

type Sale = {
  id: number;
  order_id: string;
  quantity: number;
  selling_price: string;
  total_amount: string;
  Sell_date: string;
  status: boolean;
  platform_id: number;
  product_id: number; // references Product.id (not Product.product_id)
};

type ProductOption = {
  id: number;
  product_id: number; // business product ID (used by bulk upload's product_code column)
  product_name: string;
  brand_name: string;
  size: string;
  selling_price: string;
  stock_quantity: number;
};

type FormState = {
  order_id: string;
  product_id: string;
  platform_id: string;
  quantity: string;
  selling_price: string;
  Sell_date: string; // datetime-local value, optional
  status: boolean;
};

const emptyForm: FormState = {
  order_id: "",
  product_id: "",
  platform_id: "",
  quantity: "",
  selling_price: "",
  Sell_date: "",
  status: true,
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

const toForm = (s: Sale): FormState => ({
  order_id: s.order_id,
  product_id: String(s.product_id),
  platform_id: String(s.platform_id),
  quantity: String(s.quantity),
  selling_price: s.selling_price,
  Sell_date: isoToLocalInput(s.Sell_date),
  status: s.status,
});

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const money = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const units = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Return popup
  const [toReturn, setToReturn] = useState<Sale | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Bulk upload popup (all of its logic lives in BulkUploadSalesModal.tsx)
  const [bulkOpen, setBulkOpen] = useState(false);

  // Order + product pairs that already exist (the bulk upload uses these to spot duplicates)
  const existingSales = useMemo(
    () => sales.map((s) => ({ order_id: s.order_id, product_id: s.product_id })),
    [sales]
  );

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
      const [salesRes, productsRes] = await Promise.all([
        fetch(`${API}/get_sales/`, { cache: "no-store" }),
        fetch(`${API}/get_product/`, { cache: "no-store" }),
      ]);
      if (!salesRes.ok) throw new Error(`Sales request failed (${salesRes.status})`);
      setSales(await salesRes.json());
      // Product list is only used for names/dropdown; don't fail the page without it.
      if (productsRes.ok) setProducts(await productsRes.json());
    } catch (e) {
      setError(
        e instanceof Error ? `Couldn't load sales. ${e.message}` : "Couldn't load sales."
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

  const openEdit = (s: Sale) => {
    setEditing(s);
    setForm(toForm(s));
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
      // Pre-fill price from the product when adding and price is still empty.
      const p = productById.get(Number(value));
      if (!editing && p && prev.selling_price === "") next.selling_price = p.selling_price;
      return next;
    });
  };

  const formTotal = useMemo(() => {
    const q = Number(form.quantity);
    const p = Number(form.selling_price);
    return q > 0 && p >= 0 ? q * p : 0;
  }, [form.quantity, form.selling_price]);

  const handleSave = async () => {
    if (!form.order_id.trim() || !form.product_id || !form.platform_id) {
      setFormError("Order ID, product and platform ID are required.");
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
        order_id: form.order_id.trim(),
        product_id: Number(form.product_id),
        platform_id: Number(form.platform_id),
        quantity: Number(form.quantity),
        selling_price: form.selling_price,
        total_amount: formTotal.toFixed(2),
        status: form.status,
      };
      if (form.Sell_date) payload.Sell_date = new Date(form.Sell_date).toISOString();

      // update_sales endpoint is assumed to mirror update_product. Use "PATCH" if needed.
      const url = editing
        ? `${API}/update_sales/${editing.id}`
        : `${API}/add_sales/`;
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
      setFormError(e instanceof Error ? e.message : "Couldn't save sale.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/delete_sales/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setToDelete(null);
      await loadAll();
    } catch (e) {
      setError(
        e instanceof Error ? `Couldn't delete sale. ${e.message}` : "Couldn't delete sale."
      );
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const openReturn = (s: Sale) => {
    setToReturn(s);
    setReturnQty("1");
    setReturnError(null);
  };

  const closeReturn = () => {
    if (!returning) setToReturn(null);
  };

  const returnQtyNum = Number(returnQty);
  const returnQtyValid =
    toReturn !== null &&
    Number.isInteger(returnQtyNum) &&
    returnQtyNum >= 1 &&
    returnQtyNum <= toReturn.quantity;

  const handleReturn = async () => {
    if (!toReturn) return;
    if (!returnQtyValid) {
      setReturnError(`Enter a whole number between 1 and ${toReturn.quantity}.`);
      return;
    }

    setReturning(true);
    setReturnError(null);
    try {
      // Assumed URL: return_sales/<sale id>. Adjust if your urls.py differs
      // (for example add a trailing slash).
      const res = await fetch(`${API}/return_sales/${toReturn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: returnQtyNum }),
      });
      if (!res.ok) {
        let message = `Server responded with ${res.status}`;
        try {
          const json = await res.json();
          if (json?.error) message = String(json.error);
        } catch {
          if (res.status === 404) {
            message = "Return endpoint not found (404). Check the return_sales URL.";
          }
        }
        throw new Error(message);
      }
      setToReturn(null);
      await loadAll();
    } catch (e) {
      setReturnError(e instanceof Error ? e.message : "Couldn't return items.");
    } finally {
      setReturning(false);
    }
  };

  // A sale whose units have all been returned has quantity 0, so it's hidden from the list.
  // Remove this filter if you'd rather keep those rows visible.
  const visibleSales = useMemo(() => sales.filter((s) => s.quantity > 0), [sales]);

  const revenue = useMemo(
    () =>
      visibleSales.filter((s) => s.status).reduce((sum, s) => sum + Number(s.total_amount), 0),
    [visibleSales]
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading…"
              : `${visibleSales.length} orders · ${money(revenue)} in completed sales`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            Bulk upload
          </button>
          <button
            onClick={openAdd}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            Add sale
          </button>
        </div>
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
              {["ID", "Product", "Platform", "Qty", "Unit price", "Total", "Sold on", "Status"].map(
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
            {!loading && visibleSales.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-600">
                  No sales recorded. Use “Add sale” to record your first order.
                </td>
              </tr>
            )}
            {visibleSales.map((s) => {
              const p = productById.get(s.product_id);
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.id}</td>
                  {/* <td className="px-4 py-3 font-medium text-slate-900">{s.order_id}</td> */}
                  <td className="px-4 py-3 text-slate-700">
                    {p ? productLabel(p) : `Product #${s.product_id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.platform_id}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{s.quantity}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{money(s.selling_price)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-slate-900">
                    {money(s.total_amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {formatDate(s.Sell_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {s.status ? "Completed" : "Cancelled"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {/* Only completed sales can be returned */}
                    {s.status && (
                      <button
                        onClick={() => openReturn(s)}
                        className="rounded px-2 py-1 text-amber-700 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                      >
                        Return
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded px-2 py-1 text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setToDelete(s)}
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
            aria-labelledby="sale-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sale-modal-title" className="mb-4 text-lg font-semibold text-slate-900">
              {editing ? "Edit sale" : "Add sale"}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Order ID">
                <input
                  value={form.order_id}
                  onChange={(e) => setField("order_id", e.target.value)}
                  className={inputCls}
                />
              </Field>

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

              <Field label="Platform ID">
                <input
                  type="number"
                  value={form.platform_id}
                  onChange={(e) => setField("platform_id", e.target.value)}
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

              <Field label="Selling price (per unit)">
                <input
                  type="number"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setField("selling_price", e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Sold on (optional)">
                <input
                  type="datetime-local"
                  value={form.Sell_date}
                  onChange={(e) => setField("Sell_date", e.target.value)}
                  className={inputCls}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => setField("status", e.target.checked)}
                  className="h-4 w-4 accent-teal-700"
                />
                Completed
              </label>

              <p className="self-center text-sm text-slate-700 sm:text-right">
                Total: <span className="font-semibold text-slate-900">{money(formTotal)}</span>
              </p>
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
                {saving ? "Saving…" : editing ? "Save changes" : "Add sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk upload */}
      <BulkUploadSalesModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        products={products}
        existingSales={existingSales}
        onUploaded={loadAll}
      />

      {/* Return popup */}
      {toReturn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeReturn}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-modal-title"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="return-modal-title" className="text-lg font-semibold text-slate-900">
              Return items
            </h2>

            <dl className="mt-3 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Sale ID</dt>
                <dd className="font-medium text-slate-900">{toReturn.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Product</dt>
                <dd className="text-right text-slate-900">
                  {(() => {
                    const p = productById.get(toReturn.product_id);
                    return p ? productLabel(p) : `Product #${toReturn.product_id}`;
                  })()}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Units sold</dt>
                <dd className="font-medium text-slate-900">{toReturn.quantity}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-800">
                  Number of units to return
                </span>
                <input
                  type="number"
                  min={1}
                  max={toReturn.quantity}
                  step={1}
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !returning && handleReturn()}
                  autoFocus
                  className={inputCls}
                />
              </label>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>Between 1 and {toReturn.quantity}</span>
                <button
                  type="button"
                  onClick={() => setReturnQty(String(toReturn.quantity))}
                  className="font-medium text-teal-700 hover:underline"
                >
                  Return all
                </button>
              </div>
            </div>

            {returnQtyValid && (
              <p className="mt-3 text-sm text-slate-700">
                {units(returnQtyNum)} will go back to stock. This sale will have{" "}
                {units(toReturn.quantity - returnQtyNum)} left.
              </p>
            )}

            {returnError && (
              <p
                role="alert"
                className="mt-3 break-words rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {returnError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeReturn}
                disabled={returning}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={returning || !returnQtyValid}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {returning ? "Returning…" : "Confirm return"}
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
            <h2 className="text-lg font-semibold text-slate-900">Delete sale?</h2>
            <p className="mt-2 text-sm text-slate-700">
              Order {toDelete.order_id} ({money(toDelete.total_amount)}) will be removed. This
              can't be undone.
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
                {deleting ? "Deleting…" : "Delete sale"}
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