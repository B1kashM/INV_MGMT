"use client";

import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/product";

type Supplier = {
  id: number;
  supplier_name: string;
  supplier_phone: number;
  supplier_email: string;
  supplier_address: string;
  status: boolean;
  created_at: string;
};

type FormState = {
  supplier_name: string;
  supplier_phone: string;
  supplier_email: string;
  supplier_address: string;
  status: boolean;
};

const emptyForm: FormState = {
  supplier_name: "",
  supplier_phone: "",
  supplier_email: "",
  supplier_address: "",
  status: true,
};

const toForm = (s: Supplier): FormState => ({
  supplier_name: s.supplier_name,
  supplier_phone: String(s.supplier_phone),
  supplier_email: s.supplier_email,
  supplier_address: s.supplier_address,
  status: s.status,
});

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API}/get_supplier/`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setSuppliers(await res.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't load suppliers. ${e.message}`
          : "Couldn't load suppliers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
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

  const handleSave = async () => {
    if (!form.supplier_name.trim()) {
      setFormError("Supplier name is required.");
      return;
    }
    const phoneDigits = form.supplier_phone.replace(/\D/g, "");
    if (!phoneDigits) {
      setFormError("Enter a valid phone number.");
      return;
    }
    if (form.supplier_email && !/^\S+@\S+\.\S+$/.test(form.supplier_email)) {
      setFormError("Enter a valid email address.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      // Change "PUT" to "PATCH" if your update endpoint expects PATCH.
      const url = editing
        ? `${API}/update_supplier/${editing.id}`
        : `${API}/add_supplier/`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_name: form.supplier_name.trim(),
          // Your API returns the phone as a number, so it's sent as a number.
          supplier_phone: Number(phoneDigits),
          supplier_email: form.supplier_email.trim(),
          supplier_address: form.supplier_address.trim(),
          status: form.status,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server responded with ${res.status}`);
      }
      setModalOpen(false);
      await loadSuppliers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/delete_supplier/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setToDelete(null);
      await loadSuppliers();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete supplier. ${e.message} Suppliers with existing purchases may not be deletable.`
          : "Couldn't delete supplier."
      );
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = suppliers.filter((s) => s.status).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading…"
              : `${suppliers.length} suppliers · ${activeCount} active`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          Add supplier
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button onClick={loadSuppliers} className="font-medium underline">
            Reload
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              {["ID", "Supplier", "Phone", "Email", "Address", "Status", "Added on"].map(
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
            {!loading && suppliers.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-600">
                  No suppliers yet. Use “Add supplier” to add your first one.
                </td>
              </tr>
            )}
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 tabular-nums text-slate-700">{s.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {s.supplier_name}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">
                  {s.supplier_phone}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {s.supplier_email ? (
                    <a
                      href={`mailto:${s.supplier_email}`}
                      className="text-teal-800 hover:underline"
                    >
                      {s.supplier_email}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">{s.supplier_address || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {s.status ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatDate(s.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
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
            aria-labelledby="supplier-modal-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="supplier-modal-title"
              className="mb-4 text-lg font-semibold text-slate-900"
            >
              {editing ? "Edit supplier" : "Add supplier"}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Supplier name">
                  <input
                    value={form.supplier_name}
                    onChange={(e) => setField("supplier_name", e.target.value)}
                    autoFocus
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Phone">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.supplier_phone}
                  onChange={(e) => setField("supplier_phone", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.supplier_email}
                  onChange={(e) => setField("supplier_email", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <textarea
                    rows={3}
                    value={form.supplier_address}
                    onChange={(e) => setField("supplier_address", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-800">
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
                {saving ? "Saving…" : editing ? "Save changes" : "Add supplier"}
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
            <h2 className="text-lg font-semibold text-slate-900">Delete supplier?</h2>
            <p className="mt-2 text-sm text-slate-700">
              {toDelete.supplier_name} will be removed. This can't be undone. If you only
              want to stop using them, mark the supplier Inactive instead.
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
                {deleting ? "Deleting…" : "Delete supplier"}
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